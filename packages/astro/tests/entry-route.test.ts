import { isRecord } from '@rushcms/client/internal'
import type { Entry, LocaleCode } from '@rushcms/client'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { entryExample, responseExample } from '../../client/tests/fixtures/contract'
import { COLLECTION_SLUGS, ENTRY_SLUGS } from '../../client/tests/fixtures/slugs'
import type { RushSiteConfig } from '../src/config'
import { resolveEntry } from '../src/index'
import type { EntryRoute } from '../src/index'
import { SITE_PREFIX, apiError, envelope, startStubApi } from './fixtures/api'
import type { StubApi, StubHandler, StubRequest } from './fixtures/api'
import {
	ARTICLES,
	GENERIC_ROUTES,
	PREVIEW_TOKEN,
	collectionsOf,
	newsOnly,
	routeContext,
	rushLocals,
	siteConfig
} from './fixtures/runtime'
import type { RouteContextInit } from './fixtures/runtime'

type MissingCase = {
	code: string
	params: Record<string, unknown>
}

type FixedRouteCase = {
	locale: LocaleCode
	requested: string
}

const ENTRY_ROUTE = `${SITE_PREFIX}/collections/blog/entries/hello-world`
const ENTRY_PATH = /^\/api\/v1\/[^/]+\/collections\/([^/]+)\/entries\/([^/]+)$/
const FIXED_ROUTE: EntryRoute = { collection: 'artigos' }

const CONFIG: RushSiteConfig = siteConfig({
	localePaths: { pt_BR: '', en: 'en', es: 'es' },
	routes: { artigos: '/{locale}/posts/{slug}' },
	collections: collectionsOf(ARTICLES, COLLECTION_SLUGS),
	memo: false
})

let stub: StubApi

function movedBody(): Record<string, unknown> {
	const body = responseExample('NotFoundEntry')
	if (!isRecord(body)) {
		throw new Error('NotFoundEntry example is not an object')
	}
	return body
}

function servedEntry(request: StubRequest): Entry {
	return { ...entryExample(), locale: request.query.get('locale') ?? '' }
}

function serving(handler: StubHandler): void {
	stub.handle(handler)
}

function entryNotFound(): Response {
	return apiError(404, { error: 'not found', code: 'not_found', params: { resource: 'entry' } })
}

function serveEntryAt(path: string): StubHandler {
	return (request) => (request.path === path ? envelope(servedEntry(request)) : entryNotFound())
}

function echoingSlug(request: StubRequest): Response {
	return envelope({ ...servedEntry(request), slug: request.path.split('/').at(-1) })
}

function requestLines(): string[] {
	return stub.requests.map(
		(request) => `${request.path}?${request.query} ${request.headers.get('authorization')}`
	)
}

function slugOwner(slug: string): LocaleCode | undefined {
	return Object.keys(ENTRY_SLUGS).find((locale) => ENTRY_SLUGS[locale] === slug)
}

function resolvingSlugs(request: StubRequest): Response {
	const [, collection = '', slug = ''] = ENTRY_PATH.exec(request.path) ?? []
	const locale = request.query.get('locale') ?? ''
	const known = Object.values(COLLECTION_SLUGS).includes(collection)
	if (!known || slugOwner(slug) === undefined) {
		return entryNotFound()
	}
	const canonical = { slug: ENTRY_SLUGS[locale], collection: COLLECTION_SLUGS[locale] }
	if (canonical.slug === slug && canonical.collection === collection) {
		return envelope(servedEntry(request))
	}
	return apiError(404, {
		error: 'entry moved',
		code: 'moved',
		params: {
			locale,
			slug: canonical.slug,
			collection_id: ARTICLES,
			collection_slug: canonical.collection
		}
	})
}

function fixedPath(locale: LocaleCode, slug: string): string {
	const prefix = CONFIG.localePaths[locale] ?? ''
	return prefix === '' ? `/posts/${slug}` : `/${prefix}/posts/${slug}`
}

async function resolveIn(init: RouteContextInit, route?: EntryRoute) {
	return resolveEntry(routeContext(init), route)
}

beforeAll(async () => {
	stub = await startStubApi()
})

afterEach(() => {
	stub.requests.length = 0
})

afterAll(() => stub.close())

const BLOG_PARAMS = { locale: 'en', collection: 'blog', slug: 'hello-world' }

const GENERIC_CONFIG: RushSiteConfig = siteConfig({ ...CONFIG, routes: GENERIC_ROUTES })

const NEWS_ONLY_CONFIG: RushSiteConfig = newsOnly(CONFIG)

describe('resolveEntry with unrouted collections', () => {
	it('answers missing when the moved target collection has no route', async () => {
		serving(() => apiError(404, movedBody()))
		const resolved = await resolveIn(
			{ locals: rushLocals(stub.api, NEWS_ONLY_CONFIG), params: { locale: 'en', slug: 'x' } },
			{ collection: 'news' }
		)
		expect(resolved).toEqual({ kind: 'missing' })
		expect(stub.requests).toHaveLength(1)
	})

	it('answers missing without a request for a collection param that has no route', async () => {
		const resolved = await resolveIn({
			locals: rushLocals(stub.api, NEWS_ONLY_CONFIG),
			params: BLOG_PARAMS
		})
		expect(resolved).toEqual({ kind: 'missing' })
		expect(stub.requests).toHaveLength(0)
	})
})

describe('resolveEntry with getStaticPaths props', () => {
	it('returns the prerendered entry without calling the API', async () => {
		const entry = entryExample()
		const resolved = await resolveIn({
			locals: rushLocals(stub.api, CONFIG),
			params: BLOG_PARAMS,
			props: { entry }
		})
		expect(resolved).toEqual({ kind: 'found', entry, locale: 'en' })
		expect(stub.requests).toHaveLength(0)
	})
})

describe('resolveEntry on demand', () => {
	it('fetches the entry by the route params in the param locale', async () => {
		serving(serveEntryAt(ENTRY_ROUTE))
		const resolved = await resolveIn({
			locals: rushLocals(stub.api, GENERIC_CONFIG),
			params: BLOG_PARAMS
		})
		expect(resolved.kind === 'found' && resolved.entry.locale).toBe('en')
		expect(resolved.kind === 'found' && resolved.locale).toBe('en')
		expect(requestLines()).toEqual([`${ENTRY_ROUTE}?locale=en Bearer ${stub.api.token}`])
	})

	it('reads drafts with the preview token in a preview deployment without props', async () => {
		serving(serveEntryAt(ENTRY_ROUTE))
		const resolved = await resolveIn({
			locals: rushLocals(stub.api, GENERIC_CONFIG, PREVIEW_TOKEN),
			params: BLOG_PARAMS
		})
		expect(resolved.kind).toBe('found')
		expect(requestLines()).toEqual([
			`${ENTRY_ROUTE}?locale=en&perspective=draft Bearer ${PREVIEW_TOKEN}`
		])
	})

	it('maps moved to a permanent location built from its params with a single request', async () => {
		serving(() => apiError(404, movedBody()))
		const resolved = await resolveIn({
			locals: rushLocals(stub.api, CONFIG),
			params: { locale: 'en', collection: 'blog', slug: 'old-slug' }
		})
		expect(resolved).toEqual({ kind: 'moved', location: '/posts/ola-mundo', permanent: true })
		expect(stub.requests).toHaveLength(1)
	})

	it('marks moved as temporary in a preview deployment', async () => {
		serving(() => apiError(404, movedBody()))
		const preview = siteConfig({ ...CONFIG, preview: true })
		for (const locals of [
			rushLocals(stub.api, preview),
			rushLocals(stub.api, preview, PREVIEW_TOKEN)
		]) {
			const resolved = await resolveIn({
				locals,
				params: { locale: 'en', collection: 'blog', slug: 'x' }
			})
			expect(resolved).toEqual({
				kind: 'moved',
				location: '/posts/ola-mundo',
				permanent: false
			})
		}
	})

	const missing: MissingCase[] = [
		{ code: 'not_found', params: { resource: 'entry' } },
		{ code: 'not_translated', params: { available: ['pt_BR'] } },
		{ code: 'locale_not_served', params: { available: ['pt_BR'] } }
	]

	it.each(missing)('maps $code to missing', async ({ code, params }) => {
		serving(() => apiError(404, { error: code, code, params }))
		const resolved = await resolveIn({
			locals: rushLocals(stub.api, CONFIG),
			params: BLOG_PARAMS
		})
		expect(resolved).toEqual({ kind: 'missing' })
	})

	it('rethrows other API errors', async () => {
		serving(() => apiError(500, { error: 'boom', code: 'internal_error' }))
		await expect(
			resolveIn({ locals: rushLocals(stub.api, CONFIG), params: BLOG_PARAMS })
		).rejects.toMatchObject({ status: 500 })
	})

	it.each(['xx', 'pt', 'pt_BR', 'EN'])(
		'answers missing without a request for the locale segment "%s"',
		async (locale) => {
			const resolved = await resolveIn({
				locals: rushLocals(stub.api, CONFIG),
				params: { ...BLOG_PARAMS, locale }
			})
			expect(resolved).toEqual({ kind: 'missing' })
			expect(stub.requests).toHaveLength(0)
		}
	)

	it('answers missing without a request when the collection or slug is absent', async () => {
		const locals = rushLocals(stub.api, CONFIG)
		expect(await resolveIn({ locals, params: { locale: 'en', slug: 'x' } })).toEqual({
			kind: 'missing'
		})
		expect(await resolveIn({ locals, params: { locale: 'en', collection: 'blog' } })).toEqual({
			kind: 'missing'
		})
		expect(stub.requests).toHaveLength(0)
	})
})

describe('resolveEntry route overrides and locales', () => {
	const fixedCases: FixedRouteCase[] = Object.keys(CONFIG.localePaths).flatMap((locale) =>
		Object.values(ENTRY_SLUGS).map((requested) => ({ locale, requested }))
	)

	it.each(fixedCases)(
		'resolves the fixed-collection route in $locale for the slug $requested without a loop',
		async ({ locale, requested }) => {
			serving(resolvingSlugs)
			const locals = rushLocals(stub.api, CONFIG)
			const params = { locale: CONFIG.localePaths[locale] || undefined, slug: requested }
			const resolved = await resolveIn({ locals, params }, FIXED_ROUTE)
			const canonical = ENTRY_SLUGS[locale] ?? ''
			expect(stub.requests.map((request) => request.path)).toEqual([
				`${SITE_PREFIX}/collections/${COLLECTION_SLUGS[locale]}/entries/${requested}`
			])
			if (requested === canonical) {
				expect(resolved.kind === 'found' && resolved.entry.locale).toBe(locale)
				return
			}
			const location = fixedPath(locale, canonical)
			expect(resolved).toEqual({ kind: 'moved', location, permanent: true })
			expect(location).not.toBe(fixedPath(locale, requested))
			const landed = await resolveIn(
				{ locals, params: { ...params, slug: canonical } },
				FIXED_ROUTE
			)
			expect(landed.kind).toBe('found')
		}
	)

	it('keeps a collection segment of a {collection} route unmapped so the API corrects it', async () => {
		serving(resolvingSlugs)
		const resolved = await resolveIn({
			locals: rushLocals(stub.api, GENERIC_CONFIG),
			params: { locale: 'en', collection: 'artigos', slug: 'hello-world' }
		})
		expect(resolved).toEqual({
			kind: 'moved',
			location: '/en/blog/hello-world',
			permanent: true
		})
		expect(stub.requests.map((request) => request.path)).toEqual([
			`${SITE_PREFIX}/collections/artigos/entries/hello-world`
		])
	})

	it('maps a fixed route keyed by the collection id to the slug of the locale', async () => {
		serving(resolvingSlugs)
		const config = siteConfig({
			...CONFIG,
			routes: { [ARTICLES]: '/{locale}/posts/{slug}' }
		})
		const resolved = await resolveIn(
			{ locals: rushLocals(stub.api, config), params: { locale: 'es', slug: 'hola-mundo' } },
			{ collection: ARTICLES }
		)
		expect(resolved.kind).toBe('found')
		expect(stub.requests.map((request) => request.path)).toEqual([
			`${SITE_PREFIX}/collections/articulos/entries/hola-mundo`
		])
	})

	it('resolves a catch-all route from explicit segments', async () => {
		serving(serveEntryAt(ENTRY_ROUTE))
		const resolved = await resolveIn(
			{ locals: rushLocals(stub.api, CONFIG), params: { path: 'en/blog/hello-world' } },
			{ locale: 'en', collection: 'blog', slug: 'hello-world' }
		)
		expect(resolved.kind === 'found' && resolved.locale).toBe('en')
	})

	it('uses the empty prefix locale when the route has no locale segment', async () => {
		serving(resolvingSlugs)
		const resolved = await resolveIn(
			{
				locals: rushLocals(stub.api, CONFIG),
				params: { collection: 'artigos', slug: 'ola-mundo' }
			},
			FIXED_ROUTE
		)
		expect(resolved.kind === 'found' && resolved.locale).toBe('pt_BR')
		expect(stub.requests[0]?.path).toBe(`${SITE_PREFIX}/collections/artigos/entries/ola-mundo`)
	})

	const segmentCases: FixedRouteCase[] = Object.keys(CONFIG.localePaths).map((locale) => ({
		locale,
		requested: COLLECTION_SLUGS[locale] ?? ''
	}))

	it.each(segmentCases)(
		'redirects a fixed collection reached through the $requested param in $locale to its fixed route in one hop',
		async ({ locale, requested }) => {
			serving(echoingSlug)
			const locals = rushLocals(stub.api, CONFIG)
			const slug = ENTRY_SLUGS[locale] ?? ''
			const params = { locale: CONFIG.localePaths[locale] || undefined, slug }
			const resolved = await resolveIn({
				locals,
				params: { ...params, collection: requested }
			})
			expect(resolved).toEqual({
				kind: 'moved',
				location: fixedPath(locale, slug),
				permanent: true
			})
			expect(stub.requests.map((request) => request.path)).toEqual([
				`${SITE_PREFIX}/collections/${requested}/entries/${slug}`
			])
			const landed = await resolveIn({ locals, params }, FIXED_ROUTE)
			expect(landed.kind).toBe('found')
		}
	)

	it('marks the redirect to a fixed route temporary in a preview deployment', async () => {
		serving(echoingSlug)
		const resolved = await resolveIn({
			locals: rushLocals(stub.api, siteConfig({ ...CONFIG, preview: true })),
			params: { locale: 'en', collection: 'blog', slug: 'hello-world' }
		})
		expect(resolved).toEqual({
			kind: 'moved',
			location: '/en/posts/hello-world',
			permanent: false
		})
	})

	it('maps an Astro i18n locale code when the route has no locale param', async () => {
		serving(serveEntryAt(ENTRY_ROUTE))
		const config = siteConfig({ localePaths: { pt_BR: 'pt', en: 'en' }, memo: false })
		const resolved = await resolveIn({
			locals: rushLocals(stub.api, config),
			currentLocale: 'pt-BR',
			params: { collection: 'blog', slug: 'hello-world' }
		})
		expect(resolved.kind === 'found' && resolved.locale).toBe('pt_BR')
		expect(stub.requests[0]?.query.get('locale')).toBe('pt_BR')
	})
})
