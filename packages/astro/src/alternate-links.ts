import { alternates, translatedLocales, translatedUrl } from '@rushcms/client'
import type { Entry, Homepage, LocaleCode, RushUrls } from '@rushcms/client'
import { absoluteUrl } from './site-origin'

export type HreflangLink = {
	hreflang: string
	url: string
}

export const X_DEFAULT = 'x-default'

export function hreflangLinks(
	source: Entry | Homepage,
	urls: RushUrls,
	defaultLocale: LocaleCode
): HreflangLink[] {
	const links = alternates(source, urls).map(({ hreflang, url }) => ({ hreflang, url }))
	return translatedLocales(source).includes(defaultLocale)
		? [...links, { hreflang: X_DEFAULT, url: translatedUrl(source, defaultLocale, urls) }]
		: links
}

export function absoluteLinks(links: HreflangLink[], site: URL): HreflangLink[] {
	return links.map((link) => ({ ...link, url: absoluteUrl(link.url, site) }))
}
