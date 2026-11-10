import type { MovedParams } from './errors'
import { toBcp47 } from './locales'
import { createMatcher, segmentsOf } from './url-match'
import type { UrlMatch, UrlMatcher } from './url-match'
import type {
	Entry,
	Homepage,
	LocaleCode,
	NavigationItem,
	RushLocalePaths,
	RushRoutes,
	Tag,
	TagRef,
	TagType
} from './types'

const ROUTE_ANY = '*'

export type RushCollections = Record<LocaleCode, CollectionRef[]>

export type RushPageSegments = Record<LocaleCode, string>

export type RushTaxonomySegments = Record<LocaleCode, string>

export type RushTaxonomies = Partial<Record<TagType, RushTaxonomySegments>>

export type TaxonomyKey = Pick<TagRef, 'type' | 'slug'>

export type UrlConfig = {
	routes?: RushRoutes
	localePaths: RushLocalePaths
	collections?: RushCollections
	pageSegments?: RushPageSegments
	taxonomies?: RushTaxonomies
}

export type RushUrls = {
	readonly locales: readonly LocaleCode[]
	readonly taxonomyTypes: readonly TagType[]
	localeOf(param: string | undefined): LocaleCode | undefined
	localeParam(locale: LocaleCode): string | undefined
	collectionRef(key: string, locale: LocaleCode): CollectionRef | undefined
	routed(collection: CollectionRef): boolean
	hasCollectionSegment(collection: CollectionRef): boolean
	collectionKeys(source: Entry | CollectionRef): string[]
	collection(collection: CollectionRef, locale: LocaleCode, page?: number): string
	taxonomy(tag: TagRef | Tag, locale: LocaleCode, page?: number): string | undefined
	entry(entry: Entry): string
	servedPath(entry: Entry, requestedLocale: LocaleCode): string
	translation(entry: Entry, locale: LocaleCode): string
	moved(params: MovedParams): string
	entryParams(collection: CollectionRef, locale: LocaleCode, slug: string): RouteParams
	homepage(locale: LocaleCode): string
	navigationItem(item: NavigationItem, locale: LocaleCode): string | undefined
	match(pathname: string): UrlMatch | undefined
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

type RouteTable = Map<string, string[]>

type LocaleValue = (locale: LocaleCode) => string | undefined

type LocalePrefixes = {
	bare: LocaleCode | undefined
	prefixes: ReadonlySet<string>
}

const SLUG_SEGMENT = '{slug}'
const LOCALE_SEGMENT = '{locale}'
const COLLECTION_SEGMENT = '{collection}'
const PLACEHOLDER = /\{(locale|collection|slug)\}/g
const DEFAULT_PAGE_SEGMENT = 'page'
const TAXONOMY_TYPES: readonly TagType[] = ['category', 'tag']

function ownValue<T>(record: Record<string, T>, key: string): T | undefined {
	return Object.hasOwn(record, key) ? record[key] : undefined
}

function assertSlugLast(key: string, segments: string[]): void {
	const index = segments.findIndex((segment) => segment.includes(SLUG_SEGMENT))
	const valid =
		index === -1 || (index === segments.length - 1 && segments[index] === SLUG_SEGMENT)
	if (!valid) {
		throw new Error(`route "${key}" must have {slug} as its last path segment`)
	}
}

function assertPlainSegments(values: Record<LocaleCode, string>, label: string): void {
	for (const [locale, value] of Object.entries(values)) {
		if (value.includes('/')) {
			throw new Error(`${label} for "${locale}" must not contain "/"`)
		}
	}
}

function assertSegments(values: Record<LocaleCode, string>, label: string): void {
	assertPlainSegments(values, label)
	const empty = Object.keys(values).find((locale) => values[locale] === '')
	if (empty !== undefined) {
		throw new Error(`${label} for "${empty}" must not be empty`)
	}
}

function assertPage(page: number): void {
	if (!Number.isSafeInteger(page) || page < 1) {
		throw new Error(`page must be a positive integer, got ${page}`)
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

function localePrefixes(localePaths: RushLocalePaths): LocalePrefixes {
	return {
		bare: Object.keys(localePaths).find((locale) => localePaths[locale] === ''),
		prefixes: new Set(Object.values(localePaths).filter((prefix) => prefix !== ''))
	}
}

function prefixShadowedBy(
	{ bare, prefixes }: LocalePrefixes,
	valueIn: LocaleValue
): string | undefined {
	const value = bare === undefined ? undefined : valueIn(bare)
	return value !== undefined && prefixes.has(value) ? value : undefined
}

function isTaxonomyType(key: string): key is TagType {
	return TAXONOMY_TYPES.some((type) => type === key)
}

function assertTaxonomy(
	type: string,
	segments: RushTaxonomySegments,
	localePaths: RushLocalePaths
): void {
	const label = `taxonomies.${type}`
	if (!isTaxonomyType(type)) {
		throw new Error(
			`taxonomies key "${type}" must be ${TAXONOMY_TYPES.map((name) => `"${name}"`).join(' or ')}`
		)
	}
	assertSegments(segments, `${label} segment`)
	const missing = Object.keys(localePaths).find((locale) => !Object.hasOwn(segments, locale))
	if (missing !== undefined) {
		throw new Error(`${label} has no segment for locale "${missing}"`)
	}
	const unknown = Object.keys(segments).find((locale) => !Object.hasOwn(localePaths, locale))
	if (unknown !== undefined) {
		throw new Error(`${label} segment for "${unknown}" names no localePaths locale`)
	}
	const shadowed = prefixShadowedBy(localePrefixes(localePaths), (locale) =>
		ownValue(segments, locale)
	)
	if (shadowed !== undefined) {
		throw new Error(`${label} segment "${shadowed}" equals the locale prefix "${shadowed}"`)
	}
}

function assertTaxonomies(taxonomies: RushTaxonomies, localePaths: RushLocalePaths): void {
	for (const [type, segments] of Object.entries(taxonomies)) {
		assertTaxonomy(type, segments ?? {}, localePaths)
	}
}

function configuredTypes(taxonomies: RushTaxonomies): TagType[] {
	return TAXONOMY_TYPES.filter((type) => ownValue(taxonomies, type) !== undefined)
}

function placeholdersOf(segments: string[]): string[] {
	const names = segments
		.flatMap((segment) => [...segment.matchAll(PLACEHOLDER)])
		.map((match) => match[1] ?? '')
	return [...new Set(names)]
}

function assertPlaceholders(key: string, segments: string[]): void {
	const names = placeholdersOf(segments)
	if (!names.includes('locale')) {
		throw new Error(`route "${key}" must contain {locale}`)
	}
	if (key === ROUTE_ANY && !names.includes('collection')) {
		throw new Error(`route "${ROUTE_ANY}" must contain {collection}`)
	}
}

function parseRoutes(routes: RushRoutes): RouteTable {
	const parsed: RouteTable = new Map()
	for (const [key, pattern] of Object.entries(routes)) {
		const segments = segmentsOf(pattern)
		assertSlugLast(key, segments)
		assertPlaceholders(key, segments)
		parsed.set(key, segments)
	}
	return parsed
}

function routeKeyOf(routes: RouteTable, keys: string[]): string | undefined {
	const key = keys.find((candidate) => routes.has(candidate)) ?? ROUTE_ANY
	return routes.has(key) ? key : undefined
}

function routeOf(routes: RouteTable, keys: string[]): string[] | undefined {
	const key = routeKeyOf(routes, keys)
	return key === undefined ? undefined : routes.get(key)
}

function isEntry(source: Entry | CollectionRef): source is Entry {
	return 'translations' in source
}

function keysOf(index: CollectionIndex, id: string, slugs: string[]): string[] {
	return [...new Set([id, ...slugs, ...(index.slugsById.get(id)?.values() ?? [])])]
}

function assertKnownKeys(routes: RouteTable, index: CollectionIndex): void {
	for (const key of routes.keys()) {
		if (key !== ROUTE_ANY && !index.idByKey.has(key)) {
			throw new Error(`route "${key}" matches no collection`)
		}
	}
}

function collectionFollowsLocale(segments: string[]): boolean {
	return segments.some(
		(segment, position) =>
			segment === COLLECTION_SEGMENT && segments[position - 1] === LOCALE_SEGMENT
	)
}

function assertSlugsAreNotPrefixes(
	localePaths: RushLocalePaths,
	routes: RouteTable,
	index: CollectionIndex
): void {
	const prefixes = localePrefixes(localePaths)
	for (const [id, slugs] of index.slugsById) {
		const slug = prefixShadowedBy(prefixes, (locale) => slugs.get(locale))
		const segments = routeOf(routes, keysOf(index, id, []))
		if (slug !== undefined && segments !== undefined && collectionFollowsLocale(segments)) {
			throw new Error(`collection slug "${slug}" equals the locale prefix "${slug}"`)
		}
	}
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

export function createUrls(config: UrlConfig): RushUrls {
	assertPlainSegments(config.localePaths, 'localePaths prefix')
	assertSingleEmptyPrefix(config.localePaths)
	const pageSegments = config.pageSegments ?? {}
	assertSegments(pageSegments, 'pageSegments segment')
	const taxonomies = config.taxonomies ?? {}
	assertTaxonomies(taxonomies, config.localePaths)
	const routeSegments = parseRoutes(config.routes ?? {})
	const index = indexCollections(config.collections ?? {})
	if (config.collections !== undefined) {
		assertKnownKeys(routeSegments, index)
		assertSlugsAreNotPrefixes(config.localePaths, routeSegments, index)
	}
	const { slugsById, idByKey } = index
	const localeOrder = Object.keys(config.localePaths)

	function prefixOf(locale: LocaleCode): string {
		if (!Object.hasOwn(config.localePaths, locale)) {
			throw new Error(`locale "${locale}" is missing from localePaths`)
		}
		return config.localePaths[locale] ?? ''
	}

	function segmentsFor(ref: CollectionRef, keys: string[]): string[] {
		const segments = routeOf(routeSegments, keys)
		if (segments === undefined) {
			throw new Error(`collection "${ref.slug}" has no route`)
		}
		return segments
	}

	function refKeys(ref: CollectionRef): string[] {
		return keysOf(index, ref.id, [ref.slug])
	}

	function routed(ref: CollectionRef): boolean {
		return routeOf(routeSegments, refKeys(ref)) !== undefined
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

	function entryKeys(entry: Entry): string[] {
		return keysOf(index, entry.collection.id, [
			entry.collection.slug,
			...Object.values(entry.translations).map((item) => item.collection_slug)
		])
	}

	function collectionKeys(source: Entry | CollectionRef): string[] {
		return isEntry(source) ? entryKeys(source) : refKeys(source)
	}

	function entryPath(entry: Entry, parts: UrlParts): string {
		return build(segmentsFor(entry.collection, entryKeys(entry)), parts)
	}

	function translation(entry: Entry, locale: LocaleCode): string {
		const target = ownValue(entry.translations, locale)
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
		return segmentsFor(ref, refKeys(ref))
	}

	function routedPath(ref: CollectionRef, path: () => string): string | undefined {
		return routed(ref) ? path() : undefined
	}

	function pathIn(ref: CollectionRef, locale: LocaleCode, slug: string): string {
		return build(refSegments(ref), { locale, collection: ref.slug, slug })
	}

	function hasEntries(ref: CollectionRef): boolean {
		return refSegments(ref).at(-1) === SLUG_SEGMENT
	}

	function pageSegmentOf(locale: LocaleCode): string {
		return ownValue(pageSegments, locale) ?? DEFAULT_PAGE_SEGMENT
	}

	function paged(segments: string[], locale: LocaleCode, page: number): string[] {
		assertPage(page)
		return page === 1 ? segments : [...segments, pageSegmentOf(locale), String(page)]
	}

	function collection(ref: CollectionRef, locale: LocaleCode, page = 1): string {
		const segments = refSegments(ref)
		const index = hasEntries(ref) ? segments.slice(0, -1) : segments
		return build(paged(index, locale, page), { locale, collection: ref.slug, slug: '' })
	}

	function taxonomy(tag: TaxonomyKey, locale: LocaleCode, page = 1): string | undefined {
		const segments = ownValue(taxonomies, tag.type)
		if (segments === undefined) {
			assertPage(page)
			return undefined
		}
		const index = [LOCALE_SEGMENT, ownValue(segments, locale) ?? '', SLUG_SEGMENT]
		return build(paged(index, locale, page), { locale, collection: '', slug: tag.slug })
	}

	const taxonomyTypes = configuredTypes(taxonomies)

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

	function homepage(locale: LocaleCode): string {
		return build([LOCALE_SEGMENT], { locale, collection: '', slug: '' })
	}

	const matcher: UrlMatcher | undefined =
		config.collections === undefined
			? undefined
			: createMatcher({
					locales: localeOrder,
					collections: config.collections,
					homepage,
					collection,
					hasEntries,
					routeKey: (ref) => routeKeyOf(routeSegments, refKeys(ref)),
					taxonomyTypes,
					taxonomy
				})

	return {
		collection,
		taxonomy,
		taxonomyTypes,
		collectionKeys,
		collectionRef,
		entryParams,
		routed,
		hasCollectionSegment: (ref) => placeholdersOf(refSegments(ref)).includes('collection'),
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
		homepage,
		match: (pathname) => {
			if (matcher === undefined) {
				throw new Error('match needs collections')
			}
			return matcher(pathname)
		},
		navigationItem: (item, locale) => {
			const summary = item.target?.entry
			if (summary !== undefined) {
				return routedPath(summary.collection, () =>
					pathIn(summary.collection, summary.locale, summary.slug)
				)
			}
			const ref = item.target?.collection
			if (ref !== undefined) {
				return routedPath(ref, () => collection(ref, locale))
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
