import type { LocaleCode, TagType } from './types'
import type { CollectionRef, RushCollections, TaxonomyKey } from './urls'

export type EntryMatch = {
	kind: 'entry'
	locale: LocaleCode
	collection: CollectionRef
	slug: string
}

export type CollectionMatch = {
	kind: 'collection'
	locale: LocaleCode
	collection: CollectionRef
	page: number
}

export type HomepageMatch = {
	kind: 'homepage'
	locale: LocaleCode
}

export type TaxonomyMatch = {
	kind: 'taxonomy'
	locale: LocaleCode
	type: TagType
	slug: string
	page: number
}

export type UrlMatch = EntryMatch | CollectionMatch | HomepageMatch | TaxonomyMatch

export type MatchSource = {
	locales: readonly LocaleCode[]
	collections: RushCollections
	homepage(locale: LocaleCode): string
	collection(collection: CollectionRef, locale: LocaleCode, page?: number): string
	hasEntries(collection: CollectionRef): boolean
	routeKey(collection: CollectionRef): string | undefined
	taxonomyTypes: readonly TagType[]
	taxonomy(tag: TaxonomyKey, locale: LocaleCode, page?: number): string | undefined
}

export type UrlMatcher = (pathname: string) => UrlMatch | undefined

type HomepageShape = {
	kind: 'homepage'
	label: string
	locale: LocaleCode
	literals: string[]
}

type CollectionShapeKind = 'index' | 'page' | 'entry'

type CollectionShape = {
	kind: CollectionShapeKind
	label: string
	locale: LocaleCode
	collection: CollectionRef
	literals: string[]
}

type TaxonomyShape = {
	kind: 'taxonomy'
	label: string
	locale: LocaleCode
	type: TagType
	literals: string[]
	pageSegment: string
}

type Shape = HomepageShape | CollectionShape | TaxonomyShape

type ShapeTable = Map<string, Shape>

const HOMEPAGE_LABEL = 'homepage'

const FIRST_PAGE = 1

const SLUG_PROBE = 'slug'

const PAGED_TAIL = 3

export function segmentsOf(path: string): string[] {
	return path.split('/').filter((segment) => segment !== '')
}

function decodedSegments(pathname: string): string[] | undefined {
	try {
		return segmentsOf(pathname).map((segment) => decodeURIComponent(segment))
	} catch {
		return undefined
	}
}

function isOpen(shape: Shape): boolean {
	return shape.kind !== 'homepage' && shape.kind !== 'index'
}

function keyOf(literals: string[], open: boolean): string {
	return JSON.stringify([open, ...literals])
}

function ownsIndex(existing: Shape, shape: Shape): boolean {
	return (
		existing.kind === 'homepage' && shape.kind === 'index' && existing.locale === shape.locale
	)
}

function pageOf(value: string): number | undefined {
	const page = Number(value)
	return Number.isSafeInteger(page) && page > FIRST_PAGE && String(page) === value
		? page
		: undefined
}

function taxonomyMatch(shape: TaxonomyShape, slug: string, page: number): TaxonomyMatch {
	return { kind: 'taxonomy', locale: shape.locale, type: shape.type, slug, page }
}

function readTaxonomyPage(table: ShapeTable, segments: string[]): UrlMatch | undefined {
	if (segments.length < PAGED_TAIL) {
		return undefined
	}
	const shape = table.get(keyOf(segments.slice(0, -PAGED_TAIL), true))
	const [slug = '', segment, value = ''] = segments.slice(-PAGED_TAIL)
	const page = pageOf(value)
	return shape?.kind !== 'taxonomy' || segment !== shape.pageSegment || page === undefined
		? undefined
		: taxonomyMatch(shape, slug, page)
}

function read(shape: Shape, value: string): UrlMatch | undefined {
	if (shape.kind === 'homepage') {
		return { kind: 'homepage', locale: shape.locale }
	}
	if (shape.kind === 'taxonomy') {
		return taxonomyMatch(shape, value, FIRST_PAGE)
	}
	const { locale, collection } = shape
	if (shape.kind === 'entry') {
		return { kind: 'entry', locale, collection, slug: value }
	}
	const page = shape.kind === 'index' ? FIRST_PAGE : pageOf(value)
	return page === undefined ? undefined : { kind: 'collection', locale, collection, page }
}

function collectionShapes(
	source: MatchSource,
	locale: LocaleCode,
	collection: CollectionRef
): CollectionShape[] {
	const label = source.routeKey(collection)
	if (label === undefined) {
		return []
	}
	const index = segmentsOf(source.collection(collection, locale))
	const page = segmentsOf(source.collection(collection, locale, FIRST_PAGE + 1)).slice(0, -1)
	const shape = (kind: CollectionShapeKind, literals: string[]): CollectionShape => ({
		kind,
		label,
		locale,
		collection,
		literals
	})
	const shapes = [shape('index', index), shape('page', page)]
	return source.hasEntries(collection) ? [...shapes, shape('entry', index)] : shapes
}

function taxonomyShapes(source: MatchSource, locale: LocaleCode): TaxonomyShape[] {
	return source.taxonomyTypes.flatMap((type) => {
		const probe = { type, slug: SLUG_PROBE }
		const index = source.taxonomy(probe, locale)
		const page = source.taxonomy(probe, locale, FIRST_PAGE + 1)
		if (index === undefined || page === undefined) {
			return []
		}
		const shape: TaxonomyShape = {
			kind: 'taxonomy',
			label: `taxonomies.${type}`,
			locale,
			type,
			literals: segmentsOf(index).slice(0, -1),
			pageSegment: segmentsOf(page).at(-2) ?? ''
		}
		return [shape]
	})
}

function shapesOf(source: MatchSource): Shape[] {
	const homepages = source.locales.map((locale): HomepageShape => ({
		kind: 'homepage',
		label: HOMEPAGE_LABEL,
		locale,
		literals: segmentsOf(source.homepage(locale))
	}))
	const collections = source.locales.flatMap((locale) =>
		(Object.hasOwn(source.collections, locale)
			? (source.collections[locale] ?? [])
			: []
		).flatMap((collection) => collectionShapes(source, locale, collection))
	)
	const taxonomies = source.locales.flatMap((locale) => taxonomyShapes(source, locale))
	return [...homepages, ...collections, ...taxonomies]
}

export function createMatcher(source: MatchSource): UrlMatcher {
	const table: ShapeTable = new Map()
	for (const shape of shapesOf(source)) {
		const key = keyOf(shape.literals, isOpen(shape))
		const existing = table.get(key)
		if (existing === undefined) {
			table.set(key, shape)
		} else if (!ownsIndex(existing, shape)) {
			throw new Error(`routes "${existing.label}" and "${shape.label}" produce the same URLs`)
		}
	}
	return (pathname) => {
		const segments = decodedSegments(pathname)
		if (segments === undefined) {
			return undefined
		}
		const exact = table.get(keyOf(segments, false))
		if (exact !== undefined) {
			return read(exact, '')
		}
		const value = segments.at(-1)
		const shape = table.get(keyOf(segments.slice(0, -1), true))
		const open = shape === undefined || value === undefined ? undefined : read(shape, value)
		return open ?? readTaxonomyPage(table, segments)
	}
}
