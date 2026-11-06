import { createClient, createUrls } from '@rushcms/client'
import type { Entry, RushClient } from '@rushcms/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { collectEntryPaths } from '../src/paths'
import { entryExample } from '../../client/tests/fixtures/contract'
import { SITE_PREFIX, entryListsByLocale, startStubApi } from './fixtures/api'
import type { StubApi } from './fixtures/api'
import { COLLECTION_SLUGS } from '../../client/tests/fixtures/slugs'
import { LOCALE_PATHS, collectionsOf } from './fixtures/runtime'

const COLLECTIONS = collectionsOf(entryExample().collection.id, COLLECTION_SLUGS)

let stub: StubApi

function entryIn(requested: string, served: string, slug: string): Entry {
	const base = entryExample()
	const collection = { ...base.collection, slug: COLLECTION_SLUGS[requested] ?? 'blog' }
	return {
		...base,
		id: `${served}-${slug}`,
		locale: served,
		slug,
		fallback: served !== requested,
		collection
	}
}

function own(locale: string, slug: string): Entry {
	return entryIn(locale, locale, slug)
}

function fallbackInto(requested: string, slug: string): Entry {
	return entryIn(requested, 'pt_BR', slug)
}

function served(entriesByLocale: Record<string, Entry[]>): void {
	stub.handle(entryListsByLocale(entriesByLocale))
}

function clientOf(): RushClient {
	return createClient({ ...stub.api })
}

beforeAll(async () => {
	stub = await startStubApi()
})

afterAll(async () => {
	await stub.close()
})

describe('entryPaths', () => {
	it('covers every locale and derives params from the route pattern', async () => {
		served({
			pt_BR: [own('pt_BR', 'ola')],
			en: [own('en', 'hello')],
			es: [own('es', 'hola')]
		})
		const urls = createUrls({ localePaths: LOCALE_PATHS })
		const paths = await collectEntryPaths('blog', clientOf(), urls)
		expect(paths.map((path) => path.params)).toEqual([
			{ locale: 'pt', collection: 'artigos', slug: 'ola' },
			{ locale: 'en', collection: 'blog', slug: 'hello' },
			{ locale: 'es', collection: 'articulos', slug: 'hola' }
		])
		expect(paths.map((path) => path.props.entry.id)).toEqual([
			'pt_BR-ola',
			'en-hello',
			'es-hola'
		])
		expect(stub.requests.every((request) => request.path.startsWith(SITE_PREFIX))).toBe(true)
	})

	it('also produces pages for fallback entries under the requested locale', async () => {
		served({ pt_BR: [own('pt_BR', 'ola')], en: [fallbackInto('en', 'ola')], es: [] })
		const urls = createUrls({
			localePaths: LOCALE_PATHS,
			routes: { blog: '/{locale}/posts/{slug}' },
			collections: COLLECTIONS
		})
		const paths = await collectEntryPaths('blog', clientOf(), urls)
		expect(paths.map((path) => path.params)).toEqual([
			{ locale: 'pt', slug: 'ola' },
			{ locale: 'en', slug: 'ola' }
		])
		expect(stub.requests.slice(-3).map((request) => request.path)).toEqual(
			['artigos', 'blog', 'articulos'].map(
				(slug) => `${SITE_PREFIX}/collections/${slug}/entries`
			)
		)
		expect(paths[1]?.props.entry.fallback).toBe(true)
	})

	it('gives a fallback page the collection slug of the requested locale', async () => {
		served({ pt_BR: [], en: [fallbackInto('en', 'ola')], es: [fallbackInto('es', 'ola')] })
		const urls = createUrls({ localePaths: LOCALE_PATHS })
		const paths = await collectEntryPaths('blog', clientOf(), urls)
		expect(paths.map((path) => path.params)).toEqual([
			{ locale: 'en', collection: 'blog', slug: 'ola' },
			{ locale: 'es', collection: 'articulos', slug: 'ola' }
		])
	})

	it('keeps the own entry when a fallback page would take the same path', async () => {
		const mine = own('en', 'shared')
		const borrowed = fallbackInto('en', 'shared')
		const urls = createUrls({ localePaths: LOCALE_PATHS })
		for (const order of [
			[borrowed, mine],
			[mine, borrowed]
		]) {
			served({ pt_BR: [], en: order, es: [] })
			const paths = await collectEntryPaths('blog', clientOf(), urls)
			expect(paths).toHaveLength(1)
			expect(paths[0]?.props.entry.id).toBe(mine.id)
		}
	})

	it('leaves the locale param undefined for the empty prefix', async () => {
		served({ pt_BR: [own('pt_BR', 'ola')], en: [], es: [] })
		const urls = createUrls({
			localePaths: { pt_BR: '', en: 'en', es: 'es' },
			routes: { blog: '/{locale}/blog/{slug}' },
			collections: COLLECTIONS
		})
		const paths = await collectEntryPaths('blog', clientOf(), urls)
		expect(paths.map((path) => path.params)).toEqual([{ locale: undefined, slug: 'ola' }])
	})
})
