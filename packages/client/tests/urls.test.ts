import { describe, expect, it } from 'vitest'
import { alternates, createUrls, toBcp47 } from '../src/index'
import type { Entry, NavigationItem, RushLocalePaths, UrlConfig } from '../src/index'
import { responseExample } from './fixtures/contract'

type EntrySummary = NonNullable<NonNullable<NavigationItem['target']>['entry']>

const LOCALE_PATHS: RushLocalePaths = { en: 'en', pt_BR: 'pt', es: 'es' }

function exampleEntry(): Entry {
	return (responseExample('EntryOk') as { data: Entry }).data
}

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
		const entry = exampleEntry()
		expect(urls.entry(entry)).toBe('/pt/artigos/ola-mundo')
		expect(urls.translation(entry, 'en')).toBe('/en/blog/hello-world')
		expect(urls.translation(entry, 'es')).toBe('/es/articulos/hola-mundo')
	})

	it('matches a route by the collection slug of any locale', () => {
		const urls = urlsFor({ routes: { blog: '/{locale}/posts/{slug}' } })
		const entry = exampleEntry()
		expect(urls.entry(entry)).toBe('/pt/posts/ola-mundo')
		expect(urls.translation(entry, 'en')).toBe('/en/posts/hello-world')
	})

	it('removes the locale segment for an empty prefix without double or trailing slashes', () => {
		const urls = urlsFor({
			localePaths: { en: '', pt_BR: 'pt', es: 'es' },
			routes: { blog: '/{locale}/{collection}/{slug}/' }
		})
		const entry = exampleEntry()
		expect(urls.translation(entry, 'en')).toBe('/blog/hello-world')
		expect(urls.translation(entry, 'es')).toBe('/es/articulos/hola-mundo')
	})

	it('supports a pattern without a locale placeholder', () => {
		const urls = urlsFor({ routes: { artigos: '/{slug}' } })
		expect(urls.entry(exampleEntry())).toBe('/ola-mundo')
	})

	it('throws a plain error naming a locale missing from localePaths', () => {
		const urls = createUrls({ localePaths: { en: 'en' } })
		expect(() => urls.entry(exampleEntry())).toThrow(/pt_BR/)
		expect(() => urls.homepage('fr')).toThrow(/"fr"/)
	})

	it('throws when the entry has no such translation', () => {
		expect(() => urlsFor().translation(exampleEntry(), 'fr')).toThrow(/"fr"/)
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
		expect(urls.navigationItem(navigationItem({ entry: summary }))).toBe(
			'/en/posts/hello-world'
		)
	})

	it('returns url targets unchanged and nothing without a target', () => {
		const urls = urlsFor()
		expect(urls.navigationItem(navigationItem({ url: 'https://a.test/x?y=1' }))).toBe(
			'https://a.test/x?y=1'
		)
		expect(urls.navigationItem(navigationItem())).toBeUndefined()
	})
})

describe('alternates', () => {
	it('lists every translation in localePaths order with BCP 47 hreflang', () => {
		const urls = createUrls({ localePaths: { es: 'es', pt_BR: 'pt', en: 'en' } })
		expect(alternates(exampleEntry(), urls)).toEqual([
			{ locale: 'es', hreflang: 'es', url: '/es/articulos/hola-mundo' },
			{ locale: 'pt_BR', hreflang: 'pt-BR', url: '/pt/artigos/ola-mundo' },
			{ locale: 'en', hreflang: 'en', url: '/en/blog/hello-world' }
		])
	})
})
