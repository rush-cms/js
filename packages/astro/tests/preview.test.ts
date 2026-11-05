import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Entry } from '@rushcms/client'
import { responseExample } from '../../client/tests/fixtures/contract'
import { getRush } from '../src/index'
import { PREVIEW_COOKIE, createRushMiddleware, exitPreview, startPreview } from '../src/preview'
import type { PreviewContext, RushMiddlewareContext } from '../src/preview'
import { createRushRuntime } from '../src/runtime'
import type { RushSiteConfig } from '../src/config'
import { SITE_PREFIX, apiError, envelope, siteExample, startStubApi } from './fixtures/api'
import type { StubApi, StubHandler, StubRequest } from './fixtures/api'
import { rushLocals, siteConfig } from './fixtures/runtime'

type ParamCase = {
	name: string
	params: Record<string, string>
}

type RejectionCase = {
	status: number
	code: string
	expected: number
}

const ORIGIN = 'https://preview.example'
const NOW = 1_800_000_000
const ARTICLES = '01JC3E28JT97KB6CQ643DZVMXX'
const ENTRY_PATH = `${SITE_PREFIX}/collections/blog/entries/hello-world`
const SECURE_FLAGS = 'Path=/; Max-Age=3600; HttpOnly; SameSite=Lax; Secure'

let stub: StubApi

function base64Url(value: string): string {
	return Buffer.from(value).toString('base64url')
}

function previewToken(claims: Record<string, unknown>): string {
	return `rush_prv_${base64Url(JSON.stringify(claims))}.${base64Url('signature')}`
}

function expiringToken(exp: number): string {
	return previewToken({ site_id: 'site', user_id: 'user', iat: NOW - 60, exp })
}

const TOKEN = expiringToken(NOW + 3600)

function entryExample(): Entry {
	return (responseExample('EntryOk') as { data: Entry }).data
}

function previewConfig(overrides: Partial<RushSiteConfig> = {}): RushSiteConfig {
	return siteConfig({
		localePaths: { pt_BR: '', en: 'en', es: 'es' },
		routes: { artigos: '/{locale}/posts/{slug}' },
		routeKeysById: { [ARTICLES]: 'artigos' },
		memo: false,
		preview: true,
		...overrides
	})
}

function previewContext(
	query: Record<string, string>,
	config: RushSiteConfig = previewConfig(),
	origin: string = ORIGIN
): PreviewContext {
	const url = new URL('/_rush/preview', origin)
	for (const [name, value] of Object.entries(query)) {
		url.searchParams.set(name, value)
	}
	return { url, locals: rushLocals(stub.api, config) }
}

function entryQuery(token: string = TOKEN): Record<string, string> {
	return { token, locale: 'en', collection: 'blog', slug: 'hello-world' }
}

function serveEntry(entry: Entry = entryExample()): StubHandler {
	return (request) => {
		if (request.path === `${SITE_PREFIX}/site`) {
			return envelope(siteExample())
		}
		return request.path === ENTRY_PATH
			? envelope({ ...entry, locale: request.query.get('locale') })
			: apiError(404, { error: 'not found', code: 'not_found' })
	}
}

function requestLine(request: StubRequest): string {
	return `${request.path}?${request.query} ${request.headers.get('authorization')}`
}

beforeAll(async () => {
	stub = await startStubApi()
})

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] })
	vi.setSystemTime(NOW * 1000)
	stub.handle(serveEntry())
})

afterEach(() => {
	vi.useRealTimers()
	stub.requests.length = 0
})

afterAll(() => stub.close())

describe('GET /_rush/preview', () => {
	it('validates the token, sets the HttpOnly cookie and redirects to the entry url', async () => {
		const response = await startPreview(previewContext(entryQuery()))
		expect(response.status).toBe(303)
		expect(response.headers.get('location')).toBe(`${ORIGIN}/en/posts/hello-world`)
		expect(response.headers.get('set-cookie')).toBe(
			`${PREVIEW_COOKIE}=${TOKEN}; ${SECURE_FLAGS}`
		)
		expect(response.headers.get('cache-control')).toBe('no-store')
		expect(response.headers.get('x-robots-tag')).toBe('noindex')
		expect(stub.requests.map(requestLine)).toEqual([
			`${SITE_PREFIX}/site?perspective=draft Bearer ${TOKEN}`,
			`${ENTRY_PATH}?locale=en&perspective=draft Bearer ${TOKEN}`
		])
	})

	it('redirects to the homepage url without collection and slug', async () => {
		const response = await startPreview(previewContext({ token: TOKEN, locale: 'es' }))
		expect(response.headers.get('location')).toBe(`${ORIGIN}/es`)
		expect(response.headers.get('set-cookie')).toBe(
			`${PREVIEW_COOKIE}=${TOKEN}; ${SECURE_FLAGS}`
		)
		expect(stub.requests.map((request) => request.path)).toEqual([`${SITE_PREFIX}/site`])
	})

	it.each(['http://localhost:4321', 'http://127.0.0.1:4321', 'http://[::1]:4321'])(
		'drops Secure on %s',
		async (origin) => {
			const response = await startPreview(
				previewContext({ token: TOKEN, locale: 'pt_BR' }, previewConfig(), origin)
			)
			expect(response.headers.get('location')).toBe(`${origin}/`)
			expect(response.headers.get('set-cookie')).toBe(
				`${PREVIEW_COOKIE}=${TOKEN}; Path=/; Max-Age=3600; HttpOnly; SameSite=Lax`
			)
		}
	)

	it('sets Max-Age to the seconds left before the token expires', async () => {
		const response = await startPreview(previewContext(entryQuery(expiringToken(NOW + 1))))
		expect(response.headers.get('set-cookie')).toContain('; Max-Age=1;')
	})

	it.each([NOW, NOW - 60])('rejects a token whose expiry %s has passed', async (exp) => {
		const response = await startPreview(previewContext(entryQuery(expiringToken(exp))))
		expect(response.status).toBe(401)
		expect(response.headers.get('set-cookie')).toBeNull()
	})

	const rejections: RejectionCase[] = [
		{ status: 401, code: 'token_expired', expected: 401 },
		{ status: 401, code: 'unauthorized', expected: 401 },
		{ status: 403, code: 'forbidden', expected: 401 },
		{ status: 500, code: 'internal', expected: 502 }
	]

	it.each(rejections)(
		'answers $expected without a cookie when /site answers $status $code',
		async ({ status, code, expected }) => {
			stub.handle(() => apiError(status, { error: 'nope', code }))
			const response = await startPreview(previewContext(entryQuery()))
			expect(response.status).toBe(expected)
			expect(response.headers.get('set-cookie')).toBeNull()
			expect(await response.text()).not.toContain(TOKEN)
			expect(stub.requests.map((request) => request.path)).toEqual([`${SITE_PREFIX}/site`])
		}
	)

	it('answers 404 without a cookie when the entry does not exist', async () => {
		const query = { ...entryQuery(), slug: 'missing' }
		const response = await startPreview(previewContext(query))
		expect(response.status).toBe(404)
		expect(response.headers.get('set-cookie')).toBeNull()
	})

	it('refuses a target url that leaves the site origin', async () => {
		const entry = entryExample()
		const hostile = {
			...entry,
			translations: {
				...entry.translations,
				en: { slug: '/evil.example', collection_slug: 'blog' }
			}
		}
		stub.handle(serveEntry(hostile))
		const config = previewConfig({ routes: { artigos: '/{slug}' } })
		const response = await startPreview(previewContext(entryQuery(), config))
		expect(response.status).toBe(400)
		expect(response.headers.get('set-cookie')).toBeNull()
	})

	const invalid: ParamCase[] = [
		{ name: 'no token', params: { locale: 'en' } },
		{ name: 'a delivery token', params: { token: 'rush_live_abc', locale: 'en' } },
		{ name: 'a token without signature', params: { token: 'rush_prv_abc', locale: 'en' } },
		{
			name: 'a payload that is not JSON',
			params: { token: `rush_prv_${base64Url('nope')}.sig`, locale: 'en' }
		},
		{
			name: 'a payload without exp',
			params: { token: previewToken({ site_id: 'site' }), locale: 'en' }
		},
		{
			name: 'a non-integer exp',
			params: { token: previewToken({ exp: `${NOW + 60}` }), locale: 'en' }
		},
		{ name: 'no locale', params: { token: TOKEN } },
		{ name: 'an unknown locale', params: { token: TOKEN, locale: 'fr' } },
		{ name: 'a prototype key locale', params: { token: TOKEN, locale: 'constructor' } },
		{
			name: 'a collection without slug',
			params: { token: TOKEN, locale: 'en', collection: 'blog' }
		},
		{ name: 'a slug without collection', params: { token: TOKEN, locale: 'en', slug: 'x' } }
	]

	it.each(invalid)('answers 400 for $name without calling the API', async ({ params }) => {
		const response = await startPreview(previewContext(params))
		expect(response.status).toBe(400)
		expect(response.headers.get('set-cookie')).toBeNull()
		expect(await response.text()).toBe('Invalid preview link')
		expect(stub.requests).toEqual([])
	})

	it('answers 404 outside preview mode without calling the API', async () => {
		const config = previewConfig({ preview: false })
		const response = await startPreview(previewContext(entryQuery(), config))
		expect(response.status).toBe(404)
		expect(response.headers.get('set-cookie')).toBeNull()
		expect(stub.requests).toEqual([])
	})
})

describe('GET /_rush/preview/exit', () => {
	const CLEARED = `${PREVIEW_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`

	it.each([
		[undefined, '/'],
		['/en/posts/hello-world?draft=1', `${ORIGIN}/en/posts/hello-world?draft=1`],
		['https://evil.example/x', '/'],
		['//evil.example/x', '/'],
		['/\\evil.example', '/']
	])('clears the cookie and redirects return=%s to %s', (target, location) => {
		const query: Record<string, string> = target === undefined ? {} : { return: target }
		const response = exitPreview(previewContext(query))
		expect(response.status).toBe(303)
		expect(response.headers.get('location')).toBe(location)
		expect(response.headers.get('set-cookie')).toBe(CLEARED)
	})

	it('answers 404 outside preview mode', () => {
		const response = exitPreview(previewContext({}, previewConfig({ preview: false })))
		expect(response.status).toBe(404)
		expect(response.headers.get('set-cookie')).toBeNull()
	})
})

describe('middleware', () => {
	type Pass = {
		context: RushMiddlewareContext
		response: Response
	}

	async function pass(
		config: RushSiteConfig,
		cookie: string | undefined,
		page: Response = new Response('page')
	): Promise<Pass> {
		const context: RushMiddlewareContext = {
			locals: {},
			cookies: {
				get: (name) =>
					name === PREVIEW_COOKIE && cookie !== undefined ? { value: cookie } : undefined
			}
		}
		const middleware = createRushMiddleware(createRushRuntime({ api: stub.api, config }))
		const response = await middleware(context, () => Promise.resolve(page))
		return { context, response }
	}

	async function siteRequest(context: RushMiddlewareContext): Promise<string> {
		await getRush({
			locals: context.locals,
			currentLocale: 'en',
			isPrerendered: false,
			params: {}
		}).site.get()
		const request = stub.requests.at(-1)
		if (request === undefined) {
			throw new Error('no API request')
		}
		return requestLine(request)
	}

	it('reads drafts with the cookie token in preview mode', async () => {
		const { context, response } = await pass(previewConfig(), TOKEN)
		expect(await siteRequest(context)).toBe(
			`${SITE_PREFIX}/site?perspective=draft Bearer ${TOKEN}`
		)
		expect(response.headers.get('x-robots-tag')).toBe('noindex')
		expect(response.headers.get('cache-control')).toBe('no-store')
	})

	it.each([undefined, '', 'rush_live_secret', `${TOKEN}\r\nX-Evil: 1`])(
		'reads published content with the delivery token for cookie %j in preview mode',
		async (cookie) => {
			const { context, response } = await pass(previewConfig(), cookie)
			expect(await siteRequest(context)).toBe(`${SITE_PREFIX}/site? Bearer ${stub.api.token}`)
			expect(response.headers.get('x-robots-tag')).toBe('noindex')
		}
	)

	it('never reads the cookie in production mode', async () => {
		const { context, response } = await pass(previewConfig({ preview: false }), TOKEN)
		expect(await siteRequest(context)).toBe(`${SITE_PREFIX}/site? Bearer ${stub.api.token}`)
		expect(response.headers.get('x-robots-tag')).toBeNull()
	})

	it('copies a response with immutable headers to mark it noindex', async () => {
		const { response } = await pass(
			previewConfig(),
			undefined,
			Response.redirect(`${ORIGIN}/en`, 302)
		)
		expect(response.status).toBe(302)
		expect(response.headers.get('location')).toBe(`${ORIGIN}/en`)
		expect(response.headers.get('x-robots-tag')).toBe('noindex')
	})

	it('builds a fresh client per request in preview mode', async () => {
		const { context } = await pass(previewConfig({ memo: true }), TOKEN)
		const page = {
			locals: context.locals,
			currentLocale: 'en',
			isPrerendered: true,
			params: {}
		}
		expect(getRush(page)).not.toBe(getRush(page))
	})
})
