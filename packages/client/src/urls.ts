import type { MovedParams } from './errors'
import { toBcp47 } from './locales'
import type {
	Entry,
	Homepage,
	LocaleCode,
	NavigationItem,
	RushLocalePaths,
	RushRoutes
} from './types'

const DEFAULT_PATTERN = '/{locale}/{collection}/{slug}'

export type UrlConfig = {
	routes?: RushRoutes
	routeKeysById?: Record<string, string>
	localePaths: RushLocalePaths
}

export type RushUrls = {
	readonly locales: readonly LocaleCode[]
	localeOf(param: string | undefined): LocaleCode | undefined
	localeParam(locale: LocaleCode): string | undefined
	collection(collection: CollectionRef, locale: LocaleCode): string
	entry(entry: Entry): string
	entryPathIn(entry: Entry, locale: LocaleCode): string
	translation(entry: Entry, locale: LocaleCode): string
	moved(params: MovedParams): string
	entryParams(collection: CollectionRef, locale: LocaleCode, slug: string): RouteParams
	homepage(locale: LocaleCode): string
	navigationItem(item: NavigationItem, locale: LocaleCode): string | undefined
}

export type Alternate = {
	locale: LocaleCode
	hreflang: string
	url: string
}

export type CollectionRef = Entry['collection']

export type RouteParams = Record<string, string | undefined>

type UrlParts = {
	locale: LocaleCode
	collection: string
	slug: string
}

type EntryTarget = {
	collection: CollectionRef
	collectionSlugs: string[]
	parts: UrlParts
}

const SLUG_SEGMENT = '{slug}'
const PLACEHOLDER = /\{(locale|collection|slug)\}/g

function segmentsOf(pattern: string): string[] {
	return pattern.split('/').filter((segment) => segment !== '')
}

function assertSlugLast(key: string, segments: string[]): void {
	const index = segments.findIndex((segment) => segment.includes(SLUG_SEGMENT))
	const valid =
		index === -1 || (index === segments.length - 1 && segments[index] === SLUG_SEGMENT)
	if (!valid) {
		throw new Error(`route "${key}" must have {slug} as its last path segment`)
	}
}

function assertPlainPrefixes(localePaths: RushLocalePaths): void {
	for (const [locale, prefix] of Object.entries(localePaths)) {
		if (prefix.includes('/')) {
			throw new Error(`localePaths prefix for "${locale}" must not contain "/"`)
		}
	}
}

function assertSingleEmptyPrefix(localePaths: RushLocalePaths): void {
	const empty = Object.entries(localePaths).filter(([, prefix]) => prefix === '')
	if (empty.length > 1) {
		throw new Error(
			`localePaths has more than one empty prefix: ${empty.map(([locale]) => locale).join(', ')}`
		)
	}
}

function parseRoutes(routes: RushRoutes): Map<string, string[]> {
	const parsed = new Map<string, string[]>()
	for (const [key, pattern] of Object.entries(routes)) {
		const segments = segmentsOf(pattern)
		assertSlugLast(key, segments)
		parsed.set(key, segments)
	}
	return parsed
}

export function createUrls(config: UrlConfig): RushUrls {
	assertPlainPrefixes(config.localePaths)
	assertSingleEmptyPrefix(config.localePaths)
	const routeSegments = parseRoutes(config.routes ?? {})
	const routeKeysById = config.routeKeysById ?? {}
	const localeOrder = Object.keys(config.localePaths)
	const defaultSegments = segmentsOf(DEFAULT_PATTERN)

	function prefixOf(locale: LocaleCode): string {
		if (!Object.hasOwn(config.localePaths, locale)) {
			throw new Error(`locale "${locale}" is missing from localePaths`)
		}
		return config.localePaths[locale] ?? ''
	}

	function segmentsFor(collectionId: string, collectionSlugs: string[]): string[] {
		const idKey = Object.hasOwn(routeKeysById, collectionId)
			? routeKeysById[collectionId]
			: undefined
		const key =
			idKey !== undefined && routeSegments.has(idKey)
				? idKey
				: collectionSlugs.find((slug) => routeSegments.has(slug))
		return (key === undefined ? undefined : routeSegments.get(key)) ?? defaultSegments
	}

	function valuesOf(parts: UrlParts): Record<string, string> {
		return { locale: prefixOf(parts.locale), collection: parts.collection, slug: parts.slug }
	}

	function build(segments: string[], parts: UrlParts): string {
		const values = valuesOf(parts)
		const filled = segments
			.map((segment) => segment.replace(PLACEHOLDER, (_, name: string) => values[name] ?? ''))
			.filter((segment) => segment !== '')
		return `/${filled.join('/')}`
	}

	function buildEntry(target: EntryTarget): string {
		return build(segmentsFor(target.collection.id, target.collectionSlugs), target.parts)
	}

	function entryPath(entry: Entry, parts: UrlParts): string {
		return buildEntry({
			collection: entry.collection,
			collectionSlugs: [
				entry.collection.slug,
				...Object.values(entry.translations).map((item) => item.collection_slug)
			],
			parts
		})
	}

	function translation(entry: Entry, locale: LocaleCode): string {
		const target = Object.hasOwn(entry.translations, locale)
			? entry.translations[locale]
			: undefined
		if (target === undefined) {
			throw new Error(`entry "${entry.id}" has no translation for locale "${locale}"`)
		}
		return entryPath(entry, { locale, collection: target.collection_slug, slug: target.slug })
	}

	function entryPathIn(entry: Entry, locale: LocaleCode): string {
		return Object.hasOwn(entry.translations, locale)
			? translation(entry, locale)
			: entryPath(entry, { locale, collection: entry.collection.slug, slug: entry.slug })
	}

	function pathIn(ref: CollectionRef, locale: LocaleCode, slug: string): string {
		return buildEntry({
			collection: ref,
			collectionSlugs: [ref.slug],
			parts: { locale, collection: ref.slug, slug }
		})
	}

	function collection(ref: CollectionRef, locale: LocaleCode): string {
		const segments = segmentsFor(ref.id, [ref.slug])
		const index = segments.at(-1) === SLUG_SEGMENT ? segments.slice(0, -1) : segments
		return build(index, { locale, collection: ref.slug, slug: '' })
	}

	function entryParams(ref: CollectionRef, locale: LocaleCode, slug: string): RouteParams {
		const values = valuesOf({ locale, collection: ref.slug, slug })
		const names = segmentsFor(ref.id, [ref.slug])
			.flatMap((segment) => [...segment.matchAll(PLACEHOLDER)])
			.map((match) => match[1] ?? '')
		return Object.fromEntries(
			[...new Set(names)].map((name) => [name, values[name] || undefined])
		)
	}

	return {
		collection,
		entryParams,
		locales: localeOrder,
		localeOf: (param) =>
			localeOrder.find((locale) => config.localePaths[locale] === (param ?? '')),
		localeParam: (locale) => prefixOf(locale) || undefined,
		entry: (entry) => translation(entry, entry.locale),
		entryPathIn,
		translation,
		moved: (params) =>
			pathIn(
				{ id: params.collection_id, slug: params.collection_slug },
				params.locale,
				params.slug
			),
		homepage: (locale) => build(['{locale}'], { locale, collection: '', slug: '' }),
		navigationItem: (item, locale) => {
			const summary = item.target?.entry
			if (summary !== undefined) {
				return pathIn(summary.collection, summary.locale, summary.slug)
			}
			const ref = item.target?.collection
			if (ref !== undefined) {
				return collection(ref, locale)
			}
			return item.target?.url
		}
	}
}

function isHomepage(source: Entry | Homepage): source is Homepage {
	return Array.isArray(source.translations)
}

export function translatedLocales(source: Entry | Homepage): LocaleCode[] {
	return isHomepage(source) ? [...source.translations] : Object.keys(source.translations)
}

export function translatedUrl(
	source: Entry | Homepage,
	locale: LocaleCode,
	urls: RushUrls
): string {
	return isHomepage(source) ? urls.homepage(locale) : urls.translation(source, locale)
}

export function alternates(source: Entry | Homepage, urls: RushUrls): Alternate[] {
	return translatedLocales(source)
		.map((locale) => ({
			locale,
			hreflang: toBcp47(locale),
			url: translatedUrl(source, locale, urls)
		}))
		.sort((a, b) => urls.locales.indexOf(a.locale) - urls.locales.indexOf(b.locale))
}
