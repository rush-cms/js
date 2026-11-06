import { describe, expect, it } from 'vitest'
import { createUrls } from '../src/index'
import type {
	Entry,
	LocaleCode,
	MovedParams,
	RushLocalePaths,
	RushUrls,
	UrlConfig
} from '../src/index'
import { entryExample } from './fixtures/contract'

type RouteKeying = {
	label: string
	key?: string
}

type ResolutionCase = {
	label: string
	config: UrlConfig
	entry: Entry
	requested: LocaleCode
}

const LOCALES: LocaleCode[] = ['pt_BR', 'en', 'es']

const PREFIXES: Record<LocaleCode, string> = { pt_BR: 'pt', en: 'en', es: 'es' }

const COLLECTION_SLUGS: Record<LocaleCode, string> = {
	pt_BR: 'artigos',
	en: 'blog',
	es: 'articulos'
}

const ENTRY_SLUGS: Record<LocaleCode, string> = {
	pt_BR: 'ola-mundo',
	en: 'hello-world',
	es: 'hola-mundo'
}

const PATTERNS = [
	'/{locale}/{collection}/{slug}',
	'/{locale}/posts/{slug}',
	'/{slug}',
	'/{collection}/{locale}/{slug}/',
	'/blog/{locale}/{slug}'
]

const KEYINGS: RouteKeying[] = [
	{ label: 'default' },
	{ label: 'id', key: 'articles' },
	...LOCALES.map((locale) => ({ label: locale, key: COLLECTION_SLUGS[locale] ?? '' }))
]

const COLLECTION_ID = entryExample().collection.id

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

function urlConfig(localePaths: RushLocalePaths, pattern: string, keying: RouteKeying): UrlConfig {
	const { key } = keying
	if (key === undefined) {
		return { localePaths }
	}
	return { localePaths, routes: { [key]: pattern }, routeKeysById: { [COLLECTION_ID]: key } }
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

function resolutionCases(): ResolutionCase[] {
	return localePathsVariants().flatMap((localePaths) =>
		PATTERNS.flatMap((pattern) =>
			KEYINGS.flatMap((keying) =>
				nonEmptySubsets(LOCALES).flatMap((translated) =>
					LOCALES.map((requested) => ({
						label: `${JSON.stringify(localePaths)} ${pattern} ${keying.label} ${translated.join(',')} → ${requested}`,
						config: urlConfig(localePaths, pattern, keying),
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

function segmentsOf(path: string): string[] {
	return path.split('/').filter((segment) => segment !== '')
}

function assertResolution(urls: RushUrls, entry: Entry, requested: LocaleCode): void {
	const served = urls.entryPathIn(entry, requested)
	expect(urls.moved(movedTo(entry, requested))).toBe(served)
	if (!entry.fallback) {
		expect(served).toBe(urls.entry(entry))
		expect(served).toBe(urls.translation(entry, requested))
	}
	expect(served.startsWith('/')).toBe(true)
	expect(served).not.toContain('//')
	expect(segmentsOf(served).at(-1)).toBe(entry.slug)
	const params = urls.entryParams(entry.collection, requested, entry.slug)
	const segments = segmentsOf(served)
	for (const value of Object.values(params)) {
		if (value !== undefined) {
			expect(segments).toContain(value)
		}
	}
	if (params.locale === undefined && 'locale' in params) {
		expect(urls.localeParam(requested)).toBeUndefined()
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

describe('entryPathIn and moved over every route and locale', () => {
	const cases = resolutionCases()

	it(`agree for ${cases.length} generated cases`, () => {
		expect(cases.length).toBe(4200)
		for (const { label, config, entry, requested } of cases) {
			try {
				assertResolution(createUrls(config), entry, requested)
			} catch (err) {
				throw new Error(label, { cause: err })
			}
		}
	})
})

describe('entryPathIn', () => {
	const urls = createUrls({ localePaths: PREFIXES })

	it('gives a fallback page the requested locale prefix and collection slug', () => {
		expect(urls.entryPathIn(servedEntry(['pt_BR'], 'es'), 'es')).toBe('/es/articulos/ola-mundo')
	})

	it('gives a translated entry the url of its translation in that locale', () => {
		const entry = servedEntry(['pt_BR', 'en'], 'pt_BR')
		expect(urls.entryPathIn(entry, 'en')).toBe('/en/blog/hello-world')
	})
})

describe('moved', () => {
	const params = movedTo(servedEntry(['pt_BR'], 'pt_BR'), 'pt_BR')

	it('picks the route pattern by collection id when no slug matches a route key', () => {
		const urls = createUrls({
			localePaths: PREFIXES,
			routes: { articles: '/{locale}/posts/{slug}' },
			routeKeysById: { [COLLECTION_ID]: 'articles' }
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
