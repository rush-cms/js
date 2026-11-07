import type { LocaleCode } from './types'
import type { CollectionRef, RushCollections } from './urls'

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

export type UrlMatch = EntryMatch | CollectionMatch | HomepageMatch

export type MatchSource = {
	locales: readonly LocaleCode[]
	collections: RushCollections
	homepage(locale: LocaleCode): string
	collection(collection: CollectionRef, locale: LocaleCode, page?: number): string
	hasEntries(collection: CollectionRef): boolean
	routeKey(collection: CollectionRef): string | undefined
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

type Shape = HomepageShape | CollectionShape

const HOMEPAGE_LABEL = 'homepage'

const FIRST_PAGE = 1

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
	return shape.kind === 'page' || shape.kind === 'entry'
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

function read(shape: Shape, value: string): UrlMatch | undefined {
	if (shape.kind === 'homepage') {
		return { kind: 'homepage', locale: shape.locale }
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
	return [...homepages, ...collections]
}

export function createMatcher(source: MatchSource): UrlMatcher {
	const table = new Map<string, Shape>()
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
		return shape === undefined || value === undefined ? undefined : read(shape, value)
	}
}
