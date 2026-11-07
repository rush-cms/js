import { describe, expect, it } from 'vitest'
import { createUrls, navigationLinks } from '../src/index'
import type { CollectionRef, NavigationItem, NavigationLink, RushUrls } from '../src/index'
import { navigationItem } from './fixtures/navigation'
import type { EntrySummary } from './fixtures/navigation'

type NavigationAttribute = NonNullable<NavigationItem['attributes']>[number]

type AttributeValue = NavigationAttribute['value']

type RelCase = {
	nofollow: boolean | undefined
	noreferrer: boolean | undefined
	linkTarget: string | undefined
	relValues: AttributeValue[]
}

type StringifyCase = {
	value: AttributeValue
	expected: string | undefined
}

const BLOG: CollectionRef = { id: 'c-blog', slug: 'blog' }

const DOCS: CollectionRef = { id: 'c-docs', slug: 'docs' }

const FLAGS = [undefined, false, true]

const LINK_TARGETS = [undefined, '_blank', '_self']

const REL_VALUES: AttributeValue[][] = [
	[],
	['nofollow'],
	['external noopener'],
	['  me   external '],
	['noreferrer nofollow noopener'],
	['author', 'author help'],
	[true],
	[null],
	[7],
	[['x']],
	[{ rel: 'x' }]
]

const STRINGIFY: StringifyCase[] = [
	{ value: 'Home', expected: 'Home' },
	{ value: '', expected: '' },
	{ value: 0, expected: '0' },
	{ value: 2.5, expected: '2.5' },
	{ value: true, expected: '' },
	{ value: false, expected: undefined },
	{ value: null, expected: undefined },
	{ value: ['a'], expected: undefined },
	{ value: { a: 1 }, expected: undefined }
]

const urls: RushUrls = createUrls({
	localePaths: { en: 'en', pt_BR: '' },
	routes: { [BLOG.slug]: '/{locale}/{collection}/{slug}' }
})

function summaryIn(collection: CollectionRef): EntrySummary {
	return { id: 'e', locale: 'en', slug: 'hello', fallback: false, collection }
}

function withChildren(item: NavigationItem, children: NavigationItem[]): NavigationItem {
	return { ...item, children }
}

function relCases(): RelCase[] {
	return FLAGS.flatMap((nofollow) =>
		FLAGS.flatMap((noreferrer) =>
			LINK_TARGETS.flatMap((linkTarget) =>
				REL_VALUES.map((relValues) => ({ nofollow, noreferrer, linkTarget, relValues }))
			)
		)
	)
}

function itemOf(relCase: RelCase): NavigationItem {
	const attributes: NavigationAttribute[] = [
		{ name: 'title', value: 'T' },
		...relCase.relValues.map((value) => ({ name: 'rel', value }))
	]
	return {
		...navigationItem({ url: '/a' }),
		...(relCase.nofollow === undefined ? {} : { nofollow: relCase.nofollow }),
		...(relCase.noreferrer === undefined ? {} : { noreferrer: relCase.noreferrer }),
		...(relCase.linkTarget === undefined ? {} : { link_target: relCase.linkTarget }),
		attributes
	}
}

function attributeTokens(values: AttributeValue[]): string[] {
	return values
		.filter((value) => typeof value === 'string' || typeof value === 'number')
		.flatMap((value) => String(value).split(/\s+/))
		.filter((token) => token !== '')
}

function onlyLink(items: NavigationItem[]): NavigationLink {
	const [link, ...rest] = navigationLinks(items, urls, 'en')
	expect(rest).toEqual([])
	if (link === undefined) {
		throw new Error('expected one link')
	}
	return link
}

describe('navigationLinks rel', () => {
	it.each(relCases())('derives rel for %o', (relCase) => {
		const link = onlyLink([itemOf(relCase)])
		const tokens = link.rel?.split(' ') ?? []
		const fromAttributes = attributeTokens(relCase.relValues)
		const flagged = [
			relCase.nofollow === true ? 'nofollow' : undefined,
			relCase.noreferrer === true ? 'noreferrer' : undefined,
			relCase.linkTarget === '_blank' ? 'noopener' : undefined
		].filter((token) => token !== undefined)

		expect(new Set(tokens).size).toBe(tokens.length)
		expect(tokens.every((token) => token !== '')).toBe(true)
		expect(tokens.includes('noopener')).toBe(
			relCase.linkTarget === '_blank' || fromAttributes.includes('noopener')
		)
		expect(new Set(tokens)).toEqual(new Set([...fromAttributes, ...flagged]))
		expect(tokens.slice(0, new Set(fromAttributes).size)).toEqual([...new Set(fromAttributes)])
		expect('rel' in link).toBe(tokens.length > 0)
		expect(link.attributes).toEqual({ title: 'T' })
	})
})

describe('navigationLinks attributes', () => {
	it.each(STRINGIFY)('stringifies $value to $expected', ({ value, expected }) => {
		const link = onlyLink([
			{ ...navigationItem({ url: '/a' }), attributes: [{ name: 'data-x', value }] }
		])
		expect(link.attributes).toEqual(expected === undefined ? {} : { 'data-x': expected })
	})

	it('drops an attribute without a value', () => {
		const link = onlyLink([
			{ ...navigationItem({ url: '/a' }), attributes: [{ name: 'download' }] }
		])
		expect(link.attributes).toEqual({})
	})

	it('maps label, target and class and omits what is absent', () => {
		const full = onlyLink([
			{
				...navigationItem({ url: '/a' }),
				label: 'About',
				link_target: '_self',
				class: 'nav-about'
			}
		])
		expect(full).toEqual({
			label: 'About',
			href: '/a',
			target: '_self',
			className: 'nav-about',
			attributes: {},
			children: []
		})
		const bare = onlyLink([navigationItem({ url: '/b' })])
		expect(Object.keys(bare).sort()).toEqual(['attributes', 'children', 'href', 'label'])
	})
})

describe('navigationLinks href and children', () => {
	const routedEntry = navigationItem({ entry: summaryIn(BLOG) })
	const unroutedEntry = navigationItem({ entry: summaryIn(DOCS) })
	const routedCollection = navigationItem({ collection: BLOG })
	const unroutedCollection = navigationItem({ collection: DOCS })
	const unsafeUrl = navigationItem({ url: '' })
	const noTarget = navigationItem()

	it('takes href from urls.navigationItem in the given locale', () => {
		for (const item of [routedEntry, routedCollection, navigationItem({ url: '/x' })]) {
			for (const locale of ['en', 'pt_BR']) {
				const [link] = navigationLinks([item], urls, locale)
				expect(link?.href).toBe(urls.navigationItem(item, locale))
			}
		}
		expect(onlyLink([routedCollection]).href).toBe('/en/blog')
	})

	it('drops a leaf without href', () => {
		for (const item of [unroutedEntry, unroutedCollection, unsafeUrl, noTarget]) {
			expect(navigationLinks([item], urls, 'en')).toEqual([])
		}
	})

	it('keeps a parent without href only when a child survives', () => {
		for (const parent of [unroutedEntry, unroutedCollection, unsafeUrl, noTarget]) {
			const kept = onlyLink([withChildren(parent, [unroutedEntry, routedEntry])])
			expect('href' in kept).toBe(false)
			expect(kept.children.map((child) => child.href)).toEqual(['/en/blog/hello'])
			expect(
				navigationLinks([withChildren(parent, [unroutedEntry, unsafeUrl])], urls, 'en')
			).toEqual([])
		}
	})

	it('drops nested branches that end without href', () => {
		const deadBranch = withChildren(noTarget, [withChildren(unsafeUrl, [unroutedCollection])])
		const liveBranch = withChildren(noTarget, [withChildren(unsafeUrl, [routedCollection])])
		const links = navigationLinks([deadBranch, liveBranch, routedEntry], urls, 'pt_BR')
		expect(links).toHaveLength(2)
		expect(links[0]?.children[0]?.children[0]?.href).toBe('/blog')
		expect(links[1]?.href).toBe('/en/blog/hello')
	})
})
