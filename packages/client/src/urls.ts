import type { MovedParams } from './errors'
import { toBcp47 } from './locales'
import type {
	Collection,
	Entry,
	Homepage,
	LocaleCode,
	NavigationItem,
	RushLocalePaths,
	RushRoutes
} from './types'

const DEFAULT_PATTERN = '/{locale}/{collection}/{slug}'

export type CollectionSlug = Pick<Collection, 'id' | 'slug'>

export type RushCollections = Record<LocaleCode, CollectionSlug[]>

export type UrlConfig = {
	routes?: RushRoutes
	localePaths: RushLocalePaths
	collections?: RushCollections
}

export type RushUrls = {
	readonly locales: readonly LocaleCode[]
	localeOf(param: string | undefined): LocaleCode | undefined
	localeParam(locale: LocaleCode): string | undefined
	collectionRef(key: string, locale: LocaleCode): CollectionRef | undefined
	collectionSlug(key: string, locale: LocaleCode): string
	collectionKeys(entry: Entry): string[]
	collection(collection: CollectionRef, locale: LocaleCode): string
	entry(entry: Entry): string
	servedPath(entry: Entry, requestedLocale: LocaleCode): string
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

type CollectionIndex = {
	slugsById: Map<string, Map<LocaleCode, string>>
	idByKey: Map<string, string>
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

function indexCollections(collections: RushCollections): CollectionIndex {
	const slugsById = new Map<string, Map<LocaleCode, string>>()
	const idByKey = new Map<string, string>()
	for (const [locale, list] of Object.entries(collections)) {
		for (const { id, slug } of list) {
			const slugs = slugsById.get(id) ?? new Map<LocaleCode, string>()
			slugs.set(locale, slug)
			slugsById.set(id, slugs)
			for (const key of [id, slug]) {
				if (!idByKey.has(key)) {
					idByKey.set(key, id)
				}
			}
		}
	}
	return { slugsById, idByKey }
}

function placeholdersOf(segments: string[]): string[] {
	const names = segments
		.flatMap((segment) => [...segment.matchAll(PLACEHOLDER)])
		.map((match) => match[1] ?? '')
	return [...new Set(names)]
}

export function createUrls(config: UrlConfig): RushUrls {
	assertPlainPrefixes(config.localePaths)
	assertSingleEmptyPrefix(config.localePaths)
	const routeSegments = parseRoutes(config.routes ?? {})
	const { slugsById, idByKey } = indexCollections(config.collections ?? {})
	const localeOrder = Object.keys(config.localePaths)
	const defaultSegments = segmentsOf(DEFAULT_PATTERN)

	function prefixOf(locale: LocaleCode): string {
		if (!Object.hasOwn(config.localePaths, locale)) {
			throw new Error(`locale "${locale}" is missing from localePaths`)
		}
		return config.localePaths[locale] ?? ''
	}

	function keysOf(id: string, slugs: string[]): string[] {
		return [...new Set([id, ...slugs, ...(slugsById.get(id)?.values() ?? [])])]
	}

	function segmentsFor(keys: string[]): string[] {
		const key = keys.find((candidate) => routeSegments.has(candidate))
		return (key === undefined ? undefined : routeSegments.get(key)) ?? defaultSegments
	}

	function localeParam(locale: LocaleCode): string | undefined {
		return prefixOf(locale) || undefined
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

	function collectionKeys(entry: Entry): string[] {
		return keysOf(entry.collection.id, [
			entry.collection.slug,
			...Object.values(entry.translations).map((item) => item.collection_slug)
		])
	}

	function entryPath(entry: Entry, parts: UrlParts): string {
		return build(segmentsFor(collectionKeys(entry)), parts)
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

	function servedPath(entry: Entry, requestedLocale: LocaleCode): string {
		const translated = Object.hasOwn(entry.translations, requestedLocale)
		if (entry.fallback ? translated : entry.locale !== requestedLocale) {
			throw new Error(`entry "${entry.id}" was not fetched for locale "${requestedLocale}"`)
		}
		return entryPath(entry, {
			locale: requestedLocale,
			collection: entry.collection.slug,
			slug: entry.slug
		})
	}

	function refSegments(ref: CollectionRef): string[] {
		return segmentsFor(keysOf(ref.id, [ref.slug]))
	}

	function pathIn(ref: CollectionRef, locale: LocaleCode, slug: string): string {
		return build(refSegments(ref), { locale, collection: ref.slug, slug })
	}

	function collection(ref: CollectionRef, locale: LocaleCode): string {
		const segments = refSegments(ref)
		const index = segments.at(-1) === SLUG_SEGMENT ? segments.slice(0, -1) : segments
		return build(index, { locale, collection: ref.slug, slug: '' })
	}

	function collectionRef(key: string, locale: LocaleCode): CollectionRef | undefined {
		const id = idByKey.get(key)
		const slug = id === undefined ? undefined : slugsById.get(id)?.get(locale)
		return id === undefined || slug === undefined ? undefined : { id, slug }
	}

	function entryParams(ref: CollectionRef, locale: LocaleCode, slug: string): RouteParams {
		const values: RouteParams = { locale: localeParam(locale), collection: ref.slug, slug }
		return Object.fromEntries(
			placeholdersOf(refSegments(ref)).map((name) => [name, values[name]])
		)
	}

	return {
		collection,
		collectionKeys,
		collectionRef,
		collectionSlug: (key, locale) => collectionRef(key, locale)?.slug ?? key,
		entryParams,
		locales: localeOrder,
		localeOf: (param) =>
			localeOrder.find((locale) => config.localePaths[locale] === (param ?? '')),
		localeParam,
		entry: (entry) => translation(entry, entry.locale),
		servedPath,
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
