import { describe, expect, it } from 'vitest'
import type { EtagRecord, EtagStore, RushClient } from '../src/index'
import { responseExample } from './fixtures/contract'
import { deferred, header, jsonResponse, rejection, testClient } from './fixtures/fetch'
import type { FetchHandler } from './fixtures/fetch'

type MemoryEtagStore = EtagStore & {
	records: Map<string, EtagRecord>
}

function memoryEtagStore(): MemoryEtagStore {
	const records = new Map<string, EtagRecord>()
	return {
		records,
		get: (key) => Promise.resolve(records.get(key)),
		set: (key, value) => {
			records.set(key, value)
			return Promise.resolve()
		}
	}
}

type CorruptRecordCase = {
	name: string
	example: string
	record: EtagRecord
	call: (client: RushClient) => Promise<unknown>
}

const ETAG = '"9f86d081884c7d659a2feaa0c55ad015"'

function revalidating(example: unknown): FetchHandler {
	return (call) =>
		header(call, 'If-None-Match') === ETAG
			? new Response(null, { status: 304, headers: { ETag: ETAG } })
			: jsonResponse(example, 200, { ETag: ETAG })
}

const corruptRecords: CorruptRecordCase[] = [
	{
		name: 'a record without body',
		example: 'SiteOk',
		record: { etag: ETAG, body: undefined },
		call: (client) => client.site.get()
	},
	{
		name: 'a non-envelope body',
		example: 'SiteOk',
		record: { etag: ETAG, body: { items: [] } },
		call: (client) => client.site.get()
	},
	{
		name: 'a page body without meta',
		example: 'EntryPageOk',
		record: { etag: ETAG, body: { data: [] } },
		call: (client) => client.entries.list('blog')
	}
]

describe('request reuse', () => {
	it('deduplicates identical in-flight GETs', async () => {
		const gate = deferred<Response>()
		const { client, calls } = testClient(() => gate.promise)

		const first = client.site.get()
		const second = client.site.get()
		gate.resolve(jsonResponse(responseExample('SiteOk')))
		const [a, b] = await Promise.all([first, second])

		expect(calls).toHaveLength(1)
		expect(a).toBe(b)
	})

	it('keeps requests that differ in url or perspective apart', async () => {
		const gate = deferred<void>()
		const { client, calls } = testClient(async () => {
			await gate.promise
			return jsonResponse(responseExample('EntryOk'))
		})

		const pending = Promise.all([
			client.entries.get('blog', 'ola-mundo'),
			client.entries.get('blog', 'ola-mundo', { perspective: 'draft' }),
			client.entries.get('blog', 'ola-mundo', { locale: 'en' })
		])
		gate.resolve()
		await pending

		expect(calls).toHaveLength(3)
	})

	it('does not memoize settled GETs by default', async () => {
		const { client, calls } = testClient(() => jsonResponse(responseExample('SiteOk')))

		await client.site.get()
		await client.site.get()

		expect(calls).toHaveLength(2)
	})

	it('memoizes settled GETs when memo is enabled', async () => {
		const { client, calls } = testClient(() => jsonResponse(responseExample('SiteOk')), {
			memo: true
		})

		const first = await client.site.get()
		const second = await client.site.get()

		expect(calls).toHaveLength(1)
		expect(second).toBe(first)
	})

	it('never memoizes failures', async () => {
		const { client, calls } = testClient(
			() => jsonResponse(responseExample('Forbidden'), 403),
			{
				memo: true
			}
		)

		await rejection(client.site.get())
		await rejection(client.site.get())

		expect(calls).toHaveLength(2)
	})

	it('never deduplicates form submissions', async () => {
		const { client, calls } = testClient(
			() => jsonResponse(responseExample('FormSubmitted'), 201),
			{
				memo: true
			}
		)

		await client.forms.submit('contact', { name: 'Ana' })
		await client.forms.submit('contact', { name: 'Ana' })

		expect(calls).toHaveLength(2)
	})

	it('revalidates with the etag store and returns the stored body on 304', async () => {
		const etagStore = memoryEtagStore()
		const example = responseExample('SiteOk') as Record<string, unknown>
		const { client, calls } = testClient(revalidating(example), { etagStore })

		const fresh = await client.site.get()
		const revalidated = await client.site.get()

		expect(calls.map((call) => header(call, 'If-None-Match'))).toEqual([null, ETAG])
		expect(revalidated).toEqual(example.data)
		expect(revalidated).toEqual(fresh)
		expect([...etagStore.records.values()]).toEqual([{ etag: ETAG, body: example }])
		expect([...etagStore.records.keys()].join()).not.toContain('delivery-token')
	})

	it('stores nothing without an ETag header', async () => {
		const etagStore = memoryEtagStore()
		const { client } = testClient(() => jsonResponse(responseExample('SiteOk')), { etagStore })

		await client.site.get()

		expect(etagStore.records.size).toBe(0)
	})

	it.each(corruptRecords)(
		'treats $name in the etag store as a miss and refetches',
		async ({ example, record, call }) => {
			const etagStore = memoryEtagStore()
			const body = responseExample(example)
			const { client, calls } = testClient(revalidating(body), { etagStore })
			const fresh = await call(client)
			for (const key of etagStore.records.keys()) {
				etagStore.records.set(key, record)
			}

			const refetched = await call(client)

			expect(calls.map((item) => header(item, 'If-None-Match'))).toEqual([null, null])
			expect(refetched).toEqual(fresh)
			expect([...etagStore.records.values()]).toEqual([{ etag: ETAG, body }])
		}
	)

	it('keeps memoized results of different perspectives apart', async () => {
		const { client, calls } = testClient(() => jsonResponse(responseExample('SiteOk')), {
			memo: true
		})

		await client.site.get()
		await client.site.get({ perspective: 'draft' })
		await client.site.get()
		await client.site.get({ perspective: 'draft' })

		expect(calls.map((call) => call.url.searchParams.get('perspective'))).toEqual([
			null,
			'draft'
		])
	})

	it('never shares etag store keys between tokens', async () => {
		const etagStore = memoryEtagStore()
		const handler = revalidating(responseExample('SiteOk'))
		const first = testClient(handler, { etagStore, token: 'token-a' })
		const second = testClient(handler, { etagStore, token: 'token-b' })

		await first.client.site.get()
		await second.client.site.get()

		expect(
			second.calls.map((call) => [
				header(call, 'Authorization'),
				header(call, 'If-None-Match')
			])
		).toEqual([['Bearer token-b', null]])
		expect(etagStore.records.size).toBe(2)
	})
})
