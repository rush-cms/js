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

function localsFor(routes: RushRoutes, previewToken?: string): object {
	const config = siteConfig({
		routes,
		collections: collectionsOf(ARTICLES, COLLECTION_SLUGS),
		memo: false
	})
	return rushLocals(stub.api, config, previewToken)
}

function contextFor(routes: RushRoutes, previewToken?: string) {
	return routeContext({ locals: localsFor(routes, previewToken), params: { locale: 'en' } })
}

function requestedLocales(): (string | null)[] {
	return stub.requests.map((request) => request.query.get('locale'))
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

	it('takes the locale from the request path on a dispatcher route', async () => {
		const locals = localsFor(GENERIC_ROUTES)
		await getNavigation(routeContext({ locals, path: '/en/blog' }), 'main')
		await getNavigation(routeContext({ locals, path: '/artigos' }), 'main')
		expect(requestedLocales()).toEqual(['en', 'pt_BR'])
	})

	it('takes the locale from the request path on a 404 page', async () => {
		const locals = localsFor(GENERIC_ROUTES)
		for (const pathname of ['/en/no/such/page', '/es/x', '/xx/contact', '/EN/blog']) {
			await getNavigation(routeContext({ locals, path: pathname }), 'main')
		}
		expect(requestedLocales()).toEqual(['en', 'es', 'pt_BR', 'pt_BR'])
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
