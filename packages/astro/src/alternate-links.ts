import { alternates, toBcp47 } from '@rushcms/client'
import type {
	Alternate,
	Entry,
	Homepage,
	LocaleCode,
	RushClient,
	RushUrls,
	Tag
} from '@rushcms/client'
import { absoluteUrl } from './site-origin'
import { tagsByLocale } from './taxonomies'
import type { LocaleTags } from './taxonomies'

export type HreflangLink = {
	hreflang: string
	url: string
}

export const X_DEFAULT = 'x-default'

export function alternateIn(locale: LocaleCode, url: string): Alternate {
	return { locale, hreflang: toBcp47(locale), url }
}

export function homepageAlternates(urls: RushUrls): Alternate[] {
	return urls.locales.map((locale) => alternateIn(locale, urls.homepage(locale)))
}

export function collectionAlternates(collection: string, urls: RushUrls): Alternate[] {
	return urls.locales.flatMap((locale) => {
		const ref = urls.collectionRef(collection, locale)
		return ref !== undefined && urls.routed(ref)
			? [alternateIn(locale, urls.collection(ref, locale))]
			: []
	})
}

export function tagAlternates(lists: LocaleTags[], id: string, urls: RushUrls): Alternate[] {
	return lists.flatMap(({ locale, tags }) => {
		const tag = tags.find((candidate) => candidate.id === id)
		const url = tag === undefined ? undefined : urls.taxonomy(tag, locale)
		return url === undefined ? [] : [alternateIn(locale, url)]
	})
}

export async function taxonomyAlternates(
	tag: Tag,
	client: RushClient,
	urls: RushUrls
): Promise<Alternate[]> {
	return tagAlternates(await tagsByLocale(client, urls, tag.type), tag.id, urls)
}

export function alternateLinks(list: Alternate[], defaultLocale: LocaleCode): HreflangLink[] {
	const links = list.map(({ hreflang, url }) => ({ hreflang, url }))
	const fallback = list.find((alternate) => alternate.locale === defaultLocale)
	return fallback === undefined ? links : [...links, { hreflang: X_DEFAULT, url: fallback.url }]
}

export function hreflangLinks(
	source: Entry | Homepage,
	urls: RushUrls,
	defaultLocale: LocaleCode
): HreflangLink[] {
	return alternateLinks(alternates(source, urls), defaultLocale)
}

export function absoluteLinks(links: HreflangLink[], site: URL): HreflangLink[] {
	return links.map((link) => ({ ...link, url: absoluteUrl(link.url, site) }))
}
