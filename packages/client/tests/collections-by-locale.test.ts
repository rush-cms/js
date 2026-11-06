import { describe, expect, it } from 'vitest'
import { listCollectionsByLocale } from '../src/index'
import { jsonResponse, testClient } from './fixtures/fetch'
import type { FetchCall } from './fixtures/fetch'

const SLUGS: Record<string, string> = { pt_BR: 'artigos', en: 'blog' }

function collectionsFor(call: FetchCall) {
	const slug = SLUGS[call.url.searchParams.get('locale') ?? '']
	return jsonResponse({ data: [{ id: 'c1', slug, name: 'extra', extra: true }] })
}

describe('listCollectionsByLocale', () => {
	it('lists the collections of every locale as id and slug refs', async () => {
		const { client, calls } = testClient(collectionsFor)

		const collections = await listCollectionsByLocale(client, ['pt_BR', 'en'])

		expect(collections).toEqual({
			pt_BR: [{ id: 'c1', slug: 'artigos' }],
			en: [{ id: 'c1', slug: 'blog' }]
		})
		expect(calls.map((call) => call.url.searchParams.get('locale'))).toEqual(['pt_BR', 'en'])
	})

	it('gives an empty record without locales', async () => {
		const { client, calls } = testClient(collectionsFor)

		expect(await listCollectionsByLocale(client, [])).toEqual({})
		expect(calls).toHaveLength(0)
	})
})
