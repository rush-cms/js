import { alternates, createUrls, toBcp47 } from '@rushcms/client'
import type { Entry, Homepage, LocaleCode } from '@rushcms/client'
import { siteConfig } from './site-config'

export type SwitcherLink = {
	locale: LocaleCode
	hreflang: string
	label: string
	url: string
	current: boolean
}

export type LocaleParams = {
	params: { locale: string }
}

export const urls = createUrls(siteConfig)

export function prefixOf(locale: LocaleCode): string {
	return siteConfig.localePaths[locale] ?? ''
}

export function localeOf(prefix: string | undefined): LocaleCode | undefined {
	return urls.locales.find((locale) => prefixOf(locale) === prefix)
}

export function localeParams(): LocaleParams[] {
	return urls.locales.map((locale) => ({ params: { locale: prefixOf(locale) } }))
}

export function tagPath(locale: LocaleCode, slug: string): string {
	return `${urls.homepage(locale)}/tags/${slug}`
}

export function contactPath(locale: LocaleCode): string {
	return `${urls.homepage(locale)}/contact`
}

export function entryPathIn(entry: Entry, locale: LocaleCode): string {
	return entry.fallback
		? `${urls.collection(entry.collection, locale)}/${entry.slug}`
		: urls.entry(entry)
}

export function switcherFor(current: LocaleCode, source?: Entry | Homepage): SwitcherLink[] {
	const translated = source === undefined ? [] : alternates(source, urls)
	return urls.locales.map((locale) => ({
		locale,
		hreflang: toBcp47(locale),
		label: prefixOf(locale).toUpperCase(),
		url: translated.find((link) => link.locale === locale)?.url ?? urls.homepage(locale),
		current: locale === current
	}))
}
