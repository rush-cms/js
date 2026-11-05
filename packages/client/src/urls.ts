import { toBcp47 } from './locales'
import type { Entry, LocaleCode, NavigationItem, RushLocalePaths, RushRoutes } from './types'

const DEFAULT_PATTERN = '/{locale}/{collection}/{slug}'

export type UrlConfig = {
	routes?: RushRoutes
	routeKeysById?: Record<string, string>
	localePaths: RushLocalePaths
}

export type RushUrls = {
	readonly locales: readonly LocaleCode[]
	collection(collection: CollectionRef, locale: LocaleCode): string
	entry(entry: Entry): string
	translation(entry: Entry, locale: LocaleCode): string
	entryAt(collection: CollectionRef, locale: LocaleCode, slug: string): string
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

	function translation(entry: Entry, locale: LocaleCode): string {
		const target = Object.hasOwn(entry.translations, locale)
			? entry.translations[locale]
			: undefined
		if (target === undefined) {
			throw new Error(`entry "${entry.id}" has no translation for locale "${locale}"`)
		}
		return buildEntry({
			collection: entry.collection,
			collectionSlugs: [
				entry.collection.slug,
				...Object.values(entry.translations).map((item) => item.collection_slug)
			],
			parts: { locale, collection: target.collection_slug, slug: target.slug }
		})
	}

	function collection(ref: CollectionRef, locale: LocaleCode): string {
		const segments = segmentsFor(ref.id, [ref.slug])
		const index = segments.at(-1) === SLUG_SEGMENT ? segments.slice(0, -1) : segments
		return build(index, { locale, collection: ref.slug, slug: '' })
	}

	function entryParts(ref: CollectionRef, locale: LocaleCode, slug: string): UrlParts {
		return { locale, collection: ref.slug, slug }
	}

	function entryAt(ref: CollectionRef, locale: LocaleCode, slug: string): string {
		return build(segmentsFor(ref.id, [ref.slug]), entryParts(ref, locale, slug))
	}

	function entryParams(ref: CollectionRef, locale: LocaleCode, slug: string): RouteParams {
		const values = valuesOf(entryParts(ref, locale, slug))
		const names = segmentsFor(ref.id, [ref.slug])
			.flatMap((segment) => [...segment.matchAll(PLACEHOLDER)])
			.map((match) => match[1] ?? '')
		return Object.fromEntries(
			[...new Set(names)].map((name) => [name, values[name] || undefined])
		)
	}

	return {
		collection,
		entryAt,
		entryParams,
		locales: localeOrder,
		entry: (entry) => translation(entry, entry.locale),
		translation,
		homepage: (locale) => build(['{locale}'], { locale, collection: '', slug: '' }),
		navigationItem: (item, locale) => {
			const summary = item.target?.entry
			if (summary !== undefined) {
				return buildEntry({
					collection: summary.collection,
					collectionSlugs: [summary.collection.slug],
					parts: {
						locale: summary.locale,
						collection: summary.collection.slug,
						slug: summary.slug
					}
				})
			}
			const ref = item.target?.collection
			if (ref !== undefined) {
				return collection(ref, locale)
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
