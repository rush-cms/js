import { isRecord } from '@rushcms/client'
import type { Entry } from '@rushcms/client'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { entryExample, responseExample } from '../../client/tests/fixtures/contract'
import type { RushSiteConfig } from '../src/config'
import { resolveEntry } from '../src/index'
import type { EntryRoute, EntryRouteContext, EntryRouteProps } from '../src/index'
import { attachRuntime, createRushRuntime } from '../src/runtime'
import { SITE_PREFIX, apiError, envelope, startStubApi } from './fixtures/api'
import type { StubApi, StubHandler, StubRequest } from './fixtures/api'
import { rushLocals, siteConfig } from './fixtures/runtime'

type ContextInit = {
	locals: object
	params?: Record<string, string | undefined>
	props?: EntryRouteProps
	currentLocale?: string
}

type MissingCase = {
	code: string
	params: Record<string, unknown>
}

const ARTICLES = entryExample().collection.id
const PREVIEW_TOKEN = 'rush_prv_e30.c2ln'
const ENTRY_ROUTE = `${SITE_PREFIX}/collections/blog/entries/hello-world`

const CONFIG: RushSiteConfig = siteConfig({
	localePaths: { pt_BR: '', en: 'en', es: 'es' },
	routes: { articles: '/{locale}/posts/{slug}' },
	routeKeysById: { [ARTICLES]: 'articles' },
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

function context(init: ContextInit): EntryRouteContext {
	return {
		locals: init.locals,
		currentLocale: init.currentLocale,
		isPrerendered: false,
		params: init.params ?? {},
		props: init.props ?? {}
	}
}

function previewLocals(config: RushSiteConfig = CONFIG): object {
	const locals = {}
	attachRuntime(locals, createRushRuntime({ api: stub.api, config }).preview(PREVIEW_TOKEN))
	return locals
}

function servedEntry(request: StubRequest): Entry {
	return { ...entryExample(), locale: request.query.get('locale') ?? '' }
}

function serving(handler: StubHandler): void {
	stub.handle(handler)
}

function serveEntryAt(path: string): StubHandler {
	return (request) =>
		request.path === path
			? envelope(servedEntry(request))
			: apiError(404, {
					error: 'not found',
					code: 'not_found',
					params: { resource: 'entry' }
				})
}

function requestLines(): string[] {
	return stub.requests.map(
		(request) => `${request.path}?${request.query} ${request.headers.get('authorization')}`
	)
}

async function resolveIn(init: ContextInit, route?: EntryRoute) {
	return resolveEntry(context(init), route)
}

beforeAll(async () => {
	stub = await startStubApi()
})

afterEach(() => {
	stub.requests.length = 0
})

afterAll(() => stub.close())

const BLOG_PARAMS = { locale: 'en', collection: 'blog', slug: 'hello-world' }

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
			locals: rushLocals(stub.api, CONFIG),
			params: BLOG_PARAMS
		})
		expect(resolved.kind === 'found' && resolved.entry.locale).toBe('en')
		expect(resolved.kind === 'found' && resolved.locale).toBe('en')
		expect(requestLines()).toEqual([`${ENTRY_ROUTE}?locale=en Bearer ${stub.api.token}`])
	})

	it('reads drafts with the preview token in a preview deployment without props', async () => {
		serving(serveEntryAt(ENTRY_ROUTE))
		const resolved = await resolveIn({ locals: previewLocals(), params: BLOG_PARAMS })
		expect(resolved.kind).toBe('found')
		expect(requestLines()).toEqual([
			`${ENTRY_ROUTE}?locale=en&perspective=draft Bearer ${PREVIEW_TOKEN}`
		])
	})

	it('maps moved to a location built from its params with a single request', async () => {
		serving(() => apiError(404, movedBody()))
		const resolved = await resolveIn({
			locals: rushLocals(stub.api, CONFIG),
			params: { locale: 'en', collection: 'blog', slug: 'old-slug' }
		})
		expect(resolved).toEqual({ kind: 'moved', location: '/posts/ola-mundo' })
		expect(stub.requests).toHaveLength(1)
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
	it('takes the collection of a fixed-collection route from the route argument', async () => {
		const path = `${SITE_PREFIX}/collections/articles/entries/hello-world`
		serving(serveEntryAt(path))
		const resolved = await resolveIn(
			{ locals: rushLocals(stub.api, CONFIG), params: { locale: 'es', slug: 'hello-world' } },
			{ collection: 'articles' }
		)
		expect(resolved.kind === 'found' && resolved.locale).toBe('es')
		expect(stub.requests.map((request) => request.path)).toEqual([path])
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
		serving(serveEntryAt(ENTRY_ROUTE))
		const resolved = await resolveIn({
			locals: rushLocals(stub.api, CONFIG),
			params: { collection: 'blog', slug: 'hello-world' }
		})
		expect(resolved.kind === 'found' && resolved.locale).toBe('pt_BR')
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
