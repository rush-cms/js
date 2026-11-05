import type { APIContext } from 'astro'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { submitForm } from '../src/forms'
import type { FormContext } from '../src/forms'
import { POST, prerender } from '../src/routes/forms'
import { SITE_PREFIX, apiError, asRequest, envelope, startStubApi } from './fixtures/api'
import type { StubApi, StubRequest } from './fixtures/api'
import { rushLocals } from './fixtures/runtime'

type PostOptions = {
	body: BodyInit
	headers?: Record<string, string>
	clientAddress?: string | undefined
}

const ORIGIN = 'https://site.example'
const VISITOR_IP = '203.0.113.7'
const SUBMIT_PATH = `${SITE_PREFIX}/forms/contact/submit`
const VALIDATION = {
	error: 'validation failed',
	code: 'validation_failed',
	errors: [{ field: 'email', code: 'invalid_email' }]
}

let stub: StubApi

function formContext(options: PostOptions): FormContext {
	const request = new Request(`${ORIGIN}/_rush/forms/contact`, {
		method: 'POST',
		body: options.body,
		headers: options.headers ?? {}
	})
	const clientAddress = options.clientAddress
	return {
		request,
		params: { key: 'contact' },
		url: new URL(request.url),
		get clientAddress(): string {
			if (clientAddress === undefined) {
				throw new Error('clientAddress is not available')
			}
			return clientAddress
		},
		locals: rushLocals(stub.api),
		currentLocale: undefined,
		isPrerendered: false
	}
}

function post(options: PostOptions): Promise<Response> {
	return submitForm(formContext({ clientAddress: VISITOR_IP, ...options }))
}

function submitted(): StubRequest {
	const request = stub.requests.find((item) => item.path === SUBMIT_PATH)
	if (request === undefined) {
		throw new Error('the form was not submitted to the API')
	}
	return request
}

function urlencoded(fields: string): PostOptions {
	return {
		body: fields,
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Referer: `${ORIGIN}/contact?ref=nav`
		}
	}
}

beforeAll(async () => {
	stub = await startStubApi()
})

beforeEach(() => {
	stub.handle(() => envelope({ received: true }, 201))
})

afterEach(() => {
	stub.requests.length = 0
})

afterAll(() => stub.close())

describe('POST /_rush/forms/[key]', () => {
	it('is rendered on demand and delegates to submitForm', async () => {
		const context = formContext({ ...urlencoded('name=Ana'), clientAddress: VISITOR_IP })
		const response = await POST(context as APIContext)
		expect(prerender).toBe(false)
		expect(response.status).toBe(303)
		expect(submitted().headers.get('x-rush-client-ip')).toBe(VISITOR_IP)
	})

	it('forwards urlencoded fields, the visitor IP and the turnstile field token', async () => {
		const response = await post(
			urlencoded('name=Ana&interests=a&interests=b&cf-turnstile-response=tk-field')
		)
		const forwarded = submitted()
		const form = await asRequest(forwarded).formData()
		expect(forwarded.method).toBe('POST')
		expect(forwarded.headers.get('authorization')).toBe(`Bearer ${stub.api.token}`)
		expect(forwarded.headers.get('x-rush-client-ip')).toBe(VISITOR_IP)
		expect(forwarded.headers.get('x-captcha-token')).toBe('tk-field')
		expect(form.get('name')).toBe('Ana')
		expect(form.getAll('interests')).toEqual(['a', 'b'])
		expect(response.status).toBe(303)
		expect(response.headers.get('location')).toBe(
			'/contact?ref=nav&rush_form=contact&status=sent'
		)
	})

	it('forwards multipart bodies with files as FormData', async () => {
		const body = new FormData()
		body.set('name', 'Ana')
		body.set('cv', new File(['curriculum'], 'cv.txt', { type: 'text/plain' }))
		await post({ body, headers: { 'X-Captcha-Token': 'tk-header' } })
		const forwarded = submitted()
		const form = await asRequest(forwarded).formData()
		const file = form.get('cv')
		expect(forwarded.headers.get('content-type')).toMatch(/^multipart\/form-data; boundary=/)
		expect(forwarded.headers.get('x-captcha-token')).toBe('tk-header')
		expect(form.get('name')).toBe('Ana')
		expect(file).toBeInstanceOf(File)
		expect(await (file as File).text()).toBe('curriculum')
	})

	it('forwards JSON and answers JSON to fetch callers', async () => {
		const response = await post({
			body: JSON.stringify({ name: 'Ana', interests: ['a', 'b'] }),
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				Accept: 'application/json',
				'X-Captcha-Token': 'tk-header'
			}
		})
		const forwarded = submitted()
		expect(forwarded.headers.get('content-type')).toBe('application/json')
		expect(JSON.parse(new TextDecoder().decode(forwarded.body))).toEqual({
			name: 'Ana',
			interests: ['a', 'b']
		})
		expect(forwarded.headers.get('x-captcha-token')).toBe('tk-header')
		expect(response.status).toBe(201)
		expect(await response.json()).toEqual({ data: { received: true } })
	})

	it('prefers the turnstile field over the header', async () => {
		await post({
			body: JSON.stringify({ 'cf-turnstile-response': 'tk-field' }),
			headers: { 'Content-Type': 'application/json', 'X-Captcha-Token': 'tk-header' }
		})
		expect(submitted().headers.get('x-captcha-token')).toBe('tk-field')
	})

	it('omits the visitor IP and captcha headers when they are unavailable', async () => {
		const response = await submitForm(
			formContext({ ...urlencoded('name=Ana'), clientAddress: undefined })
		)
		expect(response.status).toBe(303)
		expect(submitted().headers.has('x-rush-client-ip')).toBe(false)
		expect(submitted().headers.has('x-captcha-token')).toBe(false)
	})

	it('passes API errors through as JSON', async () => {
		stub.handle(() => apiError(422, VALIDATION))
		const response = await post({
			body: '{"email":"nope"}',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
		})
		expect(response.status).toBe(422)
		expect(await response.json()).toEqual({
			error: 'validation failed',
			code: 'validation_failed',
			params: {},
			errors: VALIDATION.errors
		})
	})

	it('maps unreachable API errors to 502', async () => {
		stub.handle(() => new Response('<html>', { status: 200 }))
		const response = await post({
			body: '{}',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
		})
		expect(response.status).toBe(502)
		expect(await response.json()).toMatchObject({ code: 'invalid_response' })
	})

	it('redirects HTML posts back with status=error on API errors', async () => {
		stub.handle(() => apiError(422, VALIDATION))
		const response = await post(urlencoded('email=nope'))
		expect(response.status).toBe(303)
		expect(response.headers.get('location')).toBe(
			'/contact?ref=nav&rush_form=contact&status=error'
		)
	})

	it('replaces earlier rush_form results in the referrer', async () => {
		const response = await post({
			body: 'name=Ana',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Referer: `${ORIGIN}/contact?rush_form=contact&status=error#form`
			}
		})
		expect(response.headers.get('location')).toBe('/contact?rush_form=contact&status=sent')
	})

	it.each([
		['a cross-origin referrer', { Referer: 'https://evil.example/contact' }],
		['a referrer on another port', { Referer: 'https://site.example:8443/contact' }],
		['a malformed referrer', { Referer: 'not a url' }],
		['no referrer', {}]
	])('redirects to / for %s', async (_, headers: Record<string, string>) => {
		const response = await post({
			body: 'name=Ana',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers }
		})
		expect(response.status).toBe(303)
		expect(response.headers.get('location')).toBe('/')
	})

	it.each([
		['malformed JSON', 'application/json', '{'],
		['a JSON array', 'application/json', '[]'],
		['an unsupported content type', 'text/plain', 'name=Ana']
	])('answers 400 bad_request for %s without calling the API', async (_, type, body) => {
		const response = await post({
			body,
			headers: { 'Content-Type': type, Accept: 'application/json' }
		})
		expect(response.status).toBe(400)
		expect(await response.json()).toMatchObject({ code: 'bad_request' })
		expect(stub.requests).toEqual([])
	})
})
