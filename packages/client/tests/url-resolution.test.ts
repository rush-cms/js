import { describe, expect, it } from 'vitest'
import { createUrls } from '../src/index'
import type {
	Entry,
	LocaleCode,
	MovedParams,
	RushCollections,
	RushLocalePaths,
	RushRoutes,
	UrlConfig
} from '../src/index'
import { entryExample } from './fixtures/contract'
import { navigationItem } from './fixtures/navigation'
import { COLLECTION_SLUGS, ENTRY_SLUGS } from './fixtures/slugs'
import { nonEmptySubsets } from './fixtures/subsets'
import type { EntrySummary } from './fixtures/navigation'
import {
	LOCALES,
	PREFIXES,
	ROUTE_ANY,
	collectionSlugs,
	collisions,
	routeKeyFor,
	substitute,
	templatesOf,
	thrownBy
} from './fixtures/url-oracle'

type RouteKeying = {
	label: string
	key?: string
}

type RoutedOutcome = {
	kind: 'routed'
	pattern: string
}

type UnroutedOutcome = {
	kind: 'unrouted'
}

type InvalidOutcome = {
	kind: 'invalid'
	message: string
}

type Outcome = RoutedOutcome | UnroutedOutcome | InvalidOutcome

type ResolutionCase = {
	label: string
	config: UrlConfig
	outcome: Outcome
	entry: Entry
	requested: LocaleCode
}

type RoutedCase = ResolutionCase & {
	pattern: string
}

type ValidationCase = {
	label: string
	config: UrlConfig
	errors: string[]
}

const PATTERNS = [
	'/{locale}/{collection}/{slug}',
	'/{locale}/posts/{slug}',
	'/{locale}/{slug}',
	'/{collection}/{locale}/{slug}/',
	'/blog/{locale}/{slug}'
]

const ANY_DECOY = '/{locale}/any/{collection}/{slug}'

const LOCALELESS_PATTERNS = ['/{slug}', '/{collection}/{slug}', '/posts/{slug}']

const UNKNOWN_KEY = 'typo'

const CLASH_ID = 'clash'

const COLLECTION_ID = entryExample().collection.id

const KEYINGS: RouteKeying[] = [
	{ label: 'unkeyed' },
	{ label: 'id', key: COLLECTION_ID },
	...LOCALES.map((locale) => ({ label: locale, key: COLLECTION_SLUGS[locale] ?? '' }))
]

const UNMAPPED_KEYINGS = KEYINGS.filter(
	(keying) => keying.key === undefined || keying.key === COLLECTION_ID
)

const COLLECTIONS: RushCollections = Object.fromEntries(
	LOCALES.map((locale) => [
		locale,
		[
			{ id: 'other-collection', slug: `other-${locale}` },
			{ id: COLLECTION_ID, slug: COLLECTION_SLUGS[locale] ?? '' }
		]
	])
)

const CLASHING: RushCollections = Object.fromEntries(
	LOCALES.map((locale, index) => [
		locale,
		[
			...(COLLECTIONS[locale] ?? []),
			{ id: CLASH_ID, slug: PREFIXES[LOCALES[(index + 1) % LOCALES.length] ?? ''] ?? '' }
		]
	])
)

function localePathsVariants(): RushLocalePaths[] {
	const orders = [LOCALES, [...LOCALES].reverse()]
	return orders.flatMap((order) =>
		[undefined, ...order].map((empty) =>
			Object.fromEntries(
				order.map((locale) => [locale, locale === empty ? '' : (PREFIXES[locale] ?? '')])
			)
		)
	)
}

function urlConfig(
	localePaths: RushLocalePaths,
	routes: RushRoutes,
	collections: RushCollections | undefined
): UrlConfig {
	return collections === undefined
		? { localePaths, routes }
		: { localePaths, routes, collections }
}

function routesFor(pattern: string, keying: RouteKeying, any: boolean): RushRoutes {
	const specific = keying.key === undefined ? {} : { [keying.key]: pattern }
	const fallback = keying.key === undefined ? pattern : ANY_DECOY
	return any ? { ...specific, [ROUTE_ANY]: fallback } : specific
}

function outcomeOf(pattern: string, keying: RouteKeying, any: boolean): Outcome {
	if (keying.key !== undefined) {
		return { kind: 'routed', pattern }
	}
	if (!any) {
		return { kind: 'unrouted' }
	}
	return pattern.includes('{collection}')
		? { kind: 'routed', pattern }
		: { kind: 'invalid', message: `route "*" must contain {collection}` }
}

function servedEntry(translated: LocaleCode[], requested: LocaleCode): Entry {
	const served = translated.includes(requested) ? requested : (translated[0] ?? requested)
	return {
		...entryExample(),
		locale: served,
		slug: ENTRY_SLUGS[served] ?? '',
		fallback: served !== requested,
		collection: { id: COLLECTION_ID, slug: COLLECTION_SLUGS[requested] ?? '' },
		translations: Object.fromEntries(
			translated.map((locale) => [
				locale,
				{ slug: ENTRY_SLUGS[locale] ?? '', collection_slug: COLLECTION_SLUGS[locale] ?? '' }
			])
		)
	}
}

function casesFor(
	keyings: RouteKeying[],
	collections: RushCollections | undefined
): ResolutionCase[] {
	const mapped = collections === undefined ? 'no map' : 'map'
	return localePathsVariants().flatMap((localePaths) =>
		PATTERNS.flatMap((pattern) =>
			keyings.flatMap((keying) =>
				[false, true].flatMap((any) =>
					nonEmptySubsets(LOCALES).flatMap((translated) =>
						LOCALES.map((requested) => ({
							label: `${JSON.stringify(localePaths)} ${pattern} ${keying.label} any=${any} ${mapped} ${translated.join(',')} → ${requested}`,
							config: urlConfig(
								localePaths,
								routesFor(pattern, keying, any),
								collections
							),
							outcome: outcomeOf(pattern, keying, any),
							entry: servedEntry(translated, requested),
							requested
						}))
					)
				)
			)
		)
	)
}

function movedTo(entry: Entry, requested: LocaleCode): MovedParams {
	return {
		locale: requested,
		slug: entry.slug,
		collection_id: entry.collection.id,
		collection_slug: entry.collection.slug
	}
}

function expectedIn({ config, pattern }: RoutedCase, locale: LocaleCode, slug: string): string {
	return substitute(pattern, {
		locale: config.localePaths[locale] ?? '',
		collection: COLLECTION_SLUGS[locale] ?? '',
		slug
	})
}

function fetchedFor(entry: Entry, requested: LocaleCode, locale: LocaleCode): boolean {
	return entry.fallback ? !Object.hasOwn(entry.translations, locale) : locale === requested
}

function summaryOf(entry: Entry, requested: LocaleCode): EntrySummary {
	return {
		id: entry.id,
		slug: entry.slug,
		locale: requested,
		fallback: entry.fallback,
		collection: entry.collection
	}
}

function assertRouted(resolution: RoutedCase): void {
	const { config, pattern, entry, requested } = resolution
	const urls = createUrls(config)
	expect(urls.routed(entry.collection)).toBe(true)
	expect(urls.hasCollectionSegment(entry.collection)).toBe(pattern.includes('{collection}'))
	const expected = expectedIn(resolution, requested, entry.slug)
	expect(urls.servedPath(entry, requested)).toBe(expected)
	expect(urls.moved(movedTo(entry, requested))).toBe(expected)
	for (const [locale, target] of Object.entries(entry.translations)) {
		expect(urls.translation(entry, locale)).toBe(expectedIn(resolution, locale, target.slug))
	}
	if (!entry.fallback) {
		expect(urls.entry(entry)).toBe(expected)
		const summary = navigationItem({ entry: summaryOf(entry, requested) })
		expect(urls.navigationItem(summary, requested)).toBe(expected)
	}
	const listing = expectedIn(resolution, requested, '')
	expect(urls.collection(entry.collection, requested)).toBe(listing)
	const collectionItem = navigationItem({ collection: entry.collection })
	expect(urls.navigationItem(collectionItem, requested)).toBe(listing)
	const params = urls.entryParams(entry.collection, requested, entry.slug)
	expect(
		substitute(pattern, {
			locale: params['locale'] ?? '',
			collection: params['collection'] ?? '',
			slug: params['slug'] ?? ''
		})
	).toBe(expected)
	for (const locale of LOCALES.filter((item) => !fetchedFor(entry, requested, item))) {
		expect(() => urls.servedPath(entry, locale)).toThrow(/not fetched/)
	}
}

function assertUnrouted({ config, entry, requested }: ResolutionCase): void {
	const urls = createUrls(config)
	const unrouted = `collection "${entry.collection.slug}" has no route`
	expect(urls.routed(entry.collection)).toBe(false)
	expect(() => urls.servedPath(entry, requested)).toThrow(unrouted)
	expect(() => urls.moved(movedTo(entry, requested))).toThrow(unrouted)
	for (const locale of Object.keys(entry.translations)) {
		expect(() => urls.translation(entry, locale)).toThrow(unrouted)
	}
	expect(() => urls.collection(entry.collection, requested)).toThrow(unrouted)
	expect(() => urls.entryParams(entry.collection, requested, entry.slug)).toThrow(unrouted)
	expect(() => urls.hasCollectionSegment(entry.collection)).toThrow(unrouted)
	const summary = navigationItem({ entry: summaryOf(entry, requested) })
	expect(urls.navigationItem(summary, requested)).toBeUndefined()
	const collectionItem = navigationItem({ collection: entry.collection })
	expect(urls.navigationItem(collectionItem, requested)).toBeUndefined()
}

function assertResolution(resolution: ResolutionCase): void {
	const { outcome } = resolution
	if (outcome.kind === 'routed') {
		assertRouted({ ...resolution, pattern: outcome.pattern })
	} else if (outcome.kind === 'unrouted') {
		assertUnrouted(resolution)
	} else {
		expect(() => createUrls(resolution.config)).toThrow(outcome.message)
	}
}

function patternErrors(key: string, pattern: string): string[] {
	const locale = pattern.includes('{locale}') ? [] : [`route "${key}" must contain {locale}`]
	const collection =
		key === ROUTE_ANY && !pattern.includes('{collection}')
			? [`route "*" must contain {collection}`]
			: []
	return [...locale, ...collection]
}

function keyErrors(routes: RushRoutes, collections: RushCollections): string[] {
	const known = new Set(
		Object.values(collections).flatMap((list) => list.flatMap(({ id, slug }) => [id, slug]))
	)
	return Object.keys(routes)
		.filter((key) => key !== ROUTE_ANY && !known.has(key))
		.map((key) => `route "${key}" matches no collection`)
}

function clashErrors(config: UrlConfig, collections: RushCollections): string[] {
	const routes = config.routes ?? {}
	const prefixes = Object.values(config.localePaths)
	const bare = Object.keys(config.localePaths).find((locale) => config.localePaths[locale] === '')
	return [...collectionSlugs(collections)].flatMap(([id, slugs]) => {
		const slug = bare === undefined ? undefined : slugs.get(bare)
		const key = routeKeyFor(routes, id, [...slugs.values()])
		const pattern = routes[key ?? ''] ?? ''
		const ambiguous =
			slug !== undefined &&
			slug !== '' &&
			prefixes.includes(slug) &&
			`/${pattern}/`.replace(/\/+/g, '/').includes('/{locale}/{collection}/')
		return ambiguous ? [`collection slug "${slug}" equals the locale prefix "${slug}"`] : []
	})
}

function configErrors(config: UrlConfig): string[] {
	const routes = config.routes ?? {}
	const collections = config.collections
	return [
		...Object.entries(routes).flatMap(([key, pattern]) => patternErrors(key, pattern)),
		...(collections === undefined
			? []
			: [
					...keyErrors(routes, collections),
					...clashErrors(config, collections),
					...collisions(templatesOf(config))
				])
	]
}

function validationCases(): ValidationCase[] {
	const anyPatterns = [undefined, ...PATTERNS, ...LOCALELESS_PATTERNS]
	const keys = [COLLECTION_ID, COLLECTION_SLUGS['en'] ?? '', CLASH_ID, UNKNOWN_KEY]
	const specifics: RushRoutes[] = [
		{},
		...keys.flatMap((key) =>
			[...PATTERNS, ...LOCALELESS_PATTERNS].map((pattern) => ({ [key]: pattern }))
		)
	]
	return localePathsVariants().flatMap((localePaths) =>
		[undefined, COLLECTIONS, CLASHING].flatMap((collections) =>
			specifics.flatMap((specific) =>
				anyPatterns.map((any) => {
					const routes = any === undefined ? specific : { ...specific, [ROUTE_ANY]: any }
					const config = urlConfig(localePaths, routes, collections)
					return { label: JSON.stringify(config), config, errors: configErrors(config) }
				})
			)
		)
	)
}

describe('locale params', () => {
	it.each(localePathsVariants())('round-trips every locale of %j', (localePaths) => {
		const urls = createUrls({ localePaths })
		for (const locale of urls.locales) {
			expect(urls.localeOf(urls.localeParam(locale))).toBe(locale)
			expect(urls.localeParam(locale)).toBe(localePaths[locale] || undefined)
		}
		const unprefixed = urls.locales.find((locale) => localePaths[locale] === '')
		expect(urls.localeOf(undefined)).toBe(unprefixed)
		expect(urls.localeOf('')).toBe(unprefixed)
	})

	it.each(['PT', 'pt_BR', 'pt-BR', 'fr', 'constructor', 'en/', ' en'])(
		'matches only an exact prefix, never "%s"',
		(param) => {
			expect(createUrls({ localePaths: PREFIXES }).localeOf(param)).toBeUndefined()
		}
	)
})

describe('every url helper over every route, keying and locale', () => {
	const cases = [...casesFor(KEYINGS, COLLECTIONS), ...casesFor(UNMAPPED_KEYINGS, undefined)]

	it(`matches the substitution oracle for ${cases.length} generated cases`, () => {
		expect(cases.length).toBe(11760)
		for (const resolution of cases) {
			try {
				assertResolution(resolution)
			} catch (err) {
				throw new Error(resolution.label, { cause: err })
			}
		}
	})
})

describe('route configuration over every key, pattern, locale paths and collections', () => {
	const cases = validationCases()

	it(`matches the configuration oracle for ${cases.length} generated configs`, () => {
		const seen = new Set<string>()
		for (const { label, config, errors } of cases) {
			const thrown = thrownBy(config)
			if (errors.length === 0) {
				expect(thrown, label).toBeUndefined()
			} else {
				expect(errors, label).toContain(thrown)
			}
			seen.add(thrown?.replace(/"[^"]*"/g, '""') ?? 'valid')
		}
		expect([...seen].sort()).toEqual([
			'collection slug "" equals the locale prefix ""',
			'route "" matches no collection',
			'route "" must contain {collection}',
			'route "" must contain {locale}',
			'routes "" and "" produce the same URLs',
			'valid'
		])
	})
})

describe('servedPath', () => {
	const urls = createUrls({ localePaths: PREFIXES, routes: { [ROUTE_ANY]: PATTERNS[0] ?? '' } })

	it('gives a fallback page the requested locale prefix and collection slug', () => {
		expect(urls.servedPath(servedEntry(['pt_BR'], 'es'), 'es')).toBe('/es/articulos/ola-mundo')
	})

	it('throws for a locale the entry was not fetched for', () => {
		const entry = servedEntry(['pt_BR', 'en'], 'pt_BR')
		expect(() => urls.servedPath(entry, 'en')).toThrow(
			`entry "${entry.id}" was not fetched for locale "en"`
		)
		expect(() => urls.servedPath(servedEntry(['pt_BR'], 'es'), 'pt_BR')).toThrow(/not fetched/)
	})
})

describe('collectionRef', () => {
	const urls = createUrls({ localePaths: PREFIXES, collections: COLLECTIONS })

	it('gives the collection ref of an id or any locale slug in a locale', () => {
		for (const key of [COLLECTION_ID, ...Object.values(COLLECTION_SLUGS)]) {
			expect(LOCALES.map((locale) => urls.collectionRef(key, locale)?.slug)).toEqual([
				'artigos',
				'blog',
				'articulos'
			])
		}
		expect(urls.collectionRef('artigos', 'es')).toEqual({
			id: COLLECTION_ID,
			slug: 'articulos'
		})
		expect(urls.collectionRef(COLLECTION_ID, 'en')).toEqual({ id: COLLECTION_ID, slug: 'blog' })
	})

	it('gives undefined for an unknown key or locale, and for every key without collections', () => {
		expect(urls.collectionRef('artigos', 'fr')).toBeUndefined()
		expect(urls.collectionRef('unknown', 'en')).toBeUndefined()
		expect(createUrls({ localePaths: PREFIXES }).collectionRef('artigos', 'en')).toBeUndefined()
	})
})

describe('hasCollectionSegment', () => {
	const ref = { id: COLLECTION_ID, slug: 'blog' }

	it.each(PATTERNS)('reports whether the pattern %s has a {collection} segment', (pattern) => {
		const urls = createUrls({
			localePaths: PREFIXES,
			routes: { [COLLECTION_ID]: pattern }
		})
		expect(urls.hasCollectionSegment(ref)).toBe(pattern.includes('{collection}'))
	})

	it('throws for a collection without a route and is false for a route keyed by another locale slug', () => {
		expect(() => createUrls({ localePaths: PREFIXES }).hasCollectionSegment(ref)).toThrow(
			'collection "blog" has no route'
		)
		const keyed = createUrls({
			localePaths: PREFIXES,
			routes: { artigos: '/{locale}/posts/{slug}' },
			collections: COLLECTIONS
		})
		expect(keyed.hasCollectionSegment(ref)).toBe(false)
	})
})

describe('moved', () => {
	const params = movedTo(servedEntry(['pt_BR'], 'pt_BR'), 'pt_BR')

	it('picks the route pattern by collection id when no slug matches a route key', () => {
		const urls = createUrls({
			localePaths: PREFIXES,
			routes: { blog: '/{locale}/posts/{slug}' },
			collections: COLLECTIONS
		})
		expect(urls.moved(params)).toBe('/pt/posts/ola-mundo')
	})

	it('falls back to the collection slug and then to the * route', () => {
		const bySlug = createUrls({
			localePaths: PREFIXES,
			routes: { artigos: '/{locale}/a/{slug}' }
		})
		expect(bySlug.moved(params)).toBe('/pt/a/ola-mundo')
		const any = createUrls({ localePaths: PREFIXES, routes: { [ROUTE_ANY]: ANY_DECOY } })
		expect(any.moved(params)).toBe('/pt/any/artigos/ola-mundo')
	})

	it('throws for a locale missing from localePaths', () => {
		const any = createUrls({ localePaths: PREFIXES, routes: { [ROUTE_ANY]: ANY_DECOY } })
		expect(() => any.moved({ ...params, locale: 'fr' })).toThrow(/"fr"/)
	})
})
