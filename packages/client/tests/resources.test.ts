import { describe, expect, it } from 'vitest'
import type { RushClient } from '../src/index'
import { responseExample } from './fixtures/contract'
import {
	API_URL,
	SITE_ID,
	TOKEN,
	apiPath,
	header,
	jsonResponse,
	testClient
} from './fixtures/fetch'

type ResourceCase = {
	name: string
	call: (client: RushClient) => Promise<unknown>
	path: string
	example: string
	localized: boolean
	paginated: boolean
}

function resource(
	name: string,
	call: ResourceCase['call'],
	path: string,
	example: string,
	localized = true,
	paginated = false
): ResourceCase {
	return { name, call, path, example, localized, paginated }
}

const cases: ResourceCase[] = [
	resource('site.get', (c) => c.site.get(), '/site', 'SiteOk', false),
	resource('homepage.get', (c) => c.homepage.get(), '/homepage', 'HomepageOk'),
	resource('collections.list', (c) => c.collections.list(), '/collections', 'CollectionListOk'),
	resource(
		'collections.get',
		(c) => c.collections.get('blog'),
		'/collections/blog',
		'CollectionOk'
	),
	resource(
		'entries.list',
		(c) => c.entries.list('blog', { page: 2 }),
		'/collections/blog/entries',
		'EntryPageOk',
		true,
		true
	),
	resource(
		'entries.get',
		(c) => c.entries.get('blog', 'ola-mundo'),
		'/collections/blog/entries/ola-mundo',
		'EntryOk'
	),
	resource(
		'entries.search',
		(c) => c.entries.search('blog', 'hello world'),
		'/collections/blog/search',
		'EntryPageOk',
		true,
		true
	),
	resource('tags.list', (c) => c.tags.list({ type: 'category' }), '/tags', 'TagListOk'),
	resource(
		'tags.entries',
		(c) => c.tags.entries('news'),
		'/tags/news/entries',
		'EntryPageOk',
		true,
		true
	),
	resource('navigations.list', (c) => c.navigations.list(), '/navigations', 'NavigationListOk'),
	resource(
		'navigations.get',
		(c) => c.navigations.get('main'),
		'/navigations/main',
		'NavigationOk'
	),
	resource(
		'siteOptions.list',
		(c) => c.siteOptions.list(),
		'/site-options',
		'SiteOptionGroupListOk'
	),
	resource(
		'siteOptions.get',
		(c) => c.siteOptions.get('branding'),
		'/site-options/branding',
		'SiteOptionGroupOk'
	),
	resource('blocks.list', (c) => c.blocks.list(), '/blocks', 'BlockListOk', false),
	resource(
		'blocks.get',
		(c) => c.blocks.get('call-to-action'),
		'/blocks/call-to-action',
		'BlockOk',
		false
	),
	resource('databases.list', (c) => c.databases.list(), '/databases', 'DatabaseListOk'),
	resource(
		'databases.get',
		(c) => c.databases.get('servicos'),
		'/databases/servicos',
		'DatabaseOk'
	),
	resource('linkPages.list', (c) => c.linkPages.list(), '/link-pages', 'LinkPageListOk', false),
	resource(
		'linkPages.get',
		(c) => c.linkPages.get('links'),
		'/link-pages/links',
		'LinkPageOk',
		false
	),
	resource('forms.list', (c) => c.forms.list(), '/forms', 'FormListOk'),
	resource('forms.get', (c) => c.forms.get('contact'), '/forms/contact', 'FormOk')
]

function expectedResult(example: unknown, paginated: boolean): unknown {
	const body = example as Record<string, unknown>
	return paginated ? { items: body.data, meta: body.meta } : body.data
}

describe('resources', () => {
	it.each(cases)('$name requests its path and unwraps the envelope', async (item) => {
		const example = responseExample(item.example)
		const { client, calls } = testClient(() => jsonResponse(example), {
			locale: 'pt_BR',
			perspective: 'published'
		})

		const result = await item.call(client)

		expect(result).toEqual(expectedResult(example, item.paginated))
		expect(calls).toHaveLength(1)
		const [call] = calls
		expect(call?.init.method).toBe('GET')
		expect(call && apiPath(call)).toBe(item.path)
		expect(call?.url.searchParams.get('perspective')).toBe('published')
		expect(call?.url.searchParams.get('locale')).toBe(item.localized ? 'pt_BR' : null)
	})

	it('sends the bearer token to the site path of the configured url', async () => {
		const { client, calls } = testClient(() => jsonResponse(responseExample('SiteOk')))

		await client.site.get()

		const [call] = calls
		expect(call?.url.origin).toBe(API_URL)
		expect(call?.url.pathname).toBe(`/api/v1/${SITE_ID}/site`)
		expect(call && header(call, 'Authorization')).toBe(`Bearer ${TOKEN}`)
		expect(call && header(call, 'Accept')).toBe('application/json')
		expect(call?.url.search).toBe('')
	})

	it('lets each call override the client locale and perspective', async () => {
		const { client, calls } = testClient(() => jsonResponse(responseExample('EntryOk')), {
			locale: 'en',
			perspective: 'published'
		})

		await client.entries.get('blog', 'hello-world')
		await client.entries.get('blog', 'ola-mundo', { locale: 'pt_BR', perspective: 'draft' })

		expect(calls.map((call) => call.url.search)).toEqual([
			'?locale=en&perspective=published',
			'?locale=pt_BR&perspective=draft'
		])
	})

	it('sends the search text and paging as query parameters', async () => {
		const { client, calls } = testClient(() => jsonResponse(responseExample('EntryPageOk')))

		await client.entries.search('blog', 'hello world', { per_page: 5, page: 3 })

		expect(calls[0]?.url.search).toBe('?page=3&per_page=5&q=hello+world')
	})

	it('encodes path segments', async () => {
		const { client, calls } = testClient(() => jsonResponse(responseExample('EntryOk')))

		await client.entries.get('blog posts', 'a/b')

		expect(calls[0] && apiPath(calls[0])).toBe('/collections/blog%20posts/entries/a%2Fb')
	})

	it('keeps routes and locale paths for the url helpers', () => {
		const routes = { blog: '/{locale}/blog/{slug}' }
		const localePaths = { en: '', pt_BR: 'pt' }
		const { client } = testClient(() => jsonResponse({}), { routes, localePaths })

		expect(client.routes).toEqual(routes)
		expect(client.localePaths).toEqual(localePaths)
		expect(testClient(() => jsonResponse({})).client.routes).toEqual({})
	})
})
