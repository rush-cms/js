import type { CollectionRef, Entry, Homepage } from '@rushcms/client'
import type { RushSiteConfig } from '../src/config'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { renderSitemap, sitemapResponse } from '../src/sitemap'
import type { SitemapContext } from '../src/sitemap'
import { entryExample, homepageExample } from '../../client/tests/fixtures/contract'
import { COLLECTION_SLUGS } from '../../client/tests/fixtures/slugs'
import { TAXONOMIES, tagOf } from '../../client/tests/fixtures/taxonomies'
import type { TagInit } from '../../client/tests/fixtures/taxonomies'
import {
	SITE_PREFIX,
	apiError,
	entryListsByLocale,
	envelope,
	startStubApi,
	tagResponse
} from './fixtures/api'
import type { StubApi, TagCatalog } from './fixtures/api'
import {
	ARTICLES,
	LOCALE_PATHS,
	NEWS,
	SITE_ORIGIN,
	collectionsOf,
	newsOnly,
	routeContext,
	rushLocals,
	siteConfig
} from './fixtures/runtime'

type Catalog = {
	entries: Record<string, Entry[]>
	homepages: Record<string, Homepage>
	collections?: CollectionRef[]
	taxonomy?: TagCatalog
}

const SITE = new URL(SITE_ORIGIN)
const SITE_CONFIG = siteConfig({
	localePaths: LOCALE_PATHS,
	defaultLocale: 'en',
	collections: collectionsOf(ARTICLES, COLLECTION_SLUGS)
})
const NEWS_ONLY_CONFIG = newsOnly(SITE_CONFIG)
const ROOT_NEWS_CONFIG: RushSiteConfig = {
	...NEWS_ONLY_CONFIG,
	routes: { [NEWS.slug]: '/{locale}/{slug}' }
}
const HOMEPAGES = ['pt', 'en', 'es'].map((prefix) => `${SITE_ORIGIN}/${prefix}`)
const INDEXES = ['pt/artigos', 'en/blog', 'es/articulos'].map((path) => `${SITE_ORIGIN}/${path}`)
const NEWS_INDEXES = ['pt', 'en', 'es'].map((prefix) => `${SITE_ORIGIN}/${prefix}/news`)
const NOT_FOUND = { error: 'not found', code: 'not_found', params: { resource: 'homepage' } }
const TAXONOMY_CONFIG: RushSiteConfig = { ...SITE_CONFIG, taxonomies: TAXONOMIES }
const DESIGN: Omit<TagInit, 'slug'> = { type: 'category', id: 'category-design', entryCount: 20 }
const TAXONOMY: TagCatalog = {
	tags: {
		pt_BR: [
			tagOf({ ...DESIGN, slug: 'design' }),
			tagOf({ type: 'tag', slug: 'vazia', entryCount: 0 })
		],
		en: [tagOf({ ...DESIGN, slug: 'design' }), tagOf({ type: 'tag', slug: 'astro' })],
		es: [tagOf({ ...DESIGN, slug: 'diseno' })]
	},
	entries: {}
}

let stub: StubApi

function entry(overrides: Partial<Entry>): Entry {
	return { ...entryExample(), ...overrides }
}

function onlyPortuguese(slug: string, locale: string, fallback: boolean): Entry {
	return entry({
		id: `only-${locale}`,
		locale: 'pt_BR',
		slug,
		fallback,
		translations: { pt_BR: { slug, collection_slug: 'artigos' } },
		updated_at: '2026-03-03T03:00:00Z'
	})
}

function serve(catalog: Catalog): void {
	const entryLists = entryListsByLocale(catalog.entries)
	stub.handle((request) => {
		const tagged = tagResponse(catalog.taxonomy, request)
		if (tagged !== undefined) {
			return tagged
		}
		const locale = request.query.get('locale') ?? ''
		if (request.path === `${SITE_PREFIX}/homepage`) {
			const homepage = catalog.homepages[locale]
			return homepage === undefined ? apiError(404, NOT_FOUND) : envelope(homepage)
		}
		if (request.path === `${SITE_PREFIX}/collections`) {
			return envelope(catalog.collections ?? [{ id: ARTICLES, slug: 'blog' }])
		}
		return entryLists(request)
	})
}

function contextFor(site: URL | undefined, config: RushSiteConfig = SITE_CONFIG): SitemapContext {
	return { ...routeContext({ locals: rushLocals(stub.api, config) }), site }
}

function urlBlocks(xml: string): string[] {
	return [...xml.matchAll(/<url>.*?<\/url>/g)].map((match) => match[0])
}

function locs(xml: string): string[] {
	return [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1] ?? '')
}

function hreflangs(block: string): string[] {
	return [...block.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map(
		(match) => `${match[1] ?? ''} ${match[2] ?? ''}`
	)
}

function blockFor(xml: string, loc: string): string {
	return urlBlocks(xml).find((block) => block.includes(`<loc>${loc}</loc>`)) ?? ''
}

async function sitemap(
	catalog: Catalog,
	collections?: string[],
	config: RushSiteConfig = SITE_CONFIG
): Promise<string> {
	serve(catalog)
	const response = await sitemapResponse({
		context: contextFor(SITE, config),
		...(collections === undefined ? {} : { collections })
	})
	return response.text()
}

const PT = entry({ updated_at: '2026-02-02T02:00:00Z' })
const EN = entry({
	id: PT.id,
	locale: 'en',
	slug: 'hello-world',
	collection: { ...PT.collection, slug: 'blog' },
	updated_at: '2026-04-04T04:00:00Z'
})
const FALLBACK = onlyPortuguese('so-pt', 'fb', true)
const EVERY_LOCALE_FALLBACK = { pt_BR: [FALLBACK], en: [FALLBACK], es: [FALLBACK] }
const PT_HOME: Homepage = {
	...homepageExample(),
	locale: 'pt_BR',
	fallback: false,
	translations: ['pt_BR', 'en'],
	updated_at: '2026-05-05T05:00:00Z'
}
const EN_HOME: Homepage = { ...PT_HOME, locale: 'en', updated_at: '2026-06-06T06:00:00Z' }
const FALLBACK_HOME: Homepage = { ...PT_HOME, fallback: true }

beforeAll(async () => {
	stub = await startStubApi()
})

afterEach(() => {
	stub.requests.length = 0
})

afterAll(async () => {
	await stub.close()
})

describe('sitemap', () => {
	it('answers application/xml', async () => {
		serve({ entries: {}, homepages: {} })
		const response = await sitemapResponse({ context: contextFor(SITE), collections: ['blog'] })
		expect(response.headers.get('Content-Type')).toBe('application/xml; charset=utf-8')
		expect(await response.text()).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?><urlset/)
	})

	it('lists canonical entry urls with lastmod from updated_at', async () => {
		const xml = await sitemap({ entries: { pt_BR: [PT], en: [EN] }, homepages: {} }, ['blog'])
		expect(locs(xml)).toEqual([
			...HOMEPAGES,
			...INDEXES.slice(0, 2),
			'https://site.example/pt/artigos/ola-mundo',
			'https://site.example/en/blog/hello-world'
		])
		expect(blockFor(xml, 'https://site.example/pt/artigos/ola-mundo')).toContain(
			'<lastmod>2026-02-02T02:00:00Z</lastmod>'
		)
		expect(blockFor(xml, 'https://site.example/en/blog/hello-world')).toContain(
			'<lastmod>2026-04-04T04:00:00Z</lastmod>'
		)
	})

	it('excludes fallback pages', async () => {
		const xml = await sitemap(
			{ entries: { pt_BR: [PT], en: [FALLBACK], es: [FALLBACK] }, homepages: {} },
			['blog']
		)
		expect(locs(xml)).toEqual([
			...HOMEPAGES,
			...INDEXES,
			'https://site.example/pt/artigos/ola-mundo'
		])
		expect(xml).not.toContain('so-pt')
	})

	it('emits xhtml alternates for every translation plus x-default', async () => {
		const xml = await sitemap({ entries: { pt_BR: [PT] }, homepages: {} }, ['blog'])
		const block = blockFor(xml, 'https://site.example/pt/artigos/ola-mundo')
		expect(block).toContain(
			'<xhtml:link rel="alternate" hreflang="pt-BR" href="https://site.example/pt/artigos/ola-mundo"/>'
		)
		expect(block).toContain(
			'<xhtml:link rel="alternate" hreflang="en" href="https://site.example/en/blog/hello-world"/>'
		)
		expect(block).toContain(
			'<xhtml:link rel="alternate" hreflang="es" href="https://site.example/es/articulos/hola-mundo"/>'
		)
		expect(block).toContain(
			'<xhtml:link rel="alternate" hreflang="x-default" href="https://site.example/en/blog/hello-world"/>'
		)
	})

	it('points x-default at the root-prefix locale when one exists', async () => {
		const config: RushSiteConfig = {
			...SITE_CONFIG,
			localePaths: { pt_BR: '', en: 'en', es: 'es' }
		}
		const xml = await sitemap({ entries: { pt_BR: [PT] }, homepages: {} }, ['blog'], config)
		const links = hreflangs(blockFor(xml, 'https://site.example/artigos/ola-mundo'))
		expect(links).toContain('x-default https://site.example/artigos/ola-mundo')
		expect(links).not.toContain('x-default https://site.example/en/blog/hello-world')
	})

	it('lists only the homepages that are not a fallback, with lastmod from each', async () => {
		const xml = await sitemap(
			{ entries: {}, homepages: { pt_BR: PT_HOME, en: EN_HOME, es: FALLBACK_HOME } },
			[]
		)
		expect(locs(xml)).toEqual([`${SITE_ORIGIN}/pt`, `${SITE_ORIGIN}/en`])
		expect(blockFor(xml, `${SITE_ORIGIN}/pt`)).toContain(
			'<lastmod>2026-05-05T05:00:00Z</lastmod>'
		)
		expect(blockFor(xml, `${SITE_ORIGIN}/en`)).toContain(
			'<lastmod>2026-06-06T06:00:00Z</lastmod>'
		)
		for (const loc of [`${SITE_ORIGIN}/pt`, `${SITE_ORIGIN}/en`]) {
			expect(hreflangs(blockFor(xml, loc))).toEqual([
				`pt-BR ${SITE_ORIGIN}/pt`,
				`en ${SITE_ORIGIN}/en`,
				`x-default ${SITE_ORIGIN}/en`
			])
		}
	})

	it('skips the locales served by a fallback homepage when only pt_BR has one', async () => {
		const xml = await sitemap(
			{ entries: {}, homepages: { pt_BR: PT_HOME, en: FALLBACK_HOME, es: FALLBACK_HOME } },
			[]
		)
		expect(locs(xml)).toEqual([`${SITE_ORIGIN}/pt`])
		expect(hreflangs(blockFor(xml, `${SITE_ORIGIN}/pt`))).toEqual([`pt-BR ${SITE_ORIGIN}/pt`])
	})

	it('skips the locales whose homepage answers 404 when another locale has one', async () => {
		const xml = await sitemap({ entries: {}, homepages: { pt_BR: PT_HOME } }, [])
		expect(locs(xml)).toEqual([`${SITE_ORIGIN}/pt`])
	})

	it('lists every front page, with alternates plus x-default, when no locale has a homepage', async () => {
		const xml = await sitemap({ entries: {}, homepages: {} }, [])
		expect(locs(xml)).toEqual(HOMEPAGES)
		for (const loc of HOMEPAGES) {
			const block = blockFor(xml, loc)
			expect(block).not.toContain('<lastmod>')
			expect(hreflangs(block)).toEqual([
				...HOMEPAGES.map((url, index) => `${['pt-BR', 'en', 'es'][index]} ${url}`),
				`x-default ${SITE_ORIGIN}/en`
			])
		}
	})

	it('lists page 1 of every collection in every locale, with alternates and no lastmod', async () => {
		const xml = await sitemap({ entries: EVERY_LOCALE_FALLBACK, homepages: {} })
		expect(locs(xml)).toEqual([...HOMEPAGES, ...INDEXES])
		expect(xml).not.toContain('/page/')
		for (const loc of INDEXES) {
			const block = blockFor(xml, loc)
			expect(block).not.toContain('<lastmod>')
			expect(block).toContain('hreflang="pt-BR" href="https://site.example/pt/artigos"')
			expect(block).toContain('hreflang="en" href="https://site.example/en/blog"')
			expect(block).toContain('hreflang="es" href="https://site.example/es/articulos"')
			expect(block).toContain('hreflang="x-default" href="https://site.example/en/blog"')
		}
	})

	it('lists a collection index only in the locales whose listing has entries, for every subset', async () => {
		const locales = ['pt_BR', 'en', 'es']
		const hreflangOf = ['pt-BR', 'en', 'es']
		for (let mask = 0; mask < 2 ** locales.length; mask += 1) {
			const listed = locales.filter((_, index) => (mask >> index) & 1)
			const entries = Object.fromEntries(
				listed.map((locale, index) => [locale, [index % 2 === 0 ? FALLBACK : PT]])
			)
			const xml = await sitemap({ entries, homepages: {} }, ['blog'])
			const kept = INDEXES.flatMap((loc, index) =>
				listed.includes(locales[index] ?? '') ? [`${hreflangOf[index] ?? ''} ${loc}`] : []
			)
			const expected = kept.map((link) => link.split(' ')[1] ?? '')
			expect(
				locs(xml).filter((loc) => INDEXES.includes(loc)),
				listed.join()
			).toEqual(expected)
			const xDefault = listed.includes('en') ? [`x-default ${SITE_ORIGIN}/en/blog`] : []
			for (const loc of expected) {
				expect(hreflangs(blockFor(xml, loc)), listed.join()).toEqual([...kept, ...xDefault])
			}
		}
	})

	it('never lists a collection index that shares a homepage URL', async () => {
		const xml = await sitemap(
			{ entries: {}, homepages: { pt_BR: PT_HOME, en: FALLBACK_HOME }, collections: [NEWS] },
			undefined,
			ROOT_NEWS_CONFIG
		)
		expect(locs(xml)).toEqual([`${SITE_ORIGIN}/pt`])
		expect(blockFor(xml, `${SITE_ORIGIN}/pt`)).toContain(
			'<lastmod>2026-05-05T05:00:00Z</lastmod>'
		)
	})

	it('walks every collection of the site when none is named', async () => {
		const xml = await sitemap({ entries: { pt_BR: [PT] }, homepages: {} })
		expect(locs(xml)).toEqual([
			...HOMEPAGES,
			INDEXES[0],
			'https://site.example/pt/artigos/ola-mundo'
		])
	})

	it('walks only the collections that have a route when none is named', async () => {
		const launch = entry({
			id: 'news-launch',
			locale: 'en',
			slug: 'launch',
			collection: NEWS,
			translations: { en: { slug: 'launch', collection_slug: 'news' } }
		})
		const xml = await sitemap(
			{
				entries: { en: [launch] },
				homepages: {},
				collections: [{ id: ARTICLES, slug: 'blog' }, NEWS]
			},
			undefined,
			NEWS_ONLY_CONFIG
		)
		expect(locs(xml)).toEqual([
			...HOMEPAGES,
			NEWS_INDEXES[1],
			'https://site.example/en/news/launch'
		])
		expect(
			stub.requests.filter((request) => request.path.endsWith('/entries')).map((r) => r.path)
		).toEqual(
			['news', 'news', 'news'].map((slug) => `${SITE_PREFIX}/collections/${slug}/entries`)
		)
	})

	it('lists only the named collections', async () => {
		const xml = await sitemap(
			{
				entries: EVERY_LOCALE_FALLBACK,
				homepages: {},
				collections: [{ id: ARTICLES, slug: 'blog' }, NEWS]
			},
			['news'],
			NEWS_ONLY_CONFIG
		)
		expect(locs(xml)).toEqual([...HOMEPAGES, ...NEWS_INDEXES])
	})

	it('throws for a named collection that has no route', async () => {
		serve({ entries: {}, homepages: {} })
		await expect(
			sitemapResponse({ context: contextFor(SITE, NEWS_ONLY_CONFIG), collections: ['blog'] })
		).rejects.toThrow('collection "blog" has no route')
	})

	it('lists page 1 of every tag with entries in every locale, with alternates by tag id', async () => {
		const xml = await sitemap(
			{ entries: {}, homepages: {}, taxonomy: TAXONOMY },
			[],
			TAXONOMY_CONFIG
		)
		const design = ['pt/categoria/design', 'en/category/design', 'es/categoria/diseno'].map(
			(path) => `${SITE_ORIGIN}/${path}`
		)
		expect(locs(xml)).toEqual([...HOMEPAGES, ...design, `${SITE_ORIGIN}/en/tag/astro`])
		for (const loc of design) {
			const block = blockFor(xml, loc)
			expect(block).not.toContain('<lastmod>')
			expect(hreflangs(block)).toEqual([
				`pt-BR ${SITE_ORIGIN}/pt/categoria/design`,
				`en ${SITE_ORIGIN}/en/category/design`,
				`es ${SITE_ORIGIN}/es/categoria/diseno`,
				`x-default ${SITE_ORIGIN}/en/category/design`
			])
		}
		expect(hreflangs(blockFor(xml, `${SITE_ORIGIN}/en/tag/astro`))).toEqual([
			`en ${SITE_ORIGIN}/en/tag/astro`,
			`x-default ${SITE_ORIGIN}/en/tag/astro`
		])
		expect(xml).not.toContain('vazia')
	})

	it('asks for no tags without taxonomies', async () => {
		await sitemap({ entries: {}, homepages: {}, taxonomy: TAXONOMY }, [])
		expect(stub.requests.filter((request) => request.path.endsWith('/tags'))).toEqual([])
	})

	it('escapes xml in urls', () => {
		const xml = renderSitemap([
			{ loc: 'https://site.example/a?x=1&y=<2>', lastmod: '2026-01-01T00:00:00Z', links: [] }
		])
		expect(xml).toContain('<loc>https://site.example/a?x=1&amp;y=&lt;2&gt;</loc>')
	})

	it('fails clearly without the site option', async () => {
		serve({ entries: {}, homepages: {} })
		await expect(
			sitemapResponse({ context: contextFor(undefined), collections: [] })
		).rejects.toThrow('needs "site" set in astro.config')
	})
})
