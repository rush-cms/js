import { alternates } from '@rushcms/client'
import type { Entry, LocaleCode, RushUrls } from '@rushcms/client'
import { absoluteUrl } from './site-origin'

export type HreflangLink = {
	hreflang: string
	url: string
}

export const X_DEFAULT = 'x-default'

export function hreflangLinks(
	entry: Entry,
	urls: RushUrls,
	defaultLocale: LocaleCode
): HreflangLink[] {
	const links = alternates(entry, urls).map(({ hreflang, url }) => ({ hreflang, url }))
	return Object.hasOwn(entry.translations, defaultLocale)
		? [...links, { hreflang: X_DEFAULT, url: urls.translation(entry, defaultLocale) }]
		: links
}

export function absoluteLinks(links: HreflangLink[], site: URL): HreflangLink[] {
	return links.map((link) => ({ ...link, url: absoluteUrl(link.url, site) }))
}
