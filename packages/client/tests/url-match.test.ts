import { isDeepStrictEqual } from 'node:util'
import { describe, expect, it } from 'vitest'
import { createUrls } from '../src/index'
import type {
	CollectionRef,
	LocaleCode,
	RushCollections,
	RushLocalePaths,
	RushPageSegments,
	RushRoutes,
	RushUrls,
	UrlConfig,
	UrlMatch
} from '../src/index'
import {
	LOCALES,
	PREFIXES,
	ROUTE_ANY,
	VALUE,
	collisions,
	nonEmptySubsets,
	templatesOf,
	thrownBy
} from './fixtures/url-oracle'
import type { Template } from './fixtures/url-oracle'

type Instance = {
	url: string
	target: UrlMatch
}

type Candidate = {
	template: Template
	match: UrlMatch
}

type MatchCase = {
	label: string
	config: UrlConfig
	templates: Template[]
}

type Mismatch = {
	label: string
	path: string
	expected: UrlMatch | undefined
	actual: UrlMatch | undefined
}

type Tally = {
	exact: number
	shadowed: number
	unmatched: number
	collisions: number
}

const PAGES = [1, 2, 3, 4, 5]

const SLUGS = [
	'olá-mundo',
	'pão',
	'日本語',
	'a b',
	'🚀',
	'2',
	'02',
	'page',
	'blog',
	'sobre',
	'pages',
	'en',
	'pt'
]

const SUFFIXES = [
	'/x',
	'/page/1',
	'/page/02',
	'/page/2.0',
	'/pagina/1',
	'/p/+3',
	'/página/1',
	'/page/99999999999999999999',
	'/%E0%A4%A'
]

const ANY_PATTERN = '/{locale}/{collection}/{slug}'

const ROOT_PATTERN = '/{locale}/{slug}'

const COLLECTIONS: RushCollections = {
	pt_BR: [
		{ id: 'posts', slug: 'artigos' },
		{ id: 'pages', slug: 'paginas' },
		{ id: 'docs', slug: 'documentação' }
	],
	en: [
		{ id: 'posts', slug: 'blog' },
		{ id: 'pages', slug: 'pages' },
		{ id: 'docs', slug: 'docs' }
	],
	es: [
		{ id: 'posts', slug: 'artículos' },
		{ id: 'pages', slug: 'páginas' },
		{ id: 'docs', slug: 'page' }
	]
}

const ROUTE_SETS: RushRoutes[] = [
	{ [ROUTE_ANY]: ANY_PATTERN },
	{ [ROUTE_ANY]: ANY_PATTERN, pages: ROOT_PATTERN },
	{ posts: '/{locale}/noticias/{slug}', pages: ROOT_PATTERN },
	{ posts: ANY_PATTERN, [ROUTE_ANY]: '/{locale}/c/{collection}/{slug}' },
	{ docs: '/{locale}/blog/sobre', [ROUTE_ANY]: ANY_PATTERN },
	{ posts: ROOT_PATTERN, pages: ROOT_PATTERN },
	{ posts: '/{locale}/en/{slug}', pages: ANY_PATTERN }
]

const PAGE_SEGMENTS: (RushPageSegments | undefined)[] = [
	undefined,
	{ pt_BR: 'pagina' },
	{ en: 'p', es: 'página' }
]

function localePathsVariants(): RushLocalePaths[] {
	return nonEmptySubsets(LOCALES).flatMap((locales) =>
		[undefined, ...locales].map((empty) =>
			Object.fromEntries(
				locales.map((locale) => [locale, locale === empty ? '' : (PREFIXES[locale] ?? '')])
			)
		)
	)
}

function literalCount(template: Template): number {
	return template.segments.filter((segment) => segment !== VALUE).length
}

function pageNumber(value: string): number | undefined {
	const page = Number(value)
	return /^[1-9][0-9]*$/.test(value) && Number.isSafeInteger(page) && page >= 2 ? page : undefined
}

function readTemplate(template: Template, value: string): UrlMatch | undefined {
	if (template.kind === 'homepage') {
		return { kind: 'homepage', locale: template.locale }
	}
	const { locale, collection } = template
	if (template.kind === 'entry') {
		return { kind: 'entry', locale, collection, slug: value }
	}
	const page = template.kind === 'index' ? 1 : pageNumber(value)
	return page === undefined ? undefined : { kind: 'collection', locale, collection, page }
}

function decodedSegments(pathname: string): string[] | undefined {
	try {
		return pathname
			.split('/')
			.filter((segment) => segment.length > 0)
			.map((segment) => decodeURIComponent(segment))
	} catch {
		return undefined
	}
}

function valueIn(template: Template, segments: string[]): string | undefined {
	if (template.segments.length !== segments.length) {
		return undefined
	}
	const fits = template.segments.every((part, i) => part === VALUE || part === segments[i])
	const at = template.segments.indexOf(VALUE)
	return fits ? (at === -1 ? '' : segments[at]) : undefined
}

function oracleMatch(templates: Template[], pathname: string): UrlMatch | undefined {
	const segments = decodedSegments(pathname)
	if (segments === undefined) {
		return undefined
	}
	const candidates = templates.flatMap((template): Candidate[] => {
		const value = valueIn(template, segments)
		const match = value === undefined ? undefined : readTemplate(template, value)
		return match === undefined ? [] : [{ template, match }]
	})
	const rank = (candidate: Candidate) =>
		literalCount(candidate.template) * 2 + (candidate.template.kind === 'homepage' ? 1 : 0)
	return candidates.sort((a, b) => rank(b) - rank(a))[0]?.match
}

function render(segments: string[], value: string): string {
	return `/${segments.map((segment) => (segment === VALUE ? value : segment)).join('/')}`
}

function instancesOf(template: Template): Instance[] {
	if (template.kind === 'homepage') {
		return [
			{
				url: render(template.segments, ''),
				target: { kind: 'homepage', locale: template.locale }
			}
		]
	}
	const { locale, collection, segments } = template
	if (template.kind === 'entry') {
		return SLUGS.map((slug) => ({
			url: render(segments, slug),
			target: { kind: 'entry', locale, collection, slug }
		}))
	}
	const pages = template.kind === 'index' ? [1] : PAGES.filter((page) => page > 1)
	return pages.map((page) => ({
		url: render(segments, String(page)),
		target: { kind: 'collection', locale, collection, page }
	}))
}

function builtBy(urls: RushUrls, target: UrlMatch): string {
	if (target.kind === 'homepage') {
		return urls.homepage(target.locale)
	}
	if (target.kind === 'collection') {
		return urls.collection(target.collection, target.locale, target.page)
	}
	return urls.moved({
		locale: target.locale,
		slug: target.slug,
		collection_id: target.collection.id,
		collection_slug: target.collection.slug
	})
}

function variantsOf(url: string): string[] {
	const trimmed = url === '/' ? '' : url
	return [
		url,
		new URL(url, 'http://site.test').pathname,
		`${url}/`,
		`/${url.replaceAll('/', '//')}`,
		url.toUpperCase(),
		`/pt_BR${trimmed}`,
		...SUFFIXES.map((suffix) => `${trimmed}${suffix}`)
	]
}

function matchCases(): MatchCase[] {
	return localePathsVariants().flatMap((localePaths) =>
		ROUTE_SETS.flatMap((routes) =>
			PAGE_SEGMENTS.map((pageSegments) => {
				const base = { localePaths, routes, collections: COLLECTIONS }
				const config: UrlConfig =
					pageSegments === undefined ? base : { ...base, pageSegments }
				return { label: JSON.stringify(config), config, templates: templatesOf(config) }
			})
		)
	)
}

function checkCase(
	{ label, config, templates }: MatchCase,
	tally: Tally,
	mismatches: Mismatch[]
): void {
	const messages = collisions(templates)
	if (messages.length > 0) {
		tally.collisions += 1
		expect(messages, label).toContain(thrownBy(config))
		return
	}
	const urls = createUrls(config)
	for (const { url, target } of templates.flatMap(instancesOf)) {
		expect(builtBy(urls, target), label).toBe(url)
		const expected = oracleMatch(templates, url)
		if (isDeepStrictEqual(expected, target)) {
			tally.exact += 1
		} else {
			tally.shadowed += 1
		}
		for (const path of variantsOf(url)) {
			const want = oracleMatch(templates, path)
			const actual = urls.match(path)
			if (want === undefined) {
				tally.unmatched += 1
			}
			if (!isDeepStrictEqual(actual, want)) {
				mismatches.push({ label, path, expected: want, actual })
			}
		}
	}
}

describe('match over generated configs', () => {
	const cases = matchCases()

	it(`agrees with the independent oracle on ${cases.length} configs`, () => {
		expect(cases.length).toBe(399)
		const tally: Tally = { exact: 0, shadowed: 0, unmatched: 0, collisions: 0 }
		const mismatches: Mismatch[] = []
		for (const matchCase of cases) {
			checkCase(matchCase, tally, mismatches)
		}
		expect(mismatches.slice(0, 5)).toEqual([])
		expect(tally).toEqual({ exact: 26108, shadowed: 270, unmatched: 287016, collisions: 93 })
	})
})

const BLOG: CollectionRef = { id: 'posts', slug: 'blog' }

const PAGES_PT: CollectionRef = { id: 'pages', slug: 'paginas' }

const SMALL: RushCollections = {
	pt_BR: [BLOG, PAGES_PT],
	en: [BLOG, { id: 'pages', slug: 'pages' }]
}

const SMALL_PATHS: RushLocalePaths = { pt_BR: '', en: 'en' }

function smallUrls(routes: RushRoutes, pageSegments?: RushPageSegments): RushUrls {
	const config: UrlConfig = { localePaths: SMALL_PATHS, routes, collections: SMALL }
	return createUrls(pageSegments === undefined ? config : { ...config, pageSegments })
}

function listing(locale: LocaleCode, page: number): UrlMatch {
	return { kind: 'collection', locale, collection: BLOG, page }
}

describe('match', () => {
	const any = smallUrls({ [ROUTE_ANY]: ANY_PATTERN })

	it('ignores trailing and repeated slashes', () => {
		for (const path of ['/blog', '/blog/', '//blog', '//blog//']) {
			expect(any.match(path), path).toStrictEqual(listing('pt_BR', 1))
		}
	})

	it('decodes each segment exactly once', () => {
		const entry = (slug: string): UrlMatch => ({
			kind: 'entry',
			locale: 'pt_BR',
			collection: BLOG,
			slug
		})
		expect(any.match('/blog/p%C3%A3o')).toStrictEqual(entry('pão'))
		expect(any.match('/blog/pão')).toStrictEqual(entry('pão'))
		expect(any.match('/blog/p%25C3%25A3o')).toStrictEqual(entry('p%C3%A3o'))
		expect(any.match('/blog/%E0%A4%A')).toBeUndefined()
	})

	it('compares locale prefixes case-sensitively and never by locale code', () => {
		for (const path of ['/EN/blog', '/En/blog/x', '/pt_BR/blog', '/en_US/blog']) {
			expect(any.match(path), path).toBeUndefined()
		}
		expect(any.match('/en/blog')).toStrictEqual(listing('en', 1))
	})

	it('gives the homepage of every locale', () => {
		expect(any.match('/')).toStrictEqual({ kind: 'homepage', locale: 'pt_BR' })
		expect(any.match('/en/')).toStrictEqual({ kind: 'homepage', locale: 'en' })
	})

	it('prefers a collection index over a root page with the same slug', () => {
		const rooted = smallUrls({ [ROUTE_ANY]: ANY_PATTERN, pages: ROOT_PATTERN })
		expect(rooted.match('/blog')).toStrictEqual(listing('pt_BR', 1))
		expect(rooted.match('/sobre')).toStrictEqual({
			kind: 'entry',
			locale: 'pt_BR',
			collection: PAGES_PT,
			slug: 'sobre'
		})
		expect(rooted.match('/')).toStrictEqual({ kind: 'homepage', locale: 'pt_BR' })
		expect(rooted.match('/page/2')).toStrictEqual({
			kind: 'collection',
			locale: 'pt_BR',
			collection: PAGES_PT,
			page: 2
		})
	})

	it('throws without collections', () => {
		const bare = createUrls({ localePaths: SMALL_PATHS, routes: { [ROUTE_ANY]: ANY_PATTERN } })
		expect(() => bare.match('/blog')).toThrow('match needs collections')
	})
})

describe('routes that produce the same URLs', () => {
	it('rejects two root routes', () => {
		expect(() => smallUrls({ posts: ROOT_PATTERN, pages: ROOT_PATTERN })).toThrow(
			'routes "posts" and "pages" produce the same URLs'
		)
	})

	it('rejects a collection index on another locale homepage', () => {
		expect(() => smallUrls({ posts: '/{locale}/en/{slug}' })).toThrow(
			'routes "homepage" and "posts" produce the same URLs'
		)
	})

	it('rejects a page URL equal to an entry URL', () => {
		const routes = { posts: '/{locale}/x/{slug}', pages: '/{locale}/x/page/{slug}' }
		expect(() => smallUrls(routes)).toThrow('routes "posts" and "pages" produce the same URLs')
	})

	it('skips the check without collections', () => {
		const routes = { posts: ROOT_PATTERN, pages: ROOT_PATTERN }
		expect(() => createUrls({ localePaths: SMALL_PATHS, routes })).not.toThrow()
	})
})

describe('pagination', () => {
	const paged = smallUrls({ [ROUTE_ANY]: ANY_PATTERN }, { pt_BR: 'pagina' })

	it('uses the locale page segment and page for every other locale', () => {
		expect(paged.collection(BLOG, 'pt_BR', 2)).toBe('/blog/pagina/2')
		expect(paged.collection(BLOG, 'en', 2)).toBe('/en/blog/page/2')
		expect(paged.match('/blog/pagina/2')).toStrictEqual(listing('pt_BR', 2))
		expect(paged.match('/en/blog/page/2')).toStrictEqual(listing('en', 2))
		expect(paged.match('/blog/page/2')).toBeUndefined()
	})

	it('gives the index for page 1 and never reads page 1 or non-canonical numbers', () => {
		expect(paged.collection(BLOG, 'en', 1)).toBe(paged.collection(BLOG, 'en'))
		expect(paged.collection(BLOG, 'en')).toBe('/en/blog')
		for (const page of ['1', '02', '+2', '2.0', '1e1', '0', '-2']) {
			expect(paged.match(`/en/blog/page/${page}`), page).toBeUndefined()
		}
		expect(paged.match('/en/blog/page/10')).toStrictEqual(listing('en', 10))
	})

	it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('throws for page %s', (page) => {
		expect(() => paged.collection(BLOG, 'en', page)).toThrow('page must be a positive integer')
	})

	it('rejects an empty page segment or one with a slash', () => {
		expect(() => smallUrls({}, { en: '' })).toThrow('pageSegments segment for "en"')
		expect(() => smallUrls({}, { en: 'a/b' })).toThrow(
			'pageSegments segment for "en" must not contain "/"'
		)
	})
})
