import { describe, expect, it } from 'vitest'
import { optional } from '../src/index'
import { errorExamples } from './fixtures/contract'
import { jsonResponse, rejection, testClient } from './fixtures/fetch'

function failing(body: unknown, status: number): Promise<unknown> {
	const { client } = testClient(() => jsonResponse(body, status))
	return client.entries.get('blog', 'ola-mundo')
}

describe('optional', () => {
	it('passes a resolved value through', async () => {
		await expect(optional(Promise.resolve(0))).resolves.toBe(0)
	})

	it.each(errorExamples())(
		'$response resolves undefined only for not_found',
		async ({ status, body }) => {
			const outcome = optional(failing(body, status))
			if (body.code === 'not_found') {
				await expect(outcome).resolves.toBeUndefined()
			} else {
				expect(await rejection(outcome)).toMatchObject({ status, code: body.code })
			}
		}
	)

	it('rethrows errors that are not RushError', async () => {
		const error = new TypeError('fetch failed')
		expect(await rejection(optional(Promise.reject(error)))).toBe(error)
		const lookalike = { name: 'RushError', status: 404 }
		expect(await rejection(optional(Promise.reject(lookalike)))).toBe(lookalike)
	})
})
