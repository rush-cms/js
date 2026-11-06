import type { APIContext } from 'astro'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { submitForm } from '../src/forms'
import type { FormContext } from '../src/forms'
import { POST, prerender } from '../src/routes/forms'
import { FORWARDED_WITHOUT_PROXIES_WARNING, SHORT_PROXY_CHAIN_WARNING } from '../src/visitor-ip'
import { SITE_PREFIX, apiError, asRequest, envelope, startStubApi } from './fixtures/api'
import type { StubApi, StubRequest } from './fixtures/api'
import { recordingLogger, rushLocals, siteConfig } from './fixtures/runtime'
import type { RecordingLogger } from './fixtures/runtime'
import type { RushApiSettings } from '../src/settings'

type PostOptions = {
	body: BodyInit
	headers?: Record<string, string>
	clientAddress?: string | undefined
	api?: RushApiSettings
	trustedProxies?: number
	locals?: object
	logger?: RecordingLogger
}

type WarnedPosts = {
	name: string
	trustedProxies: number
	forwardedFor: (string | null)[]
	expected: string[]
}

type PageFormContext = FormContext & Pick<APIContext, 'currentLocale' | 'isPrerendered'>

const ORIGIN = 'https://site.example'
const VISITOR_IP = '203.0.113.7'
const SUBMIT_PATH = `${SITE_PREFIX}/forms/contact/submit`
const VALIDATION = {
	error: 'validation failed',
	code: 'validation_failed',
	errors: [{ field: 'email', code: 'invalid_email' }]
}

const WARNED_POSTS: WarnedPosts[] = [
	{
		name: 'warns once per runtime when X-Forwarded-For arrives without trusted proxies',
		trustedProxies: 0,
		forwardedFor: [null, '198.51.100.1', '198.51.100.2, 198.51.100.3', ''],
		expected: [FORWARDED_WITHOUT_PROXIES_WARNING]
	},
	{
		name: 'does not warn without trusted proxies when no X-Forwarded-For arrives',
		trustedProxies: 0,
		forwardedFor: [null, null],
		expected: []
	},
	{
		name: 'warns once per runtime when the chain is shorter than the trusted proxies',
		trustedProxies: 2,
		forwardedFor: [`${VISITOR_IP}, 10.0.0.1`, VISITOR_IP, null, '10.0.0.1'],
		expected: [SHORT_PROXY_CHAIN_WARNING]
	},
	{
		name: 'does not warn when every trusted proxy appended its entry',
		trustedProxies: 2,
		forwardedFor: [`198.51.100.1, ${VISITOR_IP}, 10.0.0.1`, `${VISITOR_IP}, 10.0.0.1`],
		expected: []
	}
]

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
		locals:
			options.locals ??
			rushLocals(
				options.api ?? stub.api,
				siteConfig({ trustedProxies: options.trustedProxies ?? 0 })
			),
		logger: options.logger ?? recordingLogger()
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

	it.each([
		['an HTML post', {}, 303],
		['a fetch call', { Accept: 'application/json' }, 201]
	])(
		'ignores a page locale missing from localePaths for %s',
		async (_, accept: Record<string, string>, status) => {
			const options = urlencoded('name=Ana')
			const context: PageFormContext = {
				...formContext({
					...options,
					headers: { ...options.headers, ...accept },
					clientAddress: VISITOR_IP
				}),
				params: { key: 'contact', locale: 'xx' },
				currentLocale: 'xx',
				isPrerendered: false
			}
			const response = await POST(context as APIContext)
			expect(response.status).toBe(status)
			expect(submitted().path).toBe(SUBMIT_PATH)
		}
	)

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
			`${ORIGIN}/contact?ref=nav&rush_form=contact&status=sent`
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

	it('never forwards a forged X-Forwarded-For without trusted proxies', async () => {
		const options = urlencoded('name=Ana')
		await post({
			...options,
			headers: { ...options.headers, 'X-Forwarded-For': '198.51.100.1, 198.51.100.2' },
			clientAddress: '198.51.100.1'
		})
		expect(submitted().headers.has('x-rush-client-ip')).toBe(false)
	})

	it('forwards the socket address when Astro did not read X-Forwarded-For', async () => {
		const options = urlencoded('name=Ana')
		await post({
			...options,
			headers: { ...options.headers, 'X-Forwarded-For': '198.51.100.1' }
		})
		expect(submitted().headers.get('x-rush-client-ip')).toBe(VISITOR_IP)
	})

	it('forwards the address the trusted proxy appended', async () => {
		const options = urlencoded('name=Ana')
		await post({
			...options,
			headers: {
				...options.headers,
				'X-Forwarded-For': `198.51.100.1, ${VISITOR_IP}, 10.0.0.1`
			},
			clientAddress: '198.51.100.1',
			trustedProxies: 2
		})
		expect(submitted().headers.get('x-rush-client-ip')).toBe(VISITOR_IP)
	})

	it.each(WARNED_POSTS)('$name', async ({ trustedProxies, forwardedFor, expected }) => {
		const locals = rushLocals(stub.api, siteConfig({ trustedProxies }))
		const logger = recordingLogger()
		const options = urlencoded('name=Ana')
		for (const header of forwardedFor) {
			const forwarded = header === null ? {} : { 'X-Forwarded-For': header }
			await post({
				...options,
				headers: { ...options.headers, ...forwarded },
				locals,
				logger
			})
		}
		expect(logger.warnings).toEqual(expected)
	})

	it('passes API errors through as JSON', async () => {
		stub.handle(() => apiError(422, VALIDATION))
		const response = await post({
			body: '{"email":"nope"}',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
		})
		expect(response.status).toBe(422)
		expect(await response.json()).toEqual({
			code: 'validation_failed',
			params: {},
			errors: VALIDATION.errors
		})
	})

	it('maps an invalid_response from the API to 502', async () => {
		stub.handle(() => new Response('<html>', { status: 200 }))
		const response = await post({
			body: '{}',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
		})
		expect(response.status).toBe(502)
		expect(await response.json()).toMatchObject({ code: 'invalid_response' })
	})

	it('maps a network_error to 502 without leaking the API location', async () => {
		const offline = await startStubApi()
		await offline.close()
		const response = await post({
			body: '{}',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			api: offline.api
		})
		const body = await response.text()
		expect(response.status).toBe(502)
		expect(JSON.parse(body)).toEqual({ code: 'network_error', params: {}, errors: [] })
		expect(body).not.toContain(offline.api.url)
		expect(body).not.toContain(offline.api.siteId)
	})

	it('redirects HTML posts back with status=error on API errors', async () => {
		stub.handle(() => apiError(422, VALIDATION))
		const response = await post(urlencoded('email=nope'))
		expect(response.status).toBe(303)
		expect(response.headers.get('location')).toBe(
			`${ORIGIN}/contact?ref=nav&rush_form=contact&status=error`
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
		expect(response.headers.get('location')).toBe(
			`${ORIGIN}/contact?rush_form=contact&status=sent`
		)
	})

	it.each([
		['a cross-origin referrer', { Referer: 'https://evil.example/contact' }, '/'],
		['a referrer on another port', { Referer: 'https://site.example:8443/contact' }, '/'],
		['a malformed referrer', { Referer: 'not a url' }, '/'],
		['no referrer', {}, '/'],
		[
			'a same-origin referrer with a // path',
			{ Referer: `${ORIGIN}//evil.example/x` },
			`${ORIGIN}//evil.example/x?rush_form=contact&status=sent`
		],
		[
			'a same-origin referrer with a /\\ path',
			{ Referer: `${ORIGIN}/\\evil.example` },
			`${ORIGIN}//evil.example?rush_form=contact&status=sent`
		]
	])(
		'keeps the redirect on the site origin for %s',
		async (_, headers: Record<string, string>, location) => {
			const response = await post({
				body: 'name=Ana',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers }
			})
			const target = response.headers.get('location') ?? ''
			expect(response.status).toBe(303)
			expect(target).toBe(location)
			expect(new URL(target, ORIGIN).origin).toBe(ORIGIN)
		}
	)

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
