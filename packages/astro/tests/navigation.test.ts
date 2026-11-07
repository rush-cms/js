import { isRushError } from '@rushcms/client'
import type { RushRoutes } from '@rushcms/client'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { responseExample } from '../../client/tests/fixtures/contract'
import { COLLECTION_SLUGS } from '../../client/tests/fixtures/slugs'
import { getNavigation } from '../src/index'
import { SITE_PREFIX, apiError, startStubApi } from './fixtures/api'
import type { StubApi } from './fixtures/api'
import {
	ARTICLES,
	GENERIC_ROUTES,
	PREVIEW_TOKEN,
	collectionsOf,
	routeContext,
	rushLocals,
	siteConfig
} from './fixtures/runtime'

let stub: StubApi

function contextFor(routes: RushRoutes, previewToken?: string) {
	const config = siteConfig({
		routes,
		collections: collectionsOf(ARTICLES, COLLECTION_SLUGS),
		memo: false
	})
	return routeContext({
		locals: rushLocals(stub.api, config, previewToken),
		params: { locale: 'en' }
	})
}

beforeAll(async () => {
	stub = await startStubApi()
	stub.handle((request) =>
		request.path === `${SITE_PREFIX}/navigations/main`
			? Response.json(responseExample('NavigationOk'))
			: apiError(404, { error: 'not found', code: 'not_found', params: {} })
	)
})

afterEach(() => {
	stub.requests.length = 0
})

afterAll(() => stub.close())

describe('getNavigation', () => {
	it('fetches the navigation in the route locale and resolves its links', async () => {
		const links = await getNavigation(contextFor(GENERIC_ROUTES), 'main')
		expect(links).toEqual([
			{ label: 'Olá mundo', href: '/artigos/ola-mundo', attributes: {}, children: [] },
			{
				label: 'Contato',
				href: 'https://example.com/contato',
				target: '_blank',
				rel: 'noreferrer noopener',
				attributes: { 'data-track': 'contact' },
				children: []
			}
		])
		expect(stub.requests.map((request) => `${request.path}?${request.query}`)).toEqual([
			`${SITE_PREFIX}/navigations/main?locale=en`
		])
	})

	it('drops the items whose target collection has no route', async () => {
		const links = await getNavigation(contextFor({}), 'main')
		expect(links.map((link) => link.label)).toEqual(['Contato'])
	})

	it('reads drafts with the preview token in a preview session', async () => {
		await getNavigation(contextFor(GENERIC_ROUTES, PREVIEW_TOKEN), 'main')
		expect(stub.requests.map((request) => request.headers.get('authorization'))).toEqual([
			`Bearer ${PREVIEW_TOKEN}`
		])
		expect(stub.requests[0]?.query.get('perspective')).toBe('draft')
	})

	it('throws not_found for an unknown key', async () => {
		const error: unknown = await getNavigation(contextFor(GENERIC_ROUTES), 'missing').then(
			() => undefined,
			(reason: unknown) => reason
		)
		expect(isRushError(error, 'not_found')).toBe(true)
	})
})
