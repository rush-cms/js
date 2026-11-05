import { createClient, createUrls } from '@rushcms/client'
import type { Entry, RushClient } from '@rushcms/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { collectEntryPaths } from '../src/paths'
import { entryExample } from '../../client/tests/fixtures/contract'
import { SITE_PREFIX, startStubApi } from './fixtures/api'
import type { StubApi } from './fixtures/api'

const LOCALE_PATHS = { pt_BR: 'pt', en: 'en', es: 'es' }
const COLLECTION_SLUGS: Record<string, string> = { pt_BR: 'artigos', en: 'blog', es: 'articulos' }
const ROUTE_KEYS = { [entryExample().collection.id]: 'blog' }
const PAGE_META = { total: 1, per_page: 100, current_page: 1, last_page: 1 }

let stub: StubApi

function entryIn(locale: string, slug: string, fallback: boolean): Entry {
	const base = entryExample()
	const collection = { ...base.collection, slug: COLLECTION_SLUGS[locale] ?? 'blog' }
	return { ...base, id: `${locale}-${slug}`, locale, slug, fallback, collection }
}

function served(entriesByLocale: Record<string, Entry[]>): void {
	stub.handle((request) => {
		const locale = request.query.get('locale') ?? ''
		return Response.json({ data: entriesByLocale[locale] ?? [], meta: PAGE_META })
	})
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
			pt_BR: [entryIn('pt_BR', 'ola', false)],
			en: [entryIn('en', 'hello', false)],
			es: [entryIn('es', 'hola', false)]
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
		served({
			pt_BR: [entryIn('pt_BR', 'ola', false)],
			en: [entryIn('pt_BR', 'ola', true)],
			es: []
		})
		const urls = createUrls({
			localePaths: LOCALE_PATHS,
			routes: { blog: '/{locale}/posts/{slug}' },
			routeKeysById: ROUTE_KEYS
		})
		const paths = await collectEntryPaths('blog', clientOf(), urls)
		expect(paths.map((path) => path.params)).toEqual([
			{ locale: 'pt', slug: 'ola' },
			{ locale: 'en', slug: 'ola' }
		])
		expect(paths[1]?.props.entry.fallback).toBe(true)
	})

	it('leaves the locale param undefined for the empty prefix', async () => {
		served({ pt_BR: [entryIn('pt_BR', 'ola', false)], en: [], es: [] })
		const urls = createUrls({
			localePaths: { pt_BR: '', en: 'en', es: 'es' },
			routes: { blog: '/{locale}/blog/{slug}' },
			routeKeysById: ROUTE_KEYS
		})
		const paths = await collectEntryPaths('blog', clientOf(), urls)
		expect(paths.map((path) => path.params)).toEqual([{ locale: undefined, slug: 'ola' }])
	})
})
