import { describe, expect, it } from 'vitest'
import { alternates, createUrls, toBcp47 } from '../src/index'
import type {
	CollectionRef,
	Entry,
	Navigation,
	RushCollections,
	RushLocalePaths,
	RushRoutes,
	UrlConfig
} from '../src/index'
import { entryExample, responseExample } from './fixtures/contract'
import { navigationItem } from './fixtures/navigation'
import { LOCALES } from './fixtures/url-oracle'
import type { EntrySummary } from './fixtures/navigation'

const LOCALE_PATHS: RushLocalePaths = { en: 'en', pt_BR: 'pt', es: 'es' }

const ANY_PATTERN = '/{locale}/{collection}/{slug}'

const ANY_ROUTES: RushRoutes = { '*': ANY_PATTERN }

function urlsFor(config: Partial<UrlConfig> = {}) {
	return createUrls({ localePaths: LOCALE_PATHS, routes: ANY_ROUTES, ...config })
}

describe('toBcp47', () => {
	it('converts underscores and leaves plain codes', () => {
		expect(toBcp47('pt_BR')).toBe('pt-BR')
		expect(toBcp47('en')).toBe('en')
	})
})

describe('entry urls', () => {
	it('uses the * route with each translation own collection slug', () => {
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

	it('throws a plain error naming a locale missing from localePaths', () => {
		const urls = createUrls({ localePaths: { en: 'en' }, routes: ANY_ROUTES })
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

describe('explicit routes', () => {
	const entry = entryExample()
	const other = { id: 'other', slug: 'docs' }
	const blog = { id: entry.collection.id, slug: 'blog' }

	it('gives a collection without a route no url', () => {
		const urls = urlsFor({ routes: {} })
		const unrouted = `collection "${entry.collection.slug}" has no route`
		expect(urls.routed(entry.collection)).toBe(false)
		expect(() => urls.entry(entry)).toThrow(unrouted)
		expect(() => urls.translation(entry, 'en')).toThrow(unrouted)
		expect(() => urls.servedPath(entry, 'pt_BR')).toThrow(unrouted)
		expect(() => urls.collection(entry.collection, 'en')).toThrow(unrouted)
		expect(() => urls.entryParams(entry.collection, 'en', 'x')).toThrow(unrouted)
		expect(() => urls.hasCollectionSegment(entry.collection)).toThrow(unrouted)
		expect(() =>
			urls.moved({
				locale: 'en',
				slug: 'x',
				collection_id: other.id,
				collection_slug: other.slug
			})
		).toThrow('collection "docs" has no route')
	})

	it('gives navigation items of an unrouted collection no href', () => {
		const urls = urlsFor({ routes: { blog: '/{locale}/posts/{slug}' } })
		const summary: EntrySummary = {
			id: 'e',
			locale: 'en',
			slug: 'x',
			fallback: false,
			collection: other
		}
		expect(urls.navigationItem(navigationItem({ entry: summary }), 'en')).toBeUndefined()
		expect(urls.navigationItem(navigationItem({ collection: other }), 'en')).toBeUndefined()
		expect(urls.routed(other)).toBe(false)
		expect(urls.routed(blog)).toBe(true)
	})

	it('routes every collection through *', () => {
		const urls = urlsFor()
		expect(urls.routed(entry.collection)).toBe(true)
		expect(urls.routed(other)).toBe(true)
		expect(urls.collection(other, 'es')).toBe('/es/docs')
	})

	it('prefers a specific key over *', () => {
		const urls = urlsFor({ routes: { blog: '/{locale}/blog/{slug}', ...ANY_ROUTES } })
		expect(urls.entry(entry)).toBe('/pt/blog/ola-mundo')
		expect(urls.collection(blog, 'en')).toBe('/en/blog')
		expect(urls.collection(other, 'en')).toBe('/en/docs')
	})
})

describe('route configuration errors', () => {
	const collections = { en: [{ id: entryExample().collection.id, slug: 'blog' }] }

	it('requires {locale} in every pattern', () => {
		expect(() => urlsFor({ routes: { blog: '/blog/{slug}' } })).toThrow(
			'route "blog" must contain {locale}'
		)
		expect(() => urlsFor({ routes: { '*': '/{collection}/{slug}' } })).toThrow(
			'route "*" must contain {locale}'
		)
	})

	it('requires {collection} in the * pattern', () => {
		expect(() => urlsFor({ routes: { '*': '/{locale}/{slug}' } })).toThrow(
			'route "*" must contain {collection}'
		)
	})

	it('rejects a key that names no collection when collections are given', () => {
		const routes = { blgo: '/{locale}/posts/{slug}', ...ANY_ROUTES }
		expect(() => urlsFor({ routes, collections })).toThrow('route "blgo" matches no collection')
		expect(urlsFor({ routes }).routed({ id: 'x', slug: 'blgo' })).toBe(true)
		expect(urlsFor({ collections }).routed({ id: 'x', slug: 'y' })).toBe(true)
	})

	it('rejects a collection slug equal to a locale prefix right after an empty locale', () => {
		const localePaths = { pt_BR: '', en: 'en' }
		const clashing = { pt_BR: [{ id: 'c', slug: 'en' }], en: [{ id: 'c', slug: 'pt' }] }
		expect(() => urlsFor({ localePaths, collections: clashing })).toThrow(
			'collection slug "en" equals the locale prefix "en"'
		)
		const fixed = { c: '/{locale}/x/{slug}' }
		expect(
			urlsFor({ localePaths, routes: fixed, collections: clashing }).routed({
				id: 'c',
				slug: 'en'
			})
		).toBe(true)
		expect(urlsFor({ collections: clashing }).routed({ id: 'c', slug: 'en' })).toBe(true)
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

describe('navigationItem from the contract examples', () => {
	const urls = urlsFor({
		routes: { artigos: '/{locale}/posts/{slug}', blog: '/{locale}/{collection}/{slug}' }
	})
	const menu = (responseExample('NavigationOk') as { data: Navigation }).data
	const listed = (responseExample('NavigationListOk') as { data: Navigation[] }).data[0]

	it('builds an entry target from the nested entry summary', () => {
		const [entryItem] = menu.items
		expect(entryItem && urls.navigationItem(entryItem, 'en')).toBe('/pt/posts/ola-mundo')
	})

	it('returns the url target and exposes link_target on the item', () => {
		const urlItem = menu.items[1]
		expect(urlItem && urls.navigationItem(urlItem, 'en')).toBe('https://example.com/contato')
		expect(urlItem?.link_target).toBe('_blank')
	})

	it('builds a collection target in the requested locale', () => {
		const [collectionItem] = listed?.items ?? []
		expect(collectionItem && urls.navigationItem(collectionItem, 'es')).toBe('/es/blog')
	})
})

describe('alternates', () => {
	it('lists every translation in localePaths order with BCP 47 hreflang', () => {
		const urls = createUrls({
			localePaths: { es: 'es', pt_BR: 'pt', en: 'en' },
			routes: ANY_ROUTES
		})
		expect(alternates(entryExample(), urls)).toEqual([
			{ locale: 'es', hreflang: 'es', url: '/es/articulos/hola-mundo' },
			{ locale: 'pt_BR', hreflang: 'pt-BR', url: '/pt/artigos/ola-mundo' },
			{ locale: 'en', hreflang: 'en', url: '/en/blog/hello-world' }
		])
	})
})

describe('collection pages and id route keys', () => {
	const routes = { blog: '/{locale}/posts/{slug}', ...ANY_ROUTES }
	const idKeyed = urlsFor({
		routes: { [entryExample().collection.id]: '/{locale}/posts/{slug}' }
	})

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
		const urls = urlsFor({ routes: { ...routes, [id]: '/{locale}/{collection}/{slug}' } })
		expect(urls.collection({ id, slug: 'blog' }, 'en')).toBe('/en/blog')
	})

	it('finds a route keyed by a slug the entry does not carry through collections', () => {
		const entry = entryExample()
		const collections = {
			en: [{ id: entry.collection.id, slug: 'blog' }],
			fr: [{ id: entry.collection.id, slug: 'billets' }]
		}
		const urls = urlsFor({ routes: { billets: '/{locale}/b/{slug}' }, collections })
		expect(urls.entry(entry)).toBe('/pt/b/ola-mundo')
		expect(urls.collection({ id: entry.collection.id, slug: 'blog' }, 'en')).toBe('/en/b')
		expect(() => urlsFor({ routes: { billets: '/{locale}/b/{slug}' } }).entry(entry)).toThrow(
			'collection "artigos" has no route'
		)
	})
})

type KeyCase = {
	collections: RushCollections
	ref: CollectionRef
	expected: Set<string>
}

const KEY_ID = 'c1'
const KEY_SLUGS = [undefined, 'a', 'b', 'c']
const REF_SLUGS = ['a', 'z']

function slugChoices(count: number): (string | undefined)[][] {
	return count === 0
		? [[]]
		: slugChoices(count - 1).flatMap((rest) => KEY_SLUGS.map((slug) => [slug, ...rest]))
}

function keyCases(): KeyCase[] {
	return slugChoices(LOCALES.length).flatMap((slugs) => {
		const collections: RushCollections = Object.fromEntries(
			LOCALES.map((locale, index) => {
				const slug = slugs[index]
				return [
					locale,
					slug === undefined
						? []
						: [
								{ id: KEY_ID, slug },
								{ id: 'c2', slug: 'x' }
							]
				]
			})
		)
		const known = slugs.filter((slug) => slug !== undefined)
		return [KEY_ID, 'other'].flatMap((id) =>
			REF_SLUGS.map((slug) => ({
				collections,
				ref: { id, slug },
				expected: new Set([id, slug, ...(id === KEY_ID ? known : [])])
			}))
		)
	})
}

describe('collectionKeys', () => {
	it('names an entry collection by id, slug, translation slugs and every locale slug', () => {
		const entry = entryExample()
		const urls = urlsFor({
			collections: { fr: [{ id: entry.collection.id, slug: 'billets' }] }
		})
		expect(new Set(urls.collectionKeys(entry))).toEqual(
			new Set([
				entry.collection.id,
				entry.collection.slug,
				...Object.values(entry.translations).map((item) => item.collection_slug),
				'billets'
			])
		)
	})

	it('names a collection ref by its id, its slug and every locale slug, once each', () => {
		const cases = keyCases()
		expect(cases.length).toBe(256)
		for (const { collections, ref, expected } of cases) {
			const urls = urlsFor({ collections })
			const keys = urls.collectionKeys(ref)
			expect(keys.length).toBe(new Set(keys).size)
			expect(new Set(keys)).toEqual(expected)
			expect(keys[0]).toBe(ref.id)
			const entry: Entry = { ...entryExample(), collection: ref, translations: {} }
			expect(urls.collectionKeys(entry)).toEqual(keys)
		}
	})
})

describe('hardening', () => {
	it('falls through when a mapped slug has no route', () => {
		const entry = entryExample()
		const urls = urlsFor({
			routes: { blog: '/{locale}/posts/{slug}' },
			collections: {
				en: [{ id: entry.collection.id, slug: 'missing' }],
				es: [{ id: entry.collection.id, slug: 'blog' }]
			}
		})
		expect(urls.entry(entry)).toBe('/pt/posts/ola-mundo')
	})

	it('throws at creation when {slug} is not the last segment', () => {
		expect(() => urlsFor({ routes: { blog: '/{slug}/{locale}' } })).toThrow(/"blog".*last/)
		expect(() => urlsFor({ routes: { blog: '/{locale}/x-{slug}' } })).toThrow(/"blog"/)
	})

	it('ignores inherited keys such as constructor', () => {
		const urls = urlsFor({ routes: { blog: '/{locale}/posts/{slug}', ...ANY_ROUTES } })
		const bare = urlsFor({ routes: { blog: '/{locale}/posts/{slug}' } })
		expect(bare.routed({ id: 'constructor', slug: 'toString' })).toBe(false)
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
		const rooted = urlsFor({
			localePaths: { en: '', pt_BR: 'pt', es: 'es' },
			routes: { blog: '/{locale}/blog/{slug}' }
		})
		expect(rooted.entryParams(ref, 'en', 'x')).toEqual({ locale: undefined, slug: 'x' })
	})
})
