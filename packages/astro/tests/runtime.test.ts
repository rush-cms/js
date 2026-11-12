import { createUrls } from '@rushcms/client'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { getLocale, getRush } from '../src/index'
import { createRushRuntime, resolveLocale } from '../src/runtime'
import type { LocaleRequest } from '../src/runtime'
import { SITE_PREFIX, envelope, siteExample, startStubApi } from './fixtures/api'
import type { StubApi } from './fixtures/api'
import {
	OFFLINE_API,
	collectionsOf,
	recordingLogger,
	routeContext,
	rushLocals,
	siteConfig
} from './fixtures/runtime'

type LocaleCase = {
	name: string
	localePaths: Record<string, string>
	request: LocaleRequest
	expected: string
}

type RejectedLocale = {
	request: LocaleRequest
	shown: string
}

let stub: StubApi

function current(code: string | undefined): LocaleRequest {
	return { segment: undefined, current: code, path: undefined }
}

function segment(param: string): LocaleRequest {
	return { segment: param, current: undefined, path: undefined }
}

function path(pathname: string): LocaleRequest {
	return { segment: undefined, current: undefined, path: pathname }
}

function siteRequests(): number {
	return stub.requests.filter((request) => request.path === `${SITE_PREFIX}/site`).length
}

beforeAll(async () => {
	stub = await startStubApi()
	stub.handle((request) =>
		request.path === `${SITE_PREFIX}/site` ? envelope(siteExample()) : envelope([])
	)
})

afterEach(() => {
	stub.requests.length = 0
})

afterAll(() => stub.close())

describe('resolveLocale', () => {
	const cases: LocaleCase[] = [
		{
			name: 'prefix',
			localePaths: { pt_BR: '', en: 'en' },
			request: current('en'),
			expected: 'en'
		},
		{
			name: 'path prefix',
			localePaths: { pt_BR: 'br', en: '' },
			request: current('br'),
			expected: 'pt_BR'
		},
		{
			name: 'BCP 47 code',
			localePaths: { pt_BR: 'pt', en: '' },
			request: current('pt-BR'),
			expected: 'pt_BR'
		},
		{
			name: 'lower-case code',
			localePaths: { pt_BR: 'pt', en: '' },
			request: current('pt-br'),
			expected: 'pt_BR'
		},
		{
			name: 'route param prefix',
			localePaths: { pt_BR: 'pt', en: '' },
			request: segment('pt'),
			expected: 'pt_BR'
		},
		{
			name: 'route param that is not a prefix, with the unprefixed request path',
			localePaths: { pt_BR: 'pt', en: '' },
			request: { segment: 'en', current: undefined, path: '/en/search.json' },
			expected: 'en'
		},
		{
			name: 'route param that is not a prefix, with Astro i18n',
			localePaths: { pt_BR: 'pt', en: '' },
			request: { segment: 'en', current: 'pt-BR', path: '/en/search.json' },
			expected: 'pt_BR'
		},
		{
			name: 'route param over Astro i18n',
			localePaths: { pt_BR: 'pt', en: 'en' },
			request: { segment: 'pt', current: 'en', path: '/es' },
			expected: 'pt_BR'
		},
		{
			name: 'Astro i18n over the request path',
			localePaths: { pt_BR: 'pt', en: 'en' },
			request: { segment: undefined, current: 'en', path: '/pt' },
			expected: 'en'
		},
		{
			name: 'matched request path',
			localePaths: { pt_BR: '', en: 'en' },
			request: path('/en'),
			expected: 'en'
		},
		{
			name: 'matched unprefixed request path',
			localePaths: { pt_BR: '', en: 'en' },
			request: path('/'),
			expected: 'pt_BR'
		},
		{
			name: 'unmatched path under a locale prefix',
			localePaths: { pt_BR: '', en: 'en' },
			request: path('/en/contact'),
			expected: 'en'
		},
		{
			name: 'unmatched path under a repeated slash',
			localePaths: { pt_BR: '', en: 'en' },
			request: path('//en//contact/'),
			expected: 'en'
		},
		{
			name: 'unknown first segment → unprefixed',
			localePaths: { pt_BR: '', en: 'en' },
			request: path('/xx/contact'),
			expected: 'pt_BR'
		},
		{
			name: 'upper-case prefix → unprefixed',
			localePaths: { pt_BR: '', en: 'en' },
			request: path('/EN/contact'),
			expected: 'pt_BR'
		},
		{
			name: 'unknown first segment → site default',
			localePaths: { es: 'es', en: 'en' },
			request: path('/xx/contact'),
			expected: 'en'
		},
		{
			name: 'prefixed request path without an unprefixed locale',
			localePaths: { es: 'es', en: 'en' },
			request: path('/es/contacto'),
			expected: 'es'
		},
		{
			name: 'none → unprefixed',
			localePaths: { en: 'en', es: '' },
			request: current(undefined),
			expected: 'es'
		},
		{
			name: 'none → site default',
			localePaths: { en: 'en', es: 'es' },
			request: current(undefined),
			expected: 'en'
		}
	]

	it.each(cases)('maps $name', ({ localePaths, request, expected }) => {
		const config = siteConfig({ localePaths, defaultLocale: 'en' })
		expect(resolveLocale(createUrls(config), config.defaultLocale, request)).toBe(expected)
	})

	const rejected: RejectedLocale[] = [
		...['pt', 'fr', 'constructor'].map((code) => ({ request: current(code), shown: code }))
	]

	it.each(rejected)('throws for "$shown", which matches no entry', ({ request, shown }) => {
		const config = siteConfig({ localePaths: { pt_BR: '', en: 'en' } })
		expect(() => resolveLocale(createUrls(config), config.defaultLocale, request)).toThrow(
			`locale "${shown}" matches no localePaths entry`
		)
	})
})

describe('getRush', () => {
	it('binds the client to the route locale and the configured urls', async () => {
		const config = siteConfig({
			routes: { blog: '/{locale}/blog/{slug}' },
			collections: collectionsOf('articles', { en: 'blog' })
		})
		const client = getRush(
			routeContext({ locals: rushLocals(stub.api, config), currentLocale: 'es' })
		)
		await client.collections.list()
		expect(stub.requests[0]?.query.get('locale')).toBe('es')
		expect(client.routes).toEqual(config.routes)
		expect(client.localePaths).toEqual(config.localePaths)
	})

	it('reads the locale from a [locale] param before Astro i18n', async () => {
		const locals = rushLocals(stub.api)
		await getRush(
			routeContext({ locals, currentLocale: undefined, params: { locale: 'es' } })
		).collections.list()
		await getRush(
			routeContext({ locals, currentLocale: 'en', params: { locale: 'es' } })
		).collections.list()
		expect(stub.requests.map((request) => request.query.get('locale'))).toEqual(['es', 'es'])
		await getRush(
			routeContext({ locals, currentLocale: undefined, params: { locale: 'xx' } })
		).collections.list()
		expect(stub.requests.map((request) => request.query.get('locale'))).toEqual([
			'es',
			'es',
			'pt_BR'
		])
	})

	it('reads the locale from the request path on a route without a locale param', async () => {
		const locals = rushLocals(stub.api)
		for (const pathname of ['/en', '/en/blog/page/2', '/es/missing', '/', '/xx/contact']) {
			await getRush(routeContext({ locals, path: pathname })).collections.list()
		}
		expect(stub.requests.map((request) => request.query.get('locale'))).toEqual([
			'en',
			'en',
			'es',
			'pt_BR',
			'pt_BR'
		])
	})

	it('shares one memoized client per locale for prerendered builds', async () => {
		const locals = rushLocals(stub.api)
		const first = getRush(routeContext({ locals, currentLocale: 'en', isPrerendered: true }))
		await first.site.get()
		const second = getRush(routeContext({ locals, currentLocale: 'en', isPrerendered: true }))
		await second.site.get()
		expect(second).toBe(first)
		expect(
			getRush(routeContext({ locals, currentLocale: 'es', isPrerendered: true }))
		).not.toBe(first)
		expect(siteRequests()).toBe(1)
	})

	it('uses a fresh client without memo on demand', async () => {
		const locals = rushLocals(stub.api)
		const first = getRush(routeContext({ locals, currentLocale: 'en' }))
		await first.site.get()
		await first.site.get()
		expect(getRush(routeContext({ locals, currentLocale: 'en' }))).not.toBe(first)
		expect(siteRequests()).toBe(2)
	})

	it('never memoizes when the site config turns memo off', async () => {
		const locals = rushLocals(stub.api, siteConfig({ memo: false }))
		const first = getRush(routeContext({ locals, currentLocale: 'en', isPrerendered: true }))
		await first.site.get()
		await first.site.get()
		expect(
			getRush(routeContext({ locals, currentLocale: 'en', isPrerendered: true }))
		).not.toBe(first)
		expect(siteRequests()).toBe(2)
	})

	it('throws when the middleware did not run', () => {
		expect(() =>
			getRush(routeContext({ locals: {}, currentLocale: 'en', isPrerendered: true }))
		).toThrow('middleware did not run')
	})
})

describe('getLocale', () => {
	it('answers the locale getRush binds to', () => {
		const locals = rushLocals(stub.api)
		expect(getLocale(routeContext({ locals, path: '/en/no/such/page' }))).toBe('en')
		expect(getLocale(routeContext({ locals, path: '/xx/contact' }))).toBe('pt_BR')
		expect(getLocale(routeContext({ locals, path: '/es', params: { locale: 'en' } }))).toBe(
			'en'
		)
		expect(getLocale(routeContext({ locals, params: { locale: 'xx' } }))).toBe('pt_BR')
		expect(() => getLocale(routeContext({ locals, currentLocale: 'xx' }))).toThrow(
			'matches no localePaths entry'
		)
	})
})

describe('warnOnce', () => {
	it('logs each message once per runtime, preview runtimes included', () => {
		const runtime = createRushRuntime({ api: OFFLINE_API, config: siteConfig() })
		const logger = recordingLogger()
		runtime.warnOnce(logger, 'first')
		runtime.preview('preview-token').warnOnce(logger, 'first')
		runtime.preview('preview-token').warnOnce(logger, 'second')
		runtime.warnOnce(logger, 'second')
		createRushRuntime({ api: OFFLINE_API, config: siteConfig() }).warnOnce(logger, 'first')
		expect(logger.warnings).toEqual(['first', 'second', 'first'])
	})
})
