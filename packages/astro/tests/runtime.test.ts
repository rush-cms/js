import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { getRush } from '../src/index'
import { resolveLocale } from '../src/runtime'
import type { RushContext } from '../src/runtime'
import { SITE_PREFIX, envelope, siteExample, startStubApi } from './fixtures/api'
import type { StubApi } from './fixtures/api'
import { rushLocals, siteConfig } from './fixtures/runtime'

type LocaleCase = {
	name: string
	localePaths: Record<string, string>
	current: string | undefined
	expected: string
}

let stub: StubApi

function context(
	locals: object,
	currentLocale: string | undefined,
	isPrerendered: boolean,
	params: Record<string, string | undefined> = {}
): RushContext {
	return { locals, currentLocale, isPrerendered, params }
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
		{ name: 'prefix', localePaths: { pt_BR: '', en: 'en' }, current: 'en', expected: 'en' },
		{
			name: 'path prefix',
			localePaths: { pt_BR: 'br', en: '' },
			current: 'br',
			expected: 'pt_BR'
		},
		{
			name: 'BCP 47 code',
			localePaths: { pt_BR: 'pt', en: '' },
			current: 'pt-BR',
			expected: 'pt_BR'
		},
		{
			name: 'lower-case code',
			localePaths: { pt_BR: 'pt', en: '' },
			current: 'pt-br',
			expected: 'pt_BR'
		},
		{
			name: 'none → unprefixed',
			localePaths: { en: 'en', es: '' },
			current: undefined,
			expected: 'es'
		},
		{
			name: 'none → site default',
			localePaths: { en: 'en', es: 'es' },
			current: undefined,
			expected: 'en'
		}
	]

	it.each(cases)('maps $name', ({ localePaths, current, expected }) => {
		expect(resolveLocale(siteConfig({ localePaths, defaultLocale: 'en' }), current)).toBe(
			expected
		)
	})

	it.each(['pt', 'fr', 'constructor'])('throws for "%s", which matches no entry', (current) => {
		const config = siteConfig({ localePaths: { pt_BR: '', en: 'en' } })
		expect(() => resolveLocale(config, current)).toThrow(
			`locale "${current}" matches no localePaths entry`
		)
	})
})

describe('getRush', () => {
	it('binds the client to the route locale and the configured urls', async () => {
		const config = siteConfig({ routes: { blog: '/{locale}/blog/{slug}' } })
		const client = getRush(context(rushLocals(stub.api, config), 'es', false))
		await client.collections.list()
		expect(stub.requests[0]?.query.get('locale')).toBe('es')
		expect(client.routes).toEqual(config.routes)
		expect(client.localePaths).toEqual(config.localePaths)
	})

	it('reads the locale from a [locale] param when Astro i18n is not configured', async () => {
		const locals = rushLocals(stub.api)
		await getRush(context(locals, undefined, false, { locale: 'es' })).collections.list()
		await getRush(context(locals, 'en', false, { locale: 'es' })).collections.list()
		expect(stub.requests.map((request) => request.query.get('locale'))).toEqual(['es', 'en'])
		expect(() => getRush(context(locals, undefined, false, { locale: 'xx' }))).toThrow(
			'matches no localePaths entry'
		)
	})

	it('shares one memoized client per locale for prerendered builds', async () => {
		const locals = rushLocals(stub.api)
		const first = getRush(context(locals, 'en', true))
		await first.site.get()
		const second = getRush(context(locals, 'en', true))
		await second.site.get()
		expect(second).toBe(first)
		expect(getRush(context(locals, 'es', true))).not.toBe(first)
		expect(siteRequests()).toBe(1)
	})

	it('uses a fresh client without memo on demand', async () => {
		const locals = rushLocals(stub.api)
		const first = getRush(context(locals, 'en', false))
		await first.site.get()
		await first.site.get()
		expect(getRush(context(locals, 'en', false))).not.toBe(first)
		expect(siteRequests()).toBe(2)
	})

	it('never memoizes when the site config turns memo off', async () => {
		const locals = rushLocals(stub.api, siteConfig({ memo: false }))
		const first = getRush(context(locals, 'en', true))
		await first.site.get()
		await first.site.get()
		expect(getRush(context(locals, 'en', true))).not.toBe(first)
		expect(siteRequests()).toBe(2)
	})

	it('throws when the middleware did not run', () => {
		expect(() => getRush(context({}, 'en', true))).toThrow('middleware did not run')
	})
})
