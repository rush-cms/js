import { describe, expect, it } from 'vitest'
import { createUrls } from '../src/index'
import type {
	Entry,
	LocaleCode,
	MovedParams,
	RushCollections,
	RushLocalePaths,
	UrlConfig
} from '../src/index'
import { entryExample } from './fixtures/contract'
import { navigationItem } from './fixtures/navigation'
import { COLLECTION_SLUGS, ENTRY_SLUGS } from './fixtures/slugs'
import type { EntrySummary } from './fixtures/navigation'

type RouteKeying = {
	label: string
	key?: string
}

type ResolutionCase = {
	label: string
	config: UrlConfig
	pattern: string
	entry: Entry
	requested: LocaleCode
}

type Placeholders = {
	locale: string
	collection: string
	slug: string
}

const LOCALES: LocaleCode[] = ['pt_BR', 'en', 'es']

const PREFIXES: Record<LocaleCode, string> = { pt_BR: 'pt', en: 'en', es: 'es' }

const DEFAULT_PATTERN = '/{locale}/{collection}/{slug}'

const PATTERNS = [
	DEFAULT_PATTERN,
	'/{locale}/posts/{slug}',
	'/{slug}',
	'/{collection}/{locale}/{slug}/',
	'/blog/{locale}/{slug}'
]

const COLLECTION_ID = entryExample().collection.id

const KEYINGS: RouteKeying[] = [
	{ label: 'default' },
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

function nonEmptySubsets(items: LocaleCode[]): LocaleCode[][] {
	return Array.from({ length: 2 ** items.length - 1 }, (_, mask) =>
		items.filter((_, index) => ((mask + 1) >> index) & 1)
	)
}

function urlConfig(
	localePaths: RushLocalePaths,
	pattern: string,
	keying: RouteKeying,
	collections: RushCollections | undefined
): UrlConfig {
	const routes = keying.key === undefined ? {} : { [keying.key]: pattern }
	return collections === undefined
		? { localePaths, routes }
		: { localePaths, routes, collections }
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
				nonEmptySubsets(LOCALES).flatMap((translated) =>
					LOCALES.map((requested) => ({
						label: `${JSON.stringify(localePaths)} ${pattern} ${keying.label} ${mapped} ${translated.join(',')} → ${requested}`,
						config: urlConfig(localePaths, pattern, keying, collections),
						pattern: keying.key === undefined ? DEFAULT_PATTERN : pattern,
						entry: servedEntry(translated, requested),
						requested
					}))
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

function substitute(pattern: string, values: Placeholders): string {
	const path = pattern
		.replaceAll('{locale}', values.locale)
		.replaceAll('{collection}', values.collection)
		.replaceAll('{slug}', values.slug)
	return `/${path
		.split('/')
		.filter((segment) => segment !== '')
		.join('/')}`
}

function expectedIn({ config, pattern }: ResolutionCase, locale: LocaleCode, slug: string): string {
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

function assertResolution(resolution: ResolutionCase): void {
	const { config, pattern, entry, requested } = resolution
	const urls = createUrls(config)
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
		expect(cases.length).toBe(5880)
		for (const resolution of cases) {
			try {
				assertResolution(resolution)
			} catch (err) {
				throw new Error(resolution.label, { cause: err })
			}
		}
	})
})

describe('servedPath', () => {
	const urls = createUrls({ localePaths: PREFIXES })

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

describe('collectionSlug', () => {
	const urls = createUrls({ localePaths: PREFIXES, collections: COLLECTIONS })

	it('maps a collection id or any locale slug to the slug in a locale', () => {
		for (const key of [COLLECTION_ID, ...Object.values(COLLECTION_SLUGS)]) {
			expect(LOCALES.map((locale) => urls.collectionSlug(key, locale))).toEqual([
				'artigos',
				'blog',
				'articulos'
			])
		}
	})

	it('gives the collection ref of a key in a locale', () => {
		expect(urls.collectionRef('artigos', 'es')).toEqual({
			id: COLLECTION_ID,
			slug: 'articulos'
		})
		expect(urls.collectionRef(COLLECTION_ID, 'en')).toEqual({ id: COLLECTION_ID, slug: 'blog' })
		expect(urls.collectionRef('artigos', 'fr')).toBeUndefined()
		expect(urls.collectionRef('unknown', 'en')).toBeUndefined()
	})

	it('returns an unknown key unchanged, and every key without collections', () => {
		expect(urls.collectionSlug('unknown', 'en')).toBe('unknown')
		expect(createUrls({ localePaths: PREFIXES }).collectionSlug('artigos', 'en')).toBe(
			'artigos'
		)
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

	it('falls back to the collection slug and then to the default pattern', () => {
		const bySlug = createUrls({
			localePaths: PREFIXES,
			routes: { artigos: '/{locale}/a/{slug}' }
		})
		expect(bySlug.moved(params)).toBe('/pt/a/ola-mundo')
		expect(createUrls({ localePaths: PREFIXES }).moved(params)).toBe('/pt/artigos/ola-mundo')
	})

	it('throws for a locale missing from localePaths', () => {
		expect(() =>
			createUrls({ localePaths: PREFIXES }).moved({ ...params, locale: 'fr' })
		).toThrow(/"fr"/)
	})
})
