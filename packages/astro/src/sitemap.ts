import { alternates } from '@rushcms/client'
import type { Alternate, Entry, Homepage, LocaleCode, RushClient, RushUrls } from '@rushcms/client'
import {
	collectionAlternates,
	homepageAlternates,
	hreflangLinks,
	tagAlternates
} from './alternate-links'
import type { HreflangLink } from './alternate-links'
import { firstByKey } from './first-by-key'
import { getRush } from './get-rush'
import { localizedEntries } from './localized-entries'
import { runtimeOf } from './runtime'
import type { RushContext } from './runtime'
import { findHomepage } from './site-pages'
import { absoluteUrl, requireSite } from './site-origin'
import { tagsByLocale } from './taxonomies'
import type { LocaleTags } from './taxonomies'

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

type ListedHomepage = {
	alternate: Alternate
	lastmod: string
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
		links: hreflangLinks(alternates(entry, urls), urls, source.defaultLocale, site)
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
	const links = hreflangLinks(list, source.urls, source.defaultLocale, source.site)
	return list.map((alternate, index) => ({
		loc: absoluteUrl(alternate.url, source.site),
		lastmod: lastmods[index],
		links
	}))
}

function ownHomepages(list: Alternate[], homepages: (Homepage | undefined)[]): ListedHomepage[] {
	return list.flatMap((alternate, index) => {
		const homepage = homepages[index]
		return homepage?.fallback === false ? [{ alternate, lastmod: homepage.updated_at }] : []
	})
}

async function homepageUrls(source: SitemapSource): Promise<SitemapUrl[]> {
	const list = homepageAlternates(source.urls)
	const homepages = await Promise.all(
		list.map((alternate) => findHomepage(source.client, alternate.locale))
	)
	if (homepages.every((homepage) => homepage === undefined)) {
		return localizedUrls(list, source)
	}
	const listed = ownHomepages(list, homepages)
	return localizedUrls(
		listed.map((item) => item.alternate),
		source,
		listed.map((item) => item.lastmod)
	)
}

function indexUrls(collection: string, source: SitemapSource): SitemapUrl[] {
	const homepages = new Set(homepageAlternates(source.urls).map((alternate) => alternate.url))
	const list = collectionAlternates(collection, source.urls).filter(
		(alternate) => !homepages.has(alternate.url)
	)
	return localizedUrls(list, source)
}

function typeUrls(lists: LocaleTags[], source: SitemapSource): SitemapUrl[] {
	const tags = firstByKey(
		lists.flatMap((list) => list.tags),
		(tag) => tag.id
	)
	return tags.flatMap((tag) => localizedUrls(tagAlternates(lists, tag.id, source.urls), source))
}

async function taxonomyUrls(source: SitemapSource): Promise<SitemapUrl[]> {
	const { client, urls } = source
	const groups = await Promise.all(
		urls.taxonomyTypes.map((type) => tagsByLocale(client, urls, type))
	)
	return groups.flatMap((lists) => typeUrls(lists, source))
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
			...groups.flat(),
			...(await taxonomyUrls(source))
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
