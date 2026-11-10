import { createUrls } from '../../src/index'
import type {
	CollectionRef,
	LocaleCode,
	RushCollections,
	RushRoutes,
	TagType,
	UrlConfig
} from '../../src/index'

export type Placeholders = {
	locale: string
	collection: string
	slug: string
}

export type HomepageTemplate = {
	kind: 'homepage'
	label: string
	locale: LocaleCode
	segments: string[]
}

export type CollectionTemplate = {
	kind: 'index' | 'page' | 'entry'
	label: string
	locale: LocaleCode
	collection: CollectionRef
	segments: string[]
}

export type TaxonomyTemplate = {
	kind: 'taxonomy-index' | 'taxonomy-page'
	label: string
	locale: LocaleCode
	type: TagType
	segments: string[]
}

export type Template = HomepageTemplate | CollectionTemplate | TaxonomyTemplate

export function isTaxonomyTemplate(template: Template): template is TaxonomyTemplate {
	return template.kind === 'taxonomy-index' || template.kind === 'taxonomy-page'
}

export const VALUE = '\u0000'

const DEFAULT_PAGE_SEGMENT = 'page'

export const LOCALES: LocaleCode[] = ['pt_BR', 'en', 'es']

export const PREFIXES: Record<LocaleCode, string> = { pt_BR: 'pt', en: 'en', es: 'es' }

export const ROUTE_ANY = '*'

export const TAXONOMY_TYPES: TagType[] = ['category', 'tag']

export function substitute(pattern: string, values: Placeholders): string {
	const path = pattern
		.replaceAll('{locale}', values.locale)
		.replaceAll('{collection}', values.collection)
		.replaceAll('{slug}', values.slug)
	return `/${path
		.split('/')
		.filter((segment) => segment !== '')
		.join('/')}`
}

export function thrownBy(config: UrlConfig): string | undefined {
	try {
		createUrls(config)
		return undefined
	} catch (err) {
		return err instanceof Error ? err.message : String(err)
	}
}

export function collectionSlugs(
	collections: RushCollections
): Map<string, Map<LocaleCode, string>> {
	const slugs = new Map<string, Map<LocaleCode, string>>()
	for (const [locale, list] of Object.entries(collections)) {
		for (const { id, slug } of list) {
			slugs.set(id, new Map([...(slugs.get(id) ?? []), [locale, slug]]))
		}
	}
	return slugs
}

export function routeKeyFor(routes: RushRoutes, id: string, slugs: string[]): string | undefined {
	const key = [id, ...slugs].find((candidate) => Object.hasOwn(routes, candidate)) ?? ROUTE_ANY
	return Object.hasOwn(routes, key) ? key : undefined
}

function segmentsIn(pattern: string, values: Placeholders): string[] {
	return substitute(pattern, values)
		.split('/')
		.filter((segment) => segment !== '')
}

function pageSegmentFor(config: UrlConfig, locale: LocaleCode): string {
	const segments = config.pageSegments ?? {}
	return Object.hasOwn(segments, locale)
		? (segments[locale] ?? DEFAULT_PAGE_SEGMENT)
		: DEFAULT_PAGE_SEGMENT
}

function collectionTemplates(
	config: UrlConfig,
	locale: LocaleCode,
	collection: CollectionRef,
	slugs: string[]
): CollectionTemplate[] {
	const routes = config.routes ?? {}
	const label = routeKeyFor(routes, collection.id, [collection.slug, ...slugs])
	const pattern = label === undefined ? undefined : routes[label]
	if (label === undefined || pattern === undefined) {
		return []
	}
	const values = { locale: config.localePaths[locale] ?? '', collection: collection.slug }
	const index = segmentsIn(pattern, { ...values, slug: '' })
	const page = [...index, pageSegmentFor(config, locale), VALUE]
	const templates: CollectionTemplate[] = [
		{ kind: 'index', label, locale, collection, segments: index },
		{ kind: 'page', label, locale, collection, segments: page }
	]
	const entry = segmentsIn(pattern, { ...values, slug: VALUE })
	return pattern.includes('{slug}')
		? [...templates, { kind: 'entry', label, locale, collection, segments: entry }]
		: templates
}

function taxonomySegments(
	config: UrlConfig,
	type: TagType
): Record<LocaleCode, string> | undefined {
	return config.taxonomies?.[type]
}

function taxonomyTemplates(config: UrlConfig, locale: LocaleCode): TaxonomyTemplate[] {
	const prefix = config.localePaths[locale] ?? ''
	return TAXONOMY_TYPES.flatMap((type) => {
		const segments = taxonomySegments(config, type)
		if (segments === undefined) {
			return []
		}
		const index = [prefix, segments[locale] ?? '', VALUE].filter((segment) => segment !== '')
		const base = { label: `taxonomies.${type}`, locale, type }
		return [
			{ ...base, kind: 'taxonomy-index', segments: index },
			{
				...base,
				kind: 'taxonomy-page',
				segments: [...index, pageSegmentFor(config, locale), VALUE]
			}
		]
	})
}

export function prefixClashes(config: UrlConfig): string[] {
	const bare = Object.keys(config.localePaths).find((locale) => config.localePaths[locale] === '')
	const prefixes = Object.values(config.localePaths).filter((prefix) => prefix !== '')
	return TAXONOMY_TYPES.flatMap((type) => {
		const segments = taxonomySegments(config, type)
		const segment = bare === undefined ? undefined : segments?.[bare]
		return segment !== undefined && prefixes.includes(segment)
			? [`taxonomies.${type} segment "${segment}" equals the locale prefix "${segment}"`]
			: []
	})
}

export function templatesOf(config: UrlConfig): Template[] {
	const locales = Object.keys(config.localePaths)
	const slugs = collectionSlugs(config.collections ?? {})
	const homepages: Template[] = locales.map((locale) => ({
		kind: 'homepage',
		label: 'homepage',
		locale,
		segments: config.localePaths[locale] === '' ? [] : [config.localePaths[locale] ?? '']
	}))
	return [
		...homepages,
		...locales.flatMap((locale) =>
			(config.collections?.[locale] ?? []).flatMap((ref) =>
				collectionTemplates(config, locale, ref, [...(slugs.get(ref.id)?.values() ?? [])])
			)
		),
		...locales.flatMap((locale) => taxonomyTemplates(config, locale))
	]
}

function ownsIndex(a: Template, b: Template): boolean {
	return a.kind === 'homepage' && b.kind === 'index' && a.locale === b.locale
}

function sameShape(a: Template, b: Template): boolean {
	return (
		a.segments.length === b.segments.length &&
		a.segments.every((segment, i) => segment === b.segments[i])
	)
}

export function collisions(templates: Template[]): string[] {
	return templates.flatMap((a, position) =>
		templates
			.slice(position + 1)
			.filter((b) => sameShape(a, b) && !ownsIndex(a, b) && !ownsIndex(b, a))
			.flatMap((b) => [
				`routes "${a.label}" and "${b.label}" produce the same URLs`,
				`routes "${b.label}" and "${a.label}" produce the same URLs`
			])
	)
}
