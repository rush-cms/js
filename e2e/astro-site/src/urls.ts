import { alternates, createUrls, toBcp47 } from '@rushcms/client'
import type { Entry, Homepage, LocaleCode, RouteParams, RushUrls } from '@rushcms/client'
import { siteConfig } from './site-config'

export type SwitcherLink = {
	locale: LocaleCode
	hreflang: string
	label: string
	url: string
	current: boolean
}

export type LocaleParams = {
	params: { locale: string | undefined }
}

export const localeUrls = createUrls({ localePaths: siteConfig.localePaths })

export function hasUnknownLocale(params: RouteParams): boolean {
	return Object.hasOwn(params, 'locale') && localeUrls.localeOf(params.locale) === undefined
}

export function pageLocale(params: RouteParams): LocaleCode {
	const locale = localeUrls.localeOf(params.locale)
	if (locale === undefined) {
		throw new Error(`no locale for the route segment "${params.locale}"`)
	}
	return locale
}

export function localeParams(): LocaleParams[] {
	return localeUrls.locales.map((locale) => ({
		params: { locale: localeUrls.localeParam(locale) }
	}))
}

export function hasCollectionSegment(params: RouteParams): boolean {
	return params['collection'] !== undefined
}

export function tagPath(locale: LocaleCode, slug: string): string {
	return `${localeUrls.homepage(locale)}/tags/${slug}`
}

export function contactPath(locale: LocaleCode): string {
	return `${localeUrls.homepage(locale)}/contact`
}

export function switcherFor(
	urls: RushUrls,
	current: LocaleCode,
	source?: Entry | Homepage
): SwitcherLink[] {
	const translated = source === undefined ? [] : alternates(source, urls)
	return urls.locales.map((locale) => ({
		locale,
		hreflang: toBcp47(locale),
		label: (urls.localeParam(locale) ?? locale).toUpperCase(),
		url: translated.find((link) => link.locale === locale)?.url ?? urls.homepage(locale),
		current: locale === current
	}))
}
