import { createUrls } from '@rushcms/client'
import type {
	Collection,
	CollectionRef,
	Entry,
	Homepage,
	LocaleCode,
	RushRoutes
} from '@rushcms/client'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { entryExample, homepageExample } from '../../client/tests/fixtures/contract'
import type { RushSiteConfig } from '../src/config'
import { resolvePage } from '../src/index'
import type { PageResolution, SitePage, SitePageContext, SiteStaticPath } from '../src/index'
import { runtimeOf } from '../src/runtime'
import { collectSitePaths } from '../src/site-pages'
import { SITE_PREFIX, apiError, envelope, exampleData, startStubApi } from './fixtures/api'
import type { StubApi, StubRequest } from './fixtures/api'
import {
	ARTICLES,
	GENERIC_ROUTES,
	PREVIEW_TOKEN,
	collectionsOf,
	routeContext,
	rushLocals,
	siteConfig
} from './fixtures/runtime'

type Catalog = {
	homepages: Record<LocaleCode, Homepage>
	collections: Record<LocaleCode, Collection[]>
	entries: Record<string, Entry[]>
	moved: Record<string, CollectionRef>
}

const LOCALE_PATHS = { pt_BR: '', en: 'en' }
const ARTICLE_SLUGS = { pt_BR: 'artigos', en: 'blog' }
const PAGES: CollectionRef = { id: '01JCPAGES0000000000000000', slug: 'paginas' }
const PAGE_SLUGS = { pt_BR: 'paginas', en: 'pages' }
const ITEMS_PER_PAGE = 2
const ENTRY_COUNT = 5
const LAST_PAGE = 3
const WALK_PAGE_SIZE = '100'
const SITE = 'https://site.example'
const ENTRY_LIST = /^\/collections\/([^/]+)\/entries$/
const ENTRY_ITEM = /^\/collections\/([^/]+)\/entries\/([^/]+)$/
const COLLECTION_ITEM = /^\/collections\/([^/]+)$/

const GENERIC_CONFIG: RushSiteConfig = siteConfig({
	localePaths: LOCALE_PATHS,
	routes: GENERIC_ROUTES,
	collections: collectionsOf(ARTICLES, ARTICLE_SLUGS),
	defaultLocale: 'pt_BR',
	memo: false
})

const ROOT_PAGES_ROUTES: RushRoutes = { ...GENERIC_ROUTES, [PAGES.id]: '/{locale}/{slug}' }

const ROOT_PAGES_CONFIG: RushSiteConfig = siteConfig({
	...GENERIC_CONFIG,
	routes: ROOT_PAGES_ROUTES,
	collections: {
		pt_BR: [
			{ id: ARTICLES, slug: 'artigos' },
			{ id: PAGES.id, slug: 'paginas' }
		],
		en: [
			{ id: ARTICLES, slug: 'blog' },
			{ id: PAGES.id, slug: 'pages' }
		]
	}
})

let stub: StubApi

function collection(ref: CollectionRef): Collection {
	return {
		...(exampleData('CollectionOk') as Collection),
		...ref,
		items_per_page: ITEMS_PER_PAGE
	}
}

function entry(ref: CollectionRef, locale: LocaleCode, slug: string): Entry {
	return {
		...entryExample(),
		id: `${locale}-${slug}`,
		locale,
		slug,
		fallback: false,
		collection: ref,
		translations: { [locale]: { slug, collection_slug: ref.slug } }
	}
}

function entriesOf(ref: CollectionRef, locale: LocaleCode, count: number): Entry[] {
	return Array.from({ length: count }, (_, index) =>
		entry(ref, locale, `${ref.slug}-${index + 1}`)
	)
}

function refsOf(id: string, slugs: Record<LocaleCode, string>): Record<LocaleCode, CollectionRef> {
	return Object.fromEntries(Object.entries(slugs).map(([locale, slug]) => [locale, { id, slug }]))
}

const ARTICLE_REFS = refsOf(ARTICLES, ARTICLE_SLUGS)
const PAGE_REFS = refsOf(PAGES.id, PAGE_SLUGS)

function articleRef(locale: LocaleCode): CollectionRef {
	return ARTICLE_REFS[locale] ?? { id: ARTICLES, slug: 'blog' }
}

function articlesCatalog(): Catalog {
	const locales = Object.keys(LOCALE_PATHS)
	return {
		homepages: { pt_BR: { ...homepageExample(), locale: 'pt_BR', fallback: false } },
		collections: Object.fromEntries(
			locales.map((locale) => [locale, [collection(articleRef(locale))]])
		),
		entries: Object.fromEntries(
			locales.map((locale) => [
				articleRef(locale).slug,
				entriesOf(articleRef(locale), locale, ENTRY_COUNT)
			])
		),
		moved: {}
	}
}

function withRootPages(catalog: Catalog): Catalog {
	const locales = Object.keys(PAGE_SLUGS)
	const pageRef = (locale: LocaleCode): CollectionRef => PAGE_REFS[locale] ?? PAGES
	return {
		...catalog,
		collections: Object.fromEntries(
			locales.map((locale) => [
				locale,
				[...(catalog.collections[locale] ?? []), collection(pageRef(locale))]
			])
		),
		entries: {
			...catalog.entries,
			...Object.fromEntries(
				locales.map((locale) => [
					pageRef(locale).slug,
					entriesOf(pageRef(locale), locale, 3)
				])
			)
		}
	}
}

function notFound(resource: string): Response {
	return apiError(404, { error: 'not found', code: 'not_found', params: { resource } })
}

function positive(value: string | null, fallback: number): number {
	const parsed = Number(value)
	return value === null || !Number.isInteger(parsed) || parsed < 1 ? fallback : parsed
}

function entryPage(catalog: Catalog, slug: string, request: StubRequest): Response {
	const all = catalog.entries[slug] ?? []
	const perPage = positive(request.query.get('per_page'), 12)
	const page = positive(request.query.get('page'), 1)
	return Response.json({
		data: all.slice((page - 1) * perPage, page * perPage),
		meta: {
			total: all.length,
			per_page: perPage,
			current_page: page,
			last_page: Math.ceil(all.length / perPage)
		}
	})
}

function entryItem(catalog: Catalog, collectionSlug: string, slug: string): Response {
	const found = catalog.entries[collectionSlug]?.find((item) => item.slug === slug)
	if (found !== undefined) {
		return envelope(found)
	}
	const target = catalog.moved[slug]
	if (target === undefined) {
		return notFound('entry')
	}
	const [served] = catalog.entries[target.slug] ?? []
	return apiError(404, {
		error: 'entry moved',
		code: 'moved',
		params: {
			locale: served?.locale ?? '',
			slug: served?.slug ?? '',
			collection_id: target.id,
			collection_slug: target.slug
		}
	})
}

function serve(catalog: Catalog): void {
	stub.handle((request) => {
		const locale = request.query.get('locale') ?? ''
		const path = request.path.slice(SITE_PREFIX.length)
		if (path === '/homepage') {
			const homepage = catalog.homepages[locale]
			return homepage === undefined ? notFound('homepage') : envelope(homepage)
		}
		if (path === '/collections') {
			return envelope(catalog.collections[locale] ?? [])
		}
		const [, listed = ''] = ENTRY_LIST.exec(path) ?? []
		if (listed !== '') {
			return entryPage(catalog, listed, request)
		}
		const [, collectionSlug = '', slug = ''] = ENTRY_ITEM.exec(path) ?? []
		if (slug !== '') {
			return entryItem(catalog, collectionSlug, slug)
		}
		const [, wanted = ''] = COLLECTION_ITEM.exec(path) ?? []
		const known = Object.values(catalog.collections)
			.flat()
			.find((item) => item.slug === wanted)
		return known === undefined ? notFound('collection') : envelope(known)
	})
}

function pathOf(path: SiteStaticPath): string {
	return `/${path.params.path ?? ''}`
}

async function sitePathsOf(catalog: Catalog, config: RushSiteConfig): Promise<SiteStaticPath[]> {
	serve(catalog)
	const runtime = runtimeOf(rushLocals(stub.api, config))
	return collectSitePaths(runtime.onDemandClient(), runtime.urls)
}

function pageContext(
	pathname: string,
	config: RushSiteConfig = GENERIC_CONFIG,
	page?: SitePage,
	previewToken?: string
): SitePageContext {
	return {
		...routeContext({ locals: rushLocals(stub.api, config, previewToken) }),
		url: new URL(pathname, SITE),
		props: page === undefined ? {} : { page }
	}
}

async function resolveAt(pathname: string, catalog: Catalog = articlesCatalog()) {
	serve(catalog)
	return resolvePage(pageContext(pathname))
}

function entrySlugs(page: PageResolution | undefined): string[] {
	return page?.kind === 'collection' ? page.entries.items.map((item) => item.slug) : []
}

beforeAll(async () => {
	stub = await startStubApi()
})

afterEach(() => {
	stub.requests.length = 0
})

afterAll(() => stub.close())

describe('collectSitePaths', () => {
	it('lists every homepage, list page and entry of every locale for a generic route', async () => {
		const paths = await sitePathsOf(articlesCatalog(), GENERIC_CONFIG)
		expect(paths.map(pathOf)).toEqual([
			'/',
			'/en',
			'/artigos',
			'/artigos/page/2',
			'/artigos/page/3',
			'/en/blog',
			'/en/blog/page/2',
			'/en/blog/page/3',
			...[1, 2, 3, 4, 5].map((n) => `/artigos/artigos-${n}`),
			...[1, 2, 3, 4, 5].map((n) => `/en/blog/blog-${n}`)
		])
		expect(paths[0]?.params.path).toBeUndefined()
	})

	it('gives each path the page it renders', async () => {
		const paths = await sitePathsOf(articlesCatalog(), GENERIC_CONFIG)
		const byPath = new Map(paths.map((path) => [pathOf(path), path.props.page]))
		expect(byPath.get('/')).toMatchObject({ kind: 'homepage', locale: 'pt_BR' })
		expect(byPath.get('/en')).toEqual({ kind: 'homepage', locale: 'en', homepage: undefined })
		const third = byPath.get('/en/blog/page/3')
		expect(third).toMatchObject({ kind: 'collection', locale: 'en', page: 3 })
		expect(third).toMatchObject({
			collection: { slug: 'blog', items_per_page: ITEMS_PER_PAGE }
		})
		expect(entrySlugs(third)).toEqual(['blog-5'])
		expect(byPath.get('/artigos/artigos-2')).toMatchObject({
			kind: 'found',
			locale: 'pt_BR',
			entry: { slug: 'artigos-2' }
		})
	})

	it('pages each list with the collection items_per_page', async () => {
		await sitePathsOf(articlesCatalog(), GENERIC_CONFIG)
		const lists = stub.requests.filter(
			(request) =>
				ENTRY_LIST.test(request.path.slice(SITE_PREFIX.length)) &&
				request.query.get('per_page') !== WALK_PAGE_SIZE
		)
		expect(lists).toHaveLength(LAST_PAGE * 2)
		expect(
			lists.every((request) => request.query.get('per_page') === String(ITEMS_PER_PAGE))
		).toBe(true)
	})

	it('lists only page 1 of an empty collection', async () => {
		const catalog = { ...articlesCatalog(), entries: {} }
		const paths = await sitePathsOf(catalog, GENERIC_CONFIG)
		expect(paths.map(pathOf)).toEqual(['/', '/en', '/artigos', '/en/blog'])
	})

	it('lists the homepage once when a root pages collection shares its URL', async () => {
		const paths = await sitePathsOf(withRootPages(articlesCatalog()), ROOT_PAGES_CONFIG)
		const listed = paths.map(pathOf)
		expect(new Set(listed).size).toBe(listed.length)
		expect(paths.filter((path) => pathOf(path) === '/')[0]?.props.page.kind).toBe('homepage')
		expect(paths.filter((path) => pathOf(path) === '/en')[0]?.props.page.kind).toBe('homepage')
		expect(listed).toEqual(
			expect.arrayContaining(['/paginas-1', '/page/2', '/en/pages-3', '/en/page/2'])
		)
	})

	it('names with urls.match every page it lists', async () => {
		const paths = await sitePathsOf(withRootPages(articlesCatalog()), ROOT_PAGES_CONFIG)
		const urls = createUrls(ROOT_PAGES_CONFIG)
		for (const path of paths) {
			const page = path.props.page
			const match = urls.match(pathOf(path))
			expect(match?.kind).toBe(page.kind === 'found' ? 'entry' : page.kind)
			expect(match?.locale).toBe(page.locale)
		}
	})
})

describe('site-paths module', () => {
	it('exports getStaticPaths alone, for pages that re-export it', async () => {
		expect(Object.keys(await import('../src/site-paths'))).toEqual(['getStaticPaths'])
	})
})

describe('resolvePage', () => {
	it('returns the prerendered page without fetching', async () => {
		serve(articlesCatalog())
		const page: SitePage = { kind: 'homepage', locale: 'en', homepage: undefined }
		const resolved = await resolvePage(pageContext('/artigos/page/2', GENERIC_CONFIG, page))
		expect(resolved).toBe(page)
		expect(stub.requests).toHaveLength(0)
	})

	it('fetches the homepage of the path locale on demand', async () => {
		expect(await resolveAt('/')).toMatchObject({
			kind: 'homepage',
			locale: 'pt_BR',
			homepage: { locale: 'pt_BR' }
		})
		expect(await resolveAt('/en')).toEqual({
			kind: 'homepage',
			locale: 'en',
			homepage: undefined
		})
	})

	it('fetches a list page with the collection items_per_page', async () => {
		const resolved = await resolveAt('/en/blog/page/2')
		expect(resolved).toMatchObject({ kind: 'collection', locale: 'en', page: 2 })
		expect(entrySlugs(resolved)).toEqual(['blog-3', 'blog-4'])
		const list = stub.requests.at(-1)
		expect(list?.query.get('page')).toBe('2')
		expect(list?.query.get('per_page')).toBe(String(ITEMS_PER_PAGE))
		expect(list?.query.get('locale')).toBe('en')
	})

	it('answers the last list page and missing past it', async () => {
		expect(await resolveAt(`/en/blog/page/${LAST_PAGE}`)).toMatchObject({
			kind: 'collection',
			page: LAST_PAGE
		})
		expect(await resolveAt(`/en/blog/page/${LAST_PAGE + 1}`)).toEqual({ kind: 'missing' })
	})

	it('answers page 1 of an empty collection', async () => {
		const resolved = await resolveAt('/artigos', { ...articlesCatalog(), entries: {} })
		expect(resolved).toMatchObject({ kind: 'collection', locale: 'pt_BR', page: 1 })
		expect(await resolveAt('/artigos/page/2', { ...articlesCatalog(), entries: {} })).toEqual({
			kind: 'missing'
		})
	})

	it('answers missing when the collection is gone', async () => {
		const catalog = { ...articlesCatalog(), collections: {} }
		expect(await resolveAt('/en/blog', catalog)).toEqual({ kind: 'missing' })
	})

	it('resolves an entry through resolveEntry', async () => {
		expect(await resolveAt('/en/blog/blog-1')).toMatchObject({
			kind: 'found',
			locale: 'en',
			entry: { slug: 'blog-1', locale: 'en' }
		})
		expect(await resolveAt('/en/blog/blog-9')).toEqual({ kind: 'missing' })
	})

	it('answers moved for a retired slug', async () => {
		const catalog = { ...articlesCatalog(), moved: { 'old-slug': articleRef('en') } }
		expect(await resolveAt('/en/blog/old-slug', catalog)).toEqual({
			kind: 'moved',
			location: '/en/blog/blog-1',
			permanent: true
		})
	})

	it('answers missing without a request for a path no route names', async () => {
		expect(await resolveAt('/en/blog/page/1')).toEqual({ kind: 'missing' })
		expect(await resolveAt('/de/blog/x/y')).toEqual({ kind: 'missing' })
		expect(stub.requests).toHaveLength(0)
	})

	it('reads drafts with the preview session token', async () => {
		serve(articlesCatalog())
		await resolvePage(pageContext('/en/blog/page/2', GENERIC_CONFIG, undefined, PREVIEW_TOKEN))
		expect(stub.requests.length).toBeGreaterThan(0)
		expect(
			stub.requests.every(
				(request) => request.headers.get('authorization') === `Bearer ${PREVIEW_TOKEN}`
			)
		).toBe(true)
	})
})
