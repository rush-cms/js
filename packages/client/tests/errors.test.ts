import { describe, expect, expectTypeOf, it } from 'vitest'
import { RushError, isRushError } from '../src/index'
import type { FieldError, RushErrorCode, components } from '../src/index'
import { errorCodes, errorExamples, responseExample } from './fixtures/contract'
import { jsonResponse, rejection, testClient } from './fixtures/fetch'

type ContractErrorCode = components['schemas']['ErrorCode']

function failingWith(body: unknown, status: number): Promise<unknown> {
	const { client } = testClient(() => jsonResponse(body, status))
	return rejection(client.entries.get('blog', 'ola-mundo'))
}

describe('errors', () => {
	it.each(errorExamples())(
		'$response maps to a RushError with its code, params and field errors',
		async ({ status, body }) => {
			const error = await failingWith(body, status)

			expect(error).toBeInstanceOf(RushError)
			expect(error).toMatchObject({
				status,
				code: body.code,
				message: body.error,
				params: body.params ?? {},
				errors: body.errors ?? []
			})
		}
	)

	it.each(errorCodes())('maps the contract code %s', async (code) => {
		const params = { detail: code }
		const error = await failingWith({ error: 'failure', code, params }, 418)

		expect(isRushError(error, code as RushErrorCode)).toBe(true)
		expect(error).toMatchObject({ status: 418, code, params })
	})

	it('covers exactly the contract enum plus the client codes', () => {
		expectTypeOf<ContractErrorCode>().toExtend<RushErrorCode>()
		expectTypeOf<Exclude<RushErrorCode, ContractErrorCode>>().toEqualTypeOf<
			'network_error' | 'invalid_response'
		>()
		expect(errorCodes()).toEqual(
			expect.arrayContaining(['payload_too_large', 'forbidden', 'token_expired'])
		)
	})

	it.each(['payload_too_large', 'forbidden', 'token_expired'] as const)(
		'narrows %s through isRushError',
		async (code) => {
			const error = await failingWith({ error: 'failure', code }, 400)

			expect(isRushError(error, code)).toBe(true)
			expect(isRushError(error, 'bad_request')).toBe(false)
			if (isRushError(error, code)) {
				expectTypeOf(error.code).toEqualTypeOf<typeof code>()
				expectTypeOf(error.params).toEqualTypeOf<Record<string, unknown>>()
			}
		}
	)

	it('narrows params per code', async () => {
		const moved = responseExample('NotFoundEntry') as Record<string, unknown>
		const error = await failingWith(moved, 404)

		expect(isRushError(error, 'not_found')).toBe(false)
		if (!isRushError(error, 'moved')) {
			throw new Error('expected a moved error')
		}
		expectTypeOf(error.params).toEqualTypeOf<{
			locale: string
			slug: string
			collection_slug: string
		}>()
		expectTypeOf(error.errors).toEqualTypeOf<FieldError[]>()
		expect(error.params).toEqual(moved.params)
	})

	it('types params of codes without contract params as a record', async () => {
		const error = await failingWith(responseExample('Forbidden'), 403)

		if (!isRushError(error, 'forbidden')) {
			throw new Error('expected a forbidden error')
		}
		expectTypeOf(error.params).toEqualTypeOf<Record<string, unknown>>()
		expect(error.params).toEqual({})
	})

	it('narrows rate limits and missing translations', async () => {
		const limited = await failingWith(responseExample('RateLimited'), 429)
		const untranslated = await failingWith(responseExample('NotFoundTranslatable'), 404)

		if (!isRushError(limited, 'rate_limited') || !isRushError(untranslated, 'not_translated')) {
			throw new Error('expected rate_limited and not_translated')
		}
		expectTypeOf(limited.params.retry_after).toEqualTypeOf<number>()
		expectTypeOf(untranslated.params.available).toEqualTypeOf<string[]>()
		expect(limited.params.retry_after).toBe(42)
	})

	it('maps a rejected fetch to network_error', async () => {
		const cause = new TypeError('fetch failed')
		const { client } = testClient(() => Promise.reject(cause))

		const error = await rejection(client.site.get())

		expect(isRushError(error, 'network_error')).toBe(true)
		expect(error).toMatchObject({ status: 0, cause })
	})

	it.each([
		['a non-JSON error body', new Response('<h1>Bad gateway</h1>', { status: 502 }), 502],
		['an envelope-less error body', jsonResponse({ message: 'nope' }, 500), 500],
		['a non-JSON success body', new Response('ok', { status: 200 }), 200],
		['a success body without data', jsonResponse({ items: [] }), 200],
		['a 304 without a stored body', new Response(null, { status: 304 }), 304]
	])('maps %s to invalid_response', async (_, response, status) => {
		const { client } = testClient(() => response)

		const error = await rejection(client.site.get())

		expect(isRushError(error, 'invalid_response')).toBe(true)
		expect(error).toMatchObject({ status, params: {}, errors: [] })
	})

	it('maps a paginated call without meta to invalid_response with the real status', async () => {
		const { client } = testClient(() => jsonResponse({ data: [] }, 203))

		const error = await rejection(client.entries.list('blog'))

		expect(isRushError(error, 'invalid_response')).toBe(true)
		expect(error).toMatchObject({ status: 203 })
	})

	it('recognises any RushError without a code', () => {
		expect(isRushError(new Error('plain'))).toBe(false)
		expect(isRushError('not_found')).toBe(false)
		const error: unknown = new RushError({
			status: 0,
			code: 'network_error',
			message: 'down',
			params: {},
			errors: []
		})
		expect(isRushError(error)).toBe(true)
		expect(error).toBeInstanceOf(Error)
		expect((error as Error).name).toBe('RushError')
	})
})
