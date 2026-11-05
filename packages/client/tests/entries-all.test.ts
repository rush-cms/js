import { describe, expect, it } from 'vitest'
import type { Entry, PaginationMeta, components } from '../src/index'
import { responseExample } from './fixtures/contract'
import { jsonResponse, testClient } from './fixtures/fetch'
import type { FetchCall, FetchHandler } from './fixtures/fetch'

type PageScript = {
	count: number
	meta: PaginationMeta
}

const template = (responseExample('EntryOk') as components['schemas']['EntryEnvelope']).data

function entriesOf(page: number, count: number): Entry[] {
	return Array.from({ length: count }, (_, index) => ({ ...template, id: `${page}-${index}` }))
}

function scripted(pages: PageScript[]): FetchHandler {
	return (call: FetchCall) => {
		const page = Number(call.url.searchParams.get('page'))
		const script = pages[page - 1]
		if (!script) {
			return jsonResponse(responseExample('NotFound'), 404)
		}
		return jsonResponse({ data: entriesOf(page, script.count), meta: script.meta })
	}
}

async function collect(iterator: AsyncIterable<Entry>): Promise<string[]> {
	const ids: string[] = []
	for await (const entry of iterator) {
		ids.push(entry.id)
	}
	return ids
}

function meta(total: number, current: number, last: number): PaginationMeta {
	return { total, per_page: 100, current_page: current, last_page: last }
}

describe('entries.all', () => {
	it('walks every page with per_page 100 and yields entries in order', async () => {
		const { client, calls } = testClient(
			scripted([
				{ count: 100, meta: meta(230, 1, 3) },
				{ count: 100, meta: meta(230, 2, 3) },
				{ count: 30, meta: meta(230, 3, 3) }
			]),
			{ locale: 'pt_BR' }
		)

		const ids = await collect(client.entries.all('blog', { perspective: 'draft' }))

		expect(ids).toEqual(
			[...entriesOf(1, 100), ...entriesOf(2, 100), ...entriesOf(3, 30)].map((e) => e.id)
		)
		expect(calls.map((call) => call.url.search)).toEqual([
			'?locale=pt_BR&page=1&per_page=100&perspective=draft',
			'?locale=pt_BR&page=2&per_page=100&perspective=draft',
			'?locale=pt_BR&page=3&per_page=100&perspective=draft'
		])
	})

	it('stops at the first response last_page even when the total grows mid-walk', async () => {
		const { client, calls } = testClient(
			scripted([
				{ count: 100, meta: meta(150, 1, 2) },
				{ count: 50, meta: meta(250, 2, 3) },
				{ count: 100, meta: meta(250, 3, 3) }
			])
		)

		const ids = await collect(client.entries.all('blog'))

		expect(ids).toHaveLength(150)
		expect(calls).toHaveLength(2)
	})

	it('requests a single page when the collection fits in one', async () => {
		const { client, calls } = testClient(scripted([{ count: 0, meta: meta(0, 1, 1) }]))

		expect(await collect(client.entries.all('blog'))).toEqual([])
		expect(calls).toHaveLength(1)
	})
})
