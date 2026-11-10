import { createUrls } from '@rushcms/client'
import type {
	Collection,
	CollectionRef,
	Entry,
	Homepage,
	Alternate,
	LocaleCode,
	RushRoutes,
	Tag
} from '@rushcms/client'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { entryExample, homepageExample } from '../../client/tests/fixtures/contract'
import type { RushSiteConfig } from '../src/config'
import { resolvePage, taxonomyAlternates } from '../src/index'
import type { PageResolution, SitePage, SitePageContext, SiteStaticPath } from '../src/index'
import { runtimeOf } from '../src/runtime'
import type { RushRuntime } from '../src/runtime'
import { collectSitePaths } from '../src/site-pages'
import { TAXONOMIES, TAXONOMY_LOCALE_PATHS, tagOf } from '../../client/tests/fixtures/taxonomies'
import {
	SITE_PREFIX,
	apiError,
	envelope,
	exampleData,
	notFound,
	pagedResponse,
	startStubApi,
	tagEntriesKey,
	tagResponse
} from './fixtures/api'
import type { StubApi, StubRequest, TagCatalog } from './fixtures/api'
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
	taxonomy?: TagCatalog
}

const LOCALE_PATHS = { pt_BR: '', en: 'en' }
const ARTICLE_SLUGS = { pt_BR: 'artigos', en: 'blog' }
const PAGES: CollectionRef = { id: '01JCPAGES0000000000000000', slug: 'paginas' }
const PAGE_SLUGS = { pt_BR: 'paginas', en: 'pages' }
const ITEMS_PER_PAGE = 2
const ENTRY_COUNT = 5
const LAST_PAGE = 3
const WALK_PAGE_SIZE = '100'
const ENTRY_LIST = /^\/collections\/([^/]+)\/entries$/
const ENTRY_ITEM = /^\/collections\/([^/]+)\/entries\/([^/]+)$/
const COLLECTION_ITEM = /^\/collections\/([^/]+)$/

const TAXONOMY_ARTICLE_SLUGS = { pt_BR: 'artigos', en: 'blog', es: 'articulos' }
const TAG_PAGE_SIZE = 15
const DESIGN_COUNT = TAG_PAGE_SIZE + 2
const DESIGN_SLUGS: Record<LocaleCode, string> = { pt_BR: 'design', en: 'design', es: 'diseno' }
const SHARED_SLUG_ENTRY = 'tagged-design'
const DESIGN_ALTERNATES = [
	{ locale: 'pt_BR', hreflang: 'pt-BR', url: '/br/categoria/design' },
	{ locale: 'en', hreflang: 'en', url: '/category/design' },
	{ locale: 'es', hreflang: 'es', url: '/es/categoria/diseno' }
]

const TAXONOMY_CONFIG: RushSiteConfig = siteConfig({
	localePaths: TAXONOMY_LOCALE_PATHS,
	routes: { [ARTICLES]: '/{locale}/blog/{slug}' },
	collections: collectionsOf(ARTICLES, TAXONOMY_ARTICLE_SLUGS),
	pageSegments: { pt_BR: 'pagina' },
	taxonomies: TAXONOMIES,
	defaultLocale: 'pt_BR',
	memo: false
})

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

const TAXONOMY_REFS = refsOf(ARTICLES, TAXONOMY_ARTICLE_SLUGS)
const TAXONOMY_LOCALES = Object.keys(TAXONOMY_LOCALE_PATHS)

function taxonomyRef(locale: LocaleCode): CollectionRef {
	return TAXONOMY_REFS[locale] ?? { id: ARTICLES, slug: 'blog' }
}

function designOf(locale: LocaleCode): Tag {
	return tagOf({
		type: 'category',
		slug: DESIGN_SLUGS[locale] ?? 'design',
		entryCount: DESIGN_COUNT,
		id: 'category-design'
	})
}

function designTaxonomy(): TagCatalog {
	const empty = tagOf({ type: 'category', slug: 'empty', entryCount: 0 })
	const astro = tagOf({ type: 'tag', slug: 'astro' })
	return {
		tags: {
			pt_BR: [designOf('pt_BR'), empty],
			en: [designOf('en'), empty, astro],
			es: [designOf('es'), empty]
		},
		entries: {
			...Object.fromEntries(
				TAXONOMY_LOCALES.map((locale) => [
					tagEntriesKey(locale, designOf(locale)),
					entriesOf(taxonomyRef(locale), locale, DESIGN_COUNT)
				])
			),
			[tagEntriesKey('en', astro)]: entriesOf(taxonomyRef('en'), 'en', 1)
		}
	}
}

function sharedSlugTaxonomy(): TagCatalog {
	const { tags, entries } = designTaxonomy()
	const tag = tagOf({ type: 'tag', slug: 'design' })
	return {
		tags: {
			...tags,
			en: [...(tags.en ?? []), tag],
			es: [...(tags.es ?? []), { ...tag, entry_count: 0 }]
		},
		entries: {
			...entries,
			[tagEntriesKey('en', tag)]: [entry(taxonomyRef('en'), 'en', SHARED_SLUG_ENTRY)]
		}
	}
}

function taxonomyCatalog(taxonomy: TagCatalog = designTaxonomy()): Catalog {
	return {
		homepages: {},
		collections: Object.fromEntries(
			TAXONOMY_LOCALES.map((locale) => [locale, [collection(taxonomyRef(locale))]])
		),
		entries: {},
		moved: {},
		taxonomy
	}
}

function entryPage(catalog: Catalog, slug: string, request: StubRequest): Response {
	return pagedResponse(catalog.entries[slug] ?? [], request, 12)
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
		const tagged = tagResponse(catalog.taxonomy, request)
		if (tagged !== undefined) {
			return tagged
		}
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

function runtimeServing(catalog: Catalog, config: RushSiteConfig): RushRuntime {
	serve(catalog)
	return runtimeOf(rushLocals(stub.api, config))
}

async function sitePathsOf(catalog: Catalog, config: RushSiteConfig): Promise<SiteStaticPath[]> {
	const runtime = runtimeServing(catalog, config)
	return collectSitePaths(runtime.onDemandClient(), runtime.urls)
}

async function taxonomyPathsOf(taxonomy: TagCatalog): Promise<Map<string, SitePage>> {
	const paths = await sitePathsOf(taxonomyCatalog(taxonomy), TAXONOMY_CONFIG)
	return new Map(paths.map((path) => [pathOf(path), path.props.page]))
}

function alternatesOf(page: PageResolution | undefined): Alternate[] | undefined {
	return page?.kind === 'taxonomy' ? page.alternates : undefined
}

function only(locale: LocaleCode, url: string): Alternate[] {
	return DESIGN_ALTERNATES.filter((alternate) => alternate.locale === locale).map(
		(alternate) => ({ ...alternate, url })
	)
}

function pageContext(
	pathname: string,
	config: RushSiteConfig = GENERIC_CONFIG,
	page?: SitePage,
	previewToken?: string
): SitePageContext {
	return {
		...routeContext({ locals: rushLocals(stub.api, config, previewToken), path: pathname }),
		props: page === undefined ? {} : { page }
	}
}

async function resolveAt(pathname: string, catalog: Catalog = articlesCatalog()) {
	serve(catalog)
	return resolvePage(pageContext(pathname))
}

function entrySlugs(page: PageResolution | undefined): string[] {
	return page?.kind === 'collection' || page?.kind === 'taxonomy'
		? page.entries.items.map((item) => item.slug)
		: []
}

async function taxonomyAt(
	pathname: string,
	catalog: Catalog = taxonomyCatalog()
): Promise<PageResolution> {
	serve(catalog)
	return resolvePage(pageContext(pathname, TAXONOMY_CONFIG))
}

function tagRequests(): string[] {
	return stub.requests
		.filter((request) => request.path.startsWith(`${SITE_PREFIX}/tags`))
		.map(
			(request) =>
				`${request.path.slice(SITE_PREFIX.length)}?${[...request.query].map(([key, value]) => `${key}=${value}`).join('&')}`
		)
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
		expect(third).toMatchObject({ kind: 'collection', locale: 'en', page: 3, lastPage: 3 })
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

describe('taxonomyAlternates', () => {
	it('resolves the same tag in each locale and skips locales without its entries', async () => {
		const runtime = runtimeServing(taxonomyCatalog(sharedSlugTaxonomy()), TAXONOMY_CONFIG)
		const { urls } = runtime
		const client = runtime.onDemandClient()
		expect(await taxonomyAlternates(designOf('es'), client, urls)).toEqual(DESIGN_ALTERNATES)
		expect(
			await taxonomyAlternates(tagOf({ type: 'tag', slug: 'design' }), client, urls)
		).toEqual(only('en', '/tag/design'))
		expect(
			await taxonomyAlternates(tagOf({ type: 'tag', slug: 'astro' }), client, urls)
		).toEqual(only('en', '/tag/astro'))
	})
})

describe('collectSitePaths with taxonomies', () => {
	it('lists every page of every tag with entries, per configured type and locale', async () => {
		const paths = await sitePathsOf(taxonomyCatalog(), TAXONOMY_CONFIG)
		expect(paths.map(pathOf)).toEqual([
			'/br',
			'/',
			'/es',
			'/br/blog',
			'/blog',
			'/es/blog',
			'/br/categoria/design',
			'/br/categoria/design/pagina/2',
			'/category/design',
			'/category/design/page/2',
			'/es/categoria/diseno',
			'/es/categoria/diseno/page/2',
			'/tag/astro'
		])
	})

	it('gives each taxonomy path its tag and the entries of that page', async () => {
		const paths = await sitePathsOf(taxonomyCatalog(), TAXONOMY_CONFIG)
		const byPath = new Map(paths.map((path) => [pathOf(path), path.props.page]))
		const second = byPath.get('/es/categoria/diseno/page/2')
		expect(second).toMatchObject({
			kind: 'taxonomy',
			locale: 'es',
			page: 2,
			lastPage: 2,
			tag: { id: 'category-design', slug: 'diseno', type: 'category' },
			entries: { meta: { total: DESIGN_COUNT, current_page: 2 } }
		})
		expect(entrySlugs(second)).toEqual(['articulos-16', 'articulos-17'])
		expect(byPath.get('/tag/astro')).toMatchObject({ kind: 'taxonomy', page: 1, lastPage: 1 })
	})

	it('asks for the tags of each configured type in each locale and never for empty ones', async () => {
		await sitePathsOf(taxonomyCatalog(), TAXONOMY_CONFIG)
		const requests = tagRequests()
		for (const locale of ['pt_BR', 'en', 'es']) {
			for (const type of ['category', 'tag']) {
				expect(requests).toContain(`/tags?locale=${locale}&type=${type}`)
			}
		}
		expect(requests.filter((request) => request.includes('/empty/'))).toEqual([])
	})

	it('lists each taxonomy page with its own entries when a tag and a category share a slug', async () => {
		const byPath = await taxonomyPathsOf(sharedSlugTaxonomy())
		const category = entrySlugs(byPath.get('/category/design'))
		expect(category).toHaveLength(TAG_PAGE_SIZE)
		expect(category).not.toContain(SHARED_SLUG_ENTRY)
		expect(entrySlugs(byPath.get('/tag/design'))).toEqual([SHARED_SLUG_ENTRY])
		expect(tagRequests()).toContain('/tags/design/entries?locale=en&page=1&type=category')
		expect(tagRequests()).toContain('/tags/design/entries?locale=en&page=1&type=tag')
	})

	it('gives each taxonomy page the same tag in every locale that lists it with entries', async () => {
		const byPath = await taxonomyPathsOf(sharedSlugTaxonomy())
		expect(alternatesOf(byPath.get('/br/categoria/design'))).toEqual(DESIGN_ALTERNATES)
		expect(alternatesOf(byPath.get('/es/categoria/diseno/page/2'))).toEqual(DESIGN_ALTERNATES)
		expect(alternatesOf(byPath.get('/tag/astro'))).toEqual(only('en', '/tag/astro'))
		expect(alternatesOf(byPath.get('/tag/design'))).toEqual(only('en', '/tag/design'))
	})

	it('asks for no tags without taxonomies', async () => {
		await sitePathsOf(taxonomyCatalog(), { ...TAXONOMY_CONFIG, taxonomies: {} })
		expect(tagRequests()).toEqual([])
	})

	it('names with urls.match every taxonomy page it lists', async () => {
		const paths = await sitePathsOf(taxonomyCatalog(), TAXONOMY_CONFIG)
		const urls = createUrls(TAXONOMY_CONFIG)
		const listed = paths.flatMap((path) => {
			const { page } = path.props
			return page.kind === 'taxonomy' ? [{ url: pathOf(path), page }] : []
		})
		expect(listed).toHaveLength(7)
		for (const { url, page } of listed) {
			expect(urls.match(url)).toStrictEqual({
				kind: 'taxonomy',
				locale: page.locale,
				type: page.tag.type,
				slug: page.tag.slug,
				page: page.page
			})
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
			page: LAST_PAGE,
			lastPage: LAST_PAGE
		})
		expect(await resolveAt(`/en/blog/page/${LAST_PAGE + 1}`)).toEqual({ kind: 'missing' })
	})

	it('answers page 1 of an empty collection', async () => {
		const resolved = await resolveAt('/artigos', { ...articlesCatalog(), entries: {} })
		expect(resolved).toMatchObject({
			kind: 'collection',
			locale: 'pt_BR',
			page: 1,
			lastPage: 1
		})
		expect(resolved).toMatchObject({ entries: { meta: { last_page: 0 } } })
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

	it('fetches a taxonomy page from the tag entries in the path locale', async () => {
		const resolved = await taxonomyAt('/br/categoria/design/pagina/2')
		expect(resolved).toMatchObject({
			kind: 'taxonomy',
			locale: 'pt_BR',
			page: 2,
			lastPage: 2,
			tag: { slug: 'design', type: 'category' }
		})
		expect(entrySlugs(resolved)).toEqual(['artigos-16', 'artigos-17'])
		expect(tagRequests().toSorted()).toEqual([
			'/tags/design/entries?locale=pt_BR&page=2&type=category',
			'/tags?locale=en&type=category',
			'/tags?locale=es&type=category',
			'/tags?locale=pt_BR&type=category'
		])
	})

	it('fetches only the category entries for a category page whose slug a tag shares', async () => {
		const resolved = await taxonomyAt('/category/design', taxonomyCatalog(sharedSlugTaxonomy()))
		const slugs = entrySlugs(resolved)
		expect(slugs).toHaveLength(TAG_PAGE_SIZE)
		expect(slugs).not.toContain(SHARED_SLUG_ENTRY)
		expect(tagRequests()).toContain('/tags/design/entries?locale=en&page=1&type=category')
	})

	it('gives a taxonomy page the same tag in the other locales', async () => {
		expect(alternatesOf(await taxonomyAt('/br/categoria/design/pagina/2'))).toEqual(
			DESIGN_ALTERNATES
		)
		expect(alternatesOf(await taxonomyAt('/tag/astro'))).toEqual(only('en', '/tag/astro'))
	})

	it('answers missing past the last page, for an empty or unknown tag, for the other type and for the slug of another locale', async () => {
		for (const path of [
			'/category/design/page/3',
			'/category/empty',
			'/category/unknown',
			'/tag/design',
			'/category/diseno',
			'/br/categoria/diseno',
			'/es/categoria/design'
		]) {
			expect(await taxonomyAt(path), path).toEqual({ kind: 'missing' })
		}
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
