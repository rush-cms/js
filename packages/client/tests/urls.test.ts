import { describe, expect, it } from 'vitest'
import { alternates, createUrls, toBcp47 } from '../src/index'
import type { Entry, NavigationItem, RushLocalePaths, UrlConfig } from '../src/index'
import { entryExample } from './fixtures/contract'

type EntrySummary = NonNullable<NonNullable<NavigationItem['target']>['entry']>

const LOCALE_PATHS: RushLocalePaths = { en: 'en', pt_BR: 'pt', es: 'es' }

function urlsFor(config: Partial<UrlConfig> = {}) {
	return createUrls({ localePaths: LOCALE_PATHS, ...config })
}

function navigationItem(target?: NavigationItem['target']): NavigationItem {
	return { label: 'x', type: 'entry', ...(target === undefined ? {} : { target }), children: [] }
}

describe('toBcp47', () => {
	it('converts underscores and leaves plain codes', () => {
		expect(toBcp47('pt_BR')).toBe('pt-BR')
		expect(toBcp47('en')).toBe('en')
	})
})

describe('entry urls', () => {
	it('uses the default pattern with each translation own collection slug', () => {
		const urls = urlsFor()
		const entry = entryExample()
		expect(urls.entry(entry)).toBe('/pt/artigos/ola-mundo')
		expect(urls.translation(entry, 'en')).toBe('/en/blog/hello-world')
		expect(urls.translation(entry, 'es')).toBe('/es/articulos/hola-mundo')
	})

	it('matches a route by the collection slug of any locale', () => {
		const urls = urlsFor({ routes: { blog: '/{locale}/posts/{slug}' } })
		const entry = entryExample()
		expect(urls.entry(entry)).toBe('/pt/posts/ola-mundo')
		expect(urls.translation(entry, 'en')).toBe('/en/posts/hello-world')
	})

	it('removes the locale segment for an empty prefix without double or trailing slashes', () => {
		const urls = urlsFor({
			localePaths: { en: '', pt_BR: 'pt', es: 'es' },
			routes: { blog: '/{locale}/{collection}/{slug}/' }
		})
		const entry = entryExample()
		expect(urls.translation(entry, 'en')).toBe('/blog/hello-world')
		expect(urls.translation(entry, 'es')).toBe('/es/articulos/hola-mundo')
	})

	it('supports a pattern without a locale placeholder', () => {
		const urls = urlsFor({ routes: { artigos: '/{slug}' } })
		expect(urls.entry(entryExample())).toBe('/ola-mundo')
	})

	it('throws a plain error naming a locale missing from localePaths', () => {
		const urls = createUrls({ localePaths: { en: 'en' } })
		expect(() => urls.entry(entryExample())).toThrow(/pt_BR/)
		expect(() => urls.homepage('fr')).toThrow(/"fr"/)
	})

	it('throws when the entry has no such translation', () => {
		expect(() => urlsFor().translation(entryExample(), 'fr')).toThrow(/"fr"/)
	})

	it('throws for two empty prefixes', () => {
		expect(() => createUrls({ localePaths: { en: '', pt_BR: '' } })).toThrow(/empty prefix/)
	})
})

describe('homepage', () => {
	it('is the prefix, or the root for an empty prefix', () => {
		const urls = urlsFor({ localePaths: { en: '', pt_BR: 'pt' } })
		expect(urls.homepage('en')).toBe('/')
		expect(urls.homepage('pt_BR')).toBe('/pt')
	})
})

describe('navigationItem', () => {
	it('builds entry targets from the summary', () => {
		const urls = urlsFor({ routes: { blog: '/{locale}/posts/{slug}' } })
		const summary: EntrySummary = {
			id: 'e',
			locale: 'en',
			slug: 'hello-world',
			fallback: false,
			collection: { id: 'c', slug: 'blog' }
		}
		expect(urls.navigationItem(navigationItem({ entry: summary }), 'en')).toBe(
			'/en/posts/hello-world'
		)
	})

	it('returns url targets unchanged and nothing without a target', () => {
		const urls = urlsFor()
		expect(urls.navigationItem(navigationItem({ url: 'https://a.test/x?y=1' }), 'en')).toBe(
			'https://a.test/x?y=1'
		)
		expect(urls.navigationItem(navigationItem(), 'en')).toBeUndefined()
	})
})

describe('alternates', () => {
	it('lists every translation in localePaths order with BCP 47 hreflang', () => {
		const urls = createUrls({ localePaths: { es: 'es', pt_BR: 'pt', en: 'en' } })
		expect(alternates(entryExample(), urls)).toEqual([
			{ locale: 'es', hreflang: 'es', url: '/es/articulos/hola-mundo' },
			{ locale: 'pt_BR', hreflang: 'pt-BR', url: '/pt/artigos/ola-mundo' },
			{ locale: 'en', hreflang: 'en', url: '/en/blog/hello-world' }
		])
	})
})

describe('collection pages and id route keys', () => {
	const routes = { blog: '/{locale}/posts/{slug}', docs: '/{locale}/{collection}/{slug}' }
	const idKeyed = urlsFor({ routes, routeKeysById: { [entryExample().collection.id]: 'blog' } })

	it('drops the slug segment for collection pages', () => {
		const urls = urlsFor({ routes })
		expect(urls.collection({ id: 'c', slug: 'blog' }, 'pt_BR')).toBe('/pt/posts')
		expect(urls.collection({ id: 'c', slug: 'other' }, 'pt_BR')).toBe('/pt/other')
		const root = createUrls({ localePaths: { en: '' }, routes: { blog: '/{locale}/{slug}' } })
		expect(root.collection({ id: 'c', slug: 'blog' }, 'en')).toBe('/')
	})

	it('navigationItem builds collection targets', () => {
		const item = navigationItem({ collection: { id: 'c', slug: 'blog' } })
		expect(urlsFor({ routes }).navigationItem(item, 'es')).toBe('/es/posts')
	})

	it('matches by collection id for entry and translations', () => {
		expect(idKeyed.entry(entryExample())).toBe('/pt/posts/ola-mundo')
		expect(idKeyed.translation(entryExample(), 'es')).toBe('/es/posts/hola-mundo')
	})

	it('matches by collection id for nav entry targets and collection pages', () => {
		const id = entryExample().collection.id
		const summary: EntrySummary = {
			id: 'e',
			locale: 'es',
			slug: 'hola',
			fallback: false,
			collection: { id, slug: 'articulos' }
		}
		expect(idKeyed.navigationItem(navigationItem({ entry: summary }), 'es')).toBe(
			'/es/posts/hola'
		)
		expect(idKeyed.collection({ id, slug: 'articulos' }, 'es')).toBe('/es/posts')
	})

	it('prefers the id key over a slug match', () => {
		const id = entryExample().collection.id
		const urls = urlsFor({ routes, routeKeysById: { [id]: 'docs' } })
		expect(urls.collection({ id, slug: 'blog' }, 'en')).toBe('/en/blog')
	})
})

describe('hardening', () => {
	it('falls through when the id key has no route', () => {
		const entry = entryExample()
		const urls = urlsFor({
			routes: { blog: '/{locale}/posts/{slug}' },
			routeKeysById: { [entry.collection.id]: 'missing' }
		})
		expect(urls.entry(entry)).toBe('/pt/posts/ola-mundo')
	})

	it('throws at creation when {slug} is not the last segment', () => {
		expect(() => urlsFor({ routes: { blog: '/{slug}/{locale}' } })).toThrow(/"blog".*last/)
		expect(() => urlsFor({ routes: { blog: '/{locale}/x-{slug}' } })).toThrow(/"blog"/)
	})

	it('ignores inherited keys such as constructor', () => {
		const urls = urlsFor({ routes: { blog: '/{locale}/posts/{slug}' } })
		expect(urls.collection({ id: 'constructor', slug: 'constructor' }, 'en')).toBe(
			'/en/constructor'
		)
		expect(urls.collection({ id: 'c', slug: 'toString' }, 'en')).toBe('/en/toString')
		expect(() => urls.homepage('constructor')).toThrow(/"constructor"/)
	})

	it('never alters slug content', () => {
		const entry = entryExample()
		const edited: Entry = {
			...entry,
			translations: {
				...entry.translations,
				pt_BR: { slug: 'a//b/', collection_slug: 'artigos' }
			}
		}
		expect(urlsFor().entry(edited)).toBe('/pt/artigos/a//b/')
	})

	it('rejects locale prefixes containing a slash', () => {
		expect(() => createUrls({ localePaths: { en: 'en', pt_BR: '/pt' } })).toThrow(/"pt_BR"/)
	})
})

describe('entryParams', () => {
	const ref = { id: entryExample().collection.id, slug: 'blog' }

	it('derives the params from the route pattern', () => {
		const urls = urlsFor({ routes: { blog: '/{locale}/posts/{slug}' } })
		expect(urls.entryParams(ref, 'en', 'borrowed')).toEqual({ locale: 'en', slug: 'borrowed' })
		expect(urlsFor().entryParams(ref, 'es', 'x')).toEqual({
			locale: 'es',
			collection: 'blog',
			slug: 'x'
		})
	})

	it('leaves the locale param undefined for an empty prefix and omits unused ones', () => {
		const urls = urlsFor({
			localePaths: { en: '', pt_BR: 'pt', es: 'es' },
			routes: { blog: '/blog/{slug}' }
		})
		expect(urls.entryParams(ref, 'en', 'x')).toEqual({ slug: 'x' })
		const rooted = urlsFor({
			localePaths: { en: '', pt_BR: 'pt', es: 'es' },
			routes: { blog: '/{locale}/blog/{slug}' }
		})
		expect(rooted.entryParams(ref, 'en', 'x')).toEqual({ locale: undefined, slug: 'x' })
	})
})
