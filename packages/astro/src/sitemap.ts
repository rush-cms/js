import type { Alternate, Entry, LocaleCode, RushClient, RushUrls } from '@rushcms/client'
import {
	absoluteLinks,
	alternateLinks,
	collectionAlternates,
	homepageAlternates,
	hreflangLinks
} from './alternate-links'
import type { HreflangLink } from './alternate-links'
import { firstByKey } from './first-by-key'
import { getRush } from './get-rush'
import { localizedEntries } from './localized-entries'
import { runtimeOf } from './runtime'
import type { RushContext } from './runtime'
import { findHomepage } from './site-pages'
import { absoluteUrl, requireSite } from './site-origin'

export type SitemapContext = RushContext & {
	site: URL | undefined
}

export type SitemapOptions = {
	context: SitemapContext
	collections?: string[]
}

export type SitemapUrl = {
	loc: string
	lastmod: string | undefined
	links: HreflangLink[]
}

export type SitemapSource = {
	client: RushClient
	urls: RushUrls
	defaultLocale: LocaleCode
	site: URL
}

const XML_ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&apos;'
}

function escapeXml(value: string): string {
	return value.replace(/[&<>"']/g, (char) => XML_ESCAPES[char] ?? char)
}

function entryUrl(entry: Entry, source: SitemapSource): SitemapUrl {
	const { urls, site } = source
	return {
		loc: absoluteUrl(urls.entry(entry), site),
		lastmod: entry.updated_at,
		links: absoluteLinks(hreflangLinks(entry, urls, source.defaultLocale), site)
	}
}

async function entryUrls(collection: string, source: SitemapSource): Promise<SitemapUrl[]> {
	const found: SitemapUrl[] = []
	for await (const { entry } of localizedEntries(collection, source.client, source.urls)) {
		if (!entry.fallback) {
			found.push(entryUrl(entry, source))
		}
	}
	return found
}

function localizedUrls(
	list: Alternate[],
	source: SitemapSource,
	lastmods: (string | undefined)[] = []
): SitemapUrl[] {
	const links = absoluteLinks(alternateLinks(list, source.defaultLocale), source.site)
	return list.map((alternate, index) => ({
		loc: absoluteUrl(alternate.url, source.site),
		lastmod: lastmods[index],
		links
	}))
}

async function homepageLastmod(
	source: SitemapSource,
	locale: LocaleCode
): Promise<string | undefined> {
	const homepage = await findHomepage(source.client, locale)
	return homepage?.fallback === false ? homepage.updated_at : undefined
}

async function homepageUrls(source: SitemapSource): Promise<SitemapUrl[]> {
	const list = homepageAlternates(source.urls)
	const lastmods = await Promise.all(
		list.map((alternate) => homepageLastmod(source, alternate.locale))
	)
	return localizedUrls(list, source, lastmods)
}

function indexUrls(collection: string, source: SitemapSource): SitemapUrl[] {
	return localizedUrls(collectionAlternates(collection, source.urls), source)
}

function renderLink(link: HreflangLink): string {
	return `<xhtml:link rel="alternate" hreflang="${escapeXml(link.hreflang)}" href="${escapeXml(link.url)}"/>`
}

function renderUrl(url: SitemapUrl): string {
	return [
		'<url>',
		`<loc>${escapeXml(url.loc)}</loc>`,
		...(url.lastmod === undefined ? [] : [`<lastmod>${escapeXml(url.lastmod)}</lastmod>`]),
		...url.links.map(renderLink),
		'</url>'
	].join('')
}

export function renderSitemap(urls: SitemapUrl[]): string {
	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
		...urls.map(renderUrl),
		'</urlset>'
	].join('')
}

async function allCollections(source: SitemapSource): Promise<string[]> {
	const collections = await source.client.collections.list({ locale: source.defaultLocale })
	return collections
		.filter((collection) => source.urls.routed(collection))
		.map((collection) => collection.slug)
}

export async function collectSitemap(
	source: SitemapSource,
	collections?: string[]
): Promise<SitemapUrl[]> {
	const names = collections ?? (await allCollections(source))
	const groups = await Promise.all(names.map((name) => entryUrls(name, source)))
	return firstByKey(
		[
			...(await homepageUrls(source)),
			...names.flatMap((name) => indexUrls(name, source)),
			...groups.flat()
		],
		(url) => url.loc
	)
}

export async function sitemapResponse(options: SitemapOptions): Promise<Response> {
	const { context } = options
	const runtime = runtimeOf(context.locals)
	const urls = await collectSitemap(
		{
			client: getRush(context),
			urls: runtime.urls,
			defaultLocale: runtime.defaultLocale,
			site: requireSite(context.site, 'sitemapResponse')
		},
		options.collections
	)
	return new Response(renderSitemap(urls), {
		headers: { 'Content-Type': 'application/xml; charset=utf-8' }
	})
}
