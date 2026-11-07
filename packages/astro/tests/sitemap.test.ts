import type { CollectionRef, Entry, Homepage } from '@rushcms/client'
import type { RushSiteConfig } from '../src/config'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { renderSitemap, sitemapResponse } from '../src/sitemap'
import type { SitemapContext } from '../src/sitemap'
import { entryExample, homepageExample } from '../../client/tests/fixtures/contract'
import { SITE_PREFIX, apiError, entryListsByLocale, envelope, startStubApi } from './fixtures/api'
import type { StubApi } from './fixtures/api'
import {
	ARTICLES,
	LOCALE_PATHS,
	NEWS,
	newsOnly,
	routeContext,
	rushLocals,
	siteConfig
} from './fixtures/runtime'

type Catalog = {
	entries: Record<string, Entry[]>
	homepages: Record<string, Homepage>
	collections?: CollectionRef[]
}

const SITE = new URL('https://site.example')
const SITE_CONFIG = siteConfig({ localePaths: LOCALE_PATHS, defaultLocale: 'en' })
const NEWS_ONLY_CONFIG = newsOnly(SITE_CONFIG)
const NOT_FOUND = { error: 'not found', code: 'not_found', params: { resource: 'homepage' } }

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
		expect(locs(xml)).toEqual(['https://site.example/pt/artigos/ola-mundo'])
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

	it('includes the homepage of every locale that has its own, with alternates', async () => {
		const pt = { ...homepageExample(), updated_at: '2026-05-05T05:00:00Z' }
		const en = { ...pt, locale: 'en', updated_at: '2026-06-06T06:00:00Z' }
		const fallbackEs = { ...pt, locale: 'pt_BR', fallback: true }
		const xml = await sitemap({ entries: {}, homepages: { pt_BR: pt, en, es: fallbackEs } }, [
			'blog'
		])
		expect(locs(xml)).toEqual(['https://site.example/pt', 'https://site.example/en'])
		const block = blockFor(xml, 'https://site.example/pt')
		expect(block).toContain('<lastmod>2026-05-05T05:00:00Z</lastmod>')
		expect(block).toContain('hreflang="pt-BR" href="https://site.example/pt"')
		expect(block).toContain('hreflang="en" href="https://site.example/en"')
		expect(block).toContain('hreflang="x-default" href="https://site.example/en"')
		expect(block).not.toContain('hreflang="es"')
	})

	it('takes homepage alternates from the translations list', async () => {
		const pt = { ...homepageExample(), translations: ['pt_BR', 'es'] }
		const xml = await sitemap({ entries: {}, homepages: { pt_BR: pt } }, [])
		const block = blockFor(xml, 'https://site.example/pt')
		expect(block).toContain('hreflang="pt-BR" href="https://site.example/pt"')
		expect(block).toContain('hreflang="es" href="https://site.example/es"')
		expect(block).not.toContain('hreflang="en"')
		expect(block).not.toContain('x-default')
	})

	it('skips a locale without a homepage', async () => {
		const pt = { ...homepageExample(), translations: ['pt_BR'] }
		const xml = await sitemap({ entries: {}, homepages: { pt_BR: pt } }, [])
		expect(locs(xml)).toEqual(['https://site.example/pt'])
		expect(blockFor(xml, 'https://site.example/pt')).not.toContain('x-default')
	})

	it('walks every collection of the site when none is named', async () => {
		const xml = await sitemap({ entries: { pt_BR: [PT] }, homepages: {} })
		expect(locs(xml)).toEqual(['https://site.example/pt/artigos/ola-mundo'])
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
		expect(locs(xml)).toEqual(['https://site.example/en/news/launch'])
		expect(
			stub.requests.filter((request) => request.path.endsWith('/entries')).map((r) => r.path)
		).toEqual(
			['news', 'news', 'news'].map((slug) => `${SITE_PREFIX}/collections/${slug}/entries`)
		)
	})

	it('throws for a named collection that has no route', async () => {
		serve({ entries: {}, homepages: {} })
		await expect(
			sitemapResponse({ context: contextFor(SITE, NEWS_ONLY_CONFIG), collections: ['blog'] })
		).rejects.toThrow('collection "blog" has no route')
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
