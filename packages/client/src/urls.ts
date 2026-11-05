import { toBcp47 } from './locales'
import type { Entry, LocaleCode, NavigationItem, RushLocalePaths, RushRoutes } from './types'

const DEFAULT_PATTERN = '/{locale}/{collection}/{slug}'

export type UrlConfig = {
	routes?: RushRoutes
	localePaths: RushLocalePaths
}

export type RushUrls = {
	locales: LocaleCode[]
	entry(entry: Entry): string
	translation(entry: Entry, locale: LocaleCode): string
	homepage(locale: LocaleCode): string
	navigationItem(item: NavigationItem): string | undefined
}

export type Alternate = {
	locale: LocaleCode
	hreflang: string
	url: string
}

type UrlParts = {
	locale: LocaleCode
	collection: string
	slug: string
}

function normalize(path: string): string {
	const collapsed = path.replace(/\/{2,}/g, '/')
	const trimmed = collapsed.length > 1 ? collapsed.replace(/\/$/, '') : collapsed
	return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function assertSingleEmptyPrefix(localePaths: RushLocalePaths): void {
	const empty = Object.entries(localePaths).filter(([, prefix]) => prefix === '')
	if (empty.length > 1) {
		throw new Error(
			`localePaths has more than one empty prefix: ${empty.map(([locale]) => locale).join(', ')}`
		)
	}
}

export function createUrls(config: UrlConfig): RushUrls {
	assertSingleEmptyPrefix(config.localePaths)
	const routes = config.routes ?? {}
	const localeOrder = Object.keys(config.localePaths)

	function prefixOf(locale: LocaleCode): string {
		const prefix = config.localePaths[locale]
		if (prefix === undefined) {
			throw new Error(`locale "${locale}" is missing from localePaths`)
		}
		return prefix
	}

	function patternFor(collectionSlugs: string[]): string {
		const key = collectionSlugs.find((slug) => slug in routes)
		return key === undefined ? DEFAULT_PATTERN : (routes[key] ?? DEFAULT_PATTERN)
	}

	function build(pattern: string, parts: UrlParts): string {
		return normalize(
			pattern
				.replaceAll('{locale}', prefixOf(parts.locale))
				.replaceAll('{collection}', parts.collection)
				.replaceAll('{slug}', parts.slug)
		)
	}

	function collectionSlugsOf(entry: Entry): string[] {
		return [
			entry.collection.slug,
			...Object.values(entry.translations).map((translation) => translation.collection_slug)
		]
	}

	function translation(entry: Entry, locale: LocaleCode): string {
		const target = entry.translations[locale]
		if (target === undefined) {
			throw new Error(`entry "${entry.id}" has no translation for locale "${locale}"`)
		}
		return build(patternFor(collectionSlugsOf(entry)), {
			locale,
			collection: target.collection_slug,
			slug: target.slug
		})
	}

	return {
		locales: localeOrder,
		entry: (entry) => translation(entry, entry.locale),
		translation,
		homepage: (locale) => normalize(`/${prefixOf(locale)}`),
		navigationItem: (item) => {
			const summary = item.target?.entry
			if (summary !== undefined) {
				return build(patternFor([summary.collection.slug]), {
					locale: summary.locale,
					collection: summary.collection.slug,
					slug: summary.slug
				})
			}
			return item.target?.url
		}
	}
}

export function alternates(entry: Entry, urls: RushUrls): Alternate[] {
	return Object.keys(entry.translations)
		.map((locale) => ({
			locale,
			hreflang: toBcp47(locale),
			url: urls.translation(entry, locale)
		}))
		.sort((a, b) => urls.locales.indexOf(a.locale) - urls.locales.indexOf(b.locale))
}
