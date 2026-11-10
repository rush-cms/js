import { describe, expect, it } from 'vitest'
import type { RushClient } from '../src/index'
import { isRecord } from '../src/json'
import { operationFixture, responseExample } from './fixtures/contract'
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
	operation: string
}

function resource(
	name: string,
	call: ResourceCase['call'],
	path: string,
	operation: string
): ResourceCase {
	return { name, call, path, operation }
}

const cases: ResourceCase[] = [
	resource('site.get', (c) => c.site.get(), '/site', 'getSite'),
	resource('homepage.get', (c) => c.homepage.get(), '/homepage', 'getHomepage'),
	resource('collections.list', (c) => c.collections.list(), '/collections', 'listCollections'),
	resource(
		'collections.get',
		(c) => c.collections.get('blog'),
		'/collections/blog',
		'getCollection'
	),
	resource(
		'entries.list',
		(c) => c.entries.list('blog', { page: 2 }),
		'/collections/blog/entries',
		'listEntries'
	),
	resource(
		'entries.get',
		(c) => c.entries.get('blog', 'ola-mundo'),
		'/collections/blog/entries/ola-mundo',
		'getEntry'
	),
	resource(
		'entries.search',
		(c) => c.entries.search('blog', 'hello world'),
		'/collections/blog/search',
		'searchEntries'
	),
	resource('tags.list', (c) => c.tags.list({ type: 'category' }), '/tags', 'listTags'),
	resource('tags.entries', (c) => c.tags.entries('news'), '/tags/news/entries', 'listTagEntries'),
	resource('navigations.list', (c) => c.navigations.list(), '/navigations', 'listNavigations'),
	resource(
		'navigations.get',
		(c) => c.navigations.get('main'),
		'/navigations/main',
		'getNavigation'
	),
	resource(
		'siteOptions.list',
		(c) => c.siteOptions.list(),
		'/site-options',
		'listSiteOptionGroups'
	),
	resource(
		'siteOptions.get',
		(c) => c.siteOptions.get('branding'),
		'/site-options/branding',
		'getSiteOptionGroup'
	),
	resource('blocks.list', (c) => c.blocks.list(), '/blocks', 'listBlocks'),
	resource(
		'blocks.get',
		(c) => c.blocks.get('call-to-action'),
		'/blocks/call-to-action',
		'getBlock'
	),
	resource('databases.list', (c) => c.databases.list(), '/databases', 'listDatabases'),
	resource(
		'databases.get',
		(c) => c.databases.get('servicos'),
		'/databases/servicos',
		'getDatabase'
	),
	resource('linkPages.list', (c) => c.linkPages.list(), '/link-pages', 'listLinkPages'),
	resource('linkPages.get', (c) => c.linkPages.get('links'), '/link-pages/links', 'getLinkPage'),
	resource('forms.list', (c) => c.forms.list(), '/forms', 'listForms'),
	resource('forms.get', (c) => c.forms.get('contact'), '/forms/contact', 'getForm')
]

function expectedResult(example: unknown): unknown {
	if (!isRecord(example)) {
		throw new Error('example is not an envelope')
	}
	return 'meta' in example ? { items: example.data, meta: example.meta } : example.data
}

function templatePattern(path: string): RegExp {
	return new RegExp(`^${path.replace(/\{[^}]+\}/g, '[^/]+')}$`)
}

describe('resources', () => {
	it.each(cases)('$name requests its operation and unwraps the envelope', async (item) => {
		const operation = operationFixture(item.operation)
		const { client, calls } = testClient(() => jsonResponse(operation.okExample), {
			locale: 'pt_BR',
			perspective: 'published'
		})

		const result = await item.call(client)

		expect(result).toEqual(expectedResult(operation.okExample))
		expect(calls).toHaveLength(1)
		const [call] = calls
		expect(call?.init.method).toBe('GET')
		expect(call && apiPath(call)).toBe(item.path)
		expect(call?.url.pathname).toMatch(templatePattern(operation.path))
		expect(call?.url.searchParams.get('perspective')).toBe('published')
		expect(call?.url.searchParams.get('locale')).toBe(
			operation.parameters.includes('locale') ? 'pt_BR' : null
		)
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

	it('sends the taxonomy type of a tag entries listing', async () => {
		const { client, calls } = testClient(() => jsonResponse(responseExample('EntryPageOk')))

		await client.tags.entries('design', { type: 'category', page: 2 })

		expect(calls[0]?.url.search).toBe('?page=2&type=category')
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
