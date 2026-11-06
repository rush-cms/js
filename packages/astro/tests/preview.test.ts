import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Entry } from '@rushcms/client'
import { entryExample } from '../../client/tests/fixtures/contract'
import { getRush } from '../src/index'
import { PREVIEW_COOKIE, createRushMiddleware, exitPreview, startPreview } from '../src/preview'
import type { PreviewContext, RushMiddlewareContext } from '../src/preview'
import { createRushRuntime } from '../src/runtime'
import type { RushSiteConfig } from '../src/config'
import { SITE_PREFIX, apiError, envelope, siteExample, startStubApi } from './fixtures/api'
import type { StubApi, StubHandler, StubRequest } from './fixtures/api'
import { collectionsOf, routeContext, rushLocals, siteConfig } from './fixtures/runtime'
import { COLLECTION_SLUGS } from '../../client/tests/fixtures/slugs'

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

function previewConfig(overrides: Partial<RushSiteConfig> = {}): RushSiteConfig {
	return siteConfig({
		localePaths: { pt_BR: '', en: 'en', es: 'es' },
		routes: { artigos: '/{locale}/posts/{slug}' },
		collections: collectionsOf(ARTICLES, COLLECTION_SLUGS),
		memo: false,
		preview: true,
		...overrides
	})
}

function hostRequest(url: URL, headers: Record<string, string>): Request {
	return new Request(url, { headers: { host: url.host, ...headers } })
}

function previewContext(
	query: Record<string, string>,
	config: RushSiteConfig = previewConfig(),
	origin: string = ORIGIN,
	headers: Record<string, string> = {}
): PreviewContext {
	const url = new URL('/_rush/preview', origin)
	for (const [name, value] of Object.entries(query)) {
		url.searchParams.set(name, value)
	}
	return { url, request: hostRequest(url, headers), locals: rushLocals(stub.api, config) }
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

describe('untrusted preview hosts', () => {
	const LOCAL = 'http://localhost:4321'

	it.each([
		['a public Host', { host: 'preview.example' }],
		['a public X-Forwarded-Host', { 'x-forwarded-host': 'localhost:4321, preview.example' }],
		['a Host hiding a public name', { host: 'localhost@preview.example' }]
	])('fails closed with %s behind a localhost url', async (_, headers) => {
		const start = await startPreview(
			previewContext(entryQuery(), previewConfig(), LOCAL, headers)
		)
		const exit = exitPreview(previewContext({}, previewConfig(), LOCAL, headers))
		for (const response of [start, exit]) {
			expect(response.status).toBe(500)
			expect(response.headers.get('set-cookie')).toBeNull()
			expect(await response.text()).toBe('Preview host not trusted')
		}
		expect(stub.requests).toEqual([])
	})

	it('accepts loopback Host and X-Forwarded-Host values without Secure', async () => {
		const headers = { 'x-forwarded-host': '127.0.0.1:4321, [::1]' }
		const query = { token: TOKEN, locale: 'pt_BR' }
		const response = await startPreview(previewContext(query, previewConfig(), LOCAL, headers))
		expect(response.status).toBe(303)
		expect(response.headers.get('set-cookie')).not.toContain('Secure')
	})
})

describe('middleware', () => {
	type Pass = {
		context: RushMiddlewareContext
		response: Response
		lines: string[]
		cookieReads: number
	}

	type PassOptions = {
		page?: Response
		reads?: number
	}

	async function pass(
		config: RushSiteConfig,
		cookie: string | undefined,
		options: PassOptions = {}
	): Promise<Pass> {
		const url = new URL('/en', ORIGIN)
		const get = vi.fn((name: string) =>
			name === PREVIEW_COOKIE && cookie !== undefined ? { value: cookie } : undefined
		)
		const context: RushMiddlewareContext = {
			url,
			request: hostRequest(url, {}),
			locals: {},
			cookies: { get }
		}
		const page = routeContext({ locals: context.locals, currentLocale: 'en' })
		const middleware = createRushMiddleware(createRushRuntime({ api: stub.api, config }))
		const response = await middleware(context, async () => {
			for (let read = 0; read < (options.reads ?? 1); read++) {
				await getRush(page).site.get()
			}
			return options.page ?? new Response('page')
		})
		return {
			context,
			response,
			lines: stub.requests.map(requestLine),
			cookieReads: get.mock.calls.length
		}
	}

	const DRAFT = `${SITE_PREFIX}/site?perspective=draft Bearer ${TOKEN}`

	function published(): string {
		return `${SITE_PREFIX}/site? Bearer ${stub.api.token}`
	}

	it('reads drafts with the cookie token in preview mode', async () => {
		const { lines, response } = await pass(previewConfig(), TOKEN)
		expect(lines).toEqual([DRAFT])
		expect(response.headers.get('x-robots-tag')).toBe('noindex')
		expect(response.headers.get('cache-control')).toBe('no-store')
		expect(response.headers.get('set-cookie')).toBeNull()
	})

	it.each([undefined, '', 'rush_live_secret', `${TOKEN}\r\nX-Evil: 1`])(
		'reads published content with the delivery token for cookie %j in preview mode',
		async (cookie) => {
			const { lines, response } = await pass(previewConfig(), cookie)
			expect(lines).toEqual([published()])
			expect(response.headers.get('x-robots-tag')).toBe('noindex')
		}
	)

	it('never reads the cookie in production mode', async () => {
		const { lines, response, cookieReads } = await pass(
			previewConfig({ preview: false }),
			TOKEN
		)
		expect(cookieReads).toBe(0)
		expect(lines).toEqual([published()])
		expect(response.headers.get('x-robots-tag')).toBeNull()
	})

	it('falls back to published content and clears the cookie when the token is refused', async () => {
		stub.handle((request) =>
			request.headers.get('authorization') === `Bearer ${TOKEN}`
				? apiError(401, { error: 'expired', code: 'token_expired' })
				: envelope(siteExample())
		)
		const { lines, response } = await pass(previewConfig(), TOKEN, { reads: 2 })
		expect(lines).toEqual([DRAFT, published(), published()])
		expect(response.status).toBe(200)
		expect(response.headers.get('set-cookie')).toBe(
			`${PREVIEW_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`
		)
	})

	it('copies a response with immutable headers to mark it noindex', async () => {
		const { response } = await pass(previewConfig(), undefined, {
			page: Response.redirect(`${ORIGIN}/en`, 302)
		})
		expect(response.status).toBe(302)
		expect(response.headers.get('location')).toBe(`${ORIGIN}/en`)
		expect(response.headers.get('x-robots-tag')).toBe('noindex')
	})

	it('builds a fresh client per request in preview mode', async () => {
		const { context } = await pass(previewConfig({ memo: true }), TOKEN)
		const page = routeContext({
			locals: context.locals,
			currentLocale: 'en',
			isPrerendered: true
		})
		expect(getRush(page)).not.toBe(getRush(page))
	})
})
