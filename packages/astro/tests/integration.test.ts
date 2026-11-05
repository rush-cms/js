import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { RushLocalePaths } from '@rushcms/client'
import rush from '../src/index'
import type { RushAstroOptions } from '../src/index'
import { SITE_PREFIX, envelope, siteExample, startStubApi } from './fixtures/api'
import type { StubApi } from './fixtures/api'
import {
	loadVirtualConfig,
	projectWithEnv,
	runRouteSetup,
	runSetup,
	runStartHook
} from './fixtures/astro'
import type { ProjectDir } from './fixtures/astro'

const ARTICLES = '01JC3E28JT97KB6CQ643DZVMXX'
const PAGES = '01JCQKFBF5KZNWJ47TAN9ZT24M'

const COLLECTION_SLUGS: Record<string, Record<string, string>> = {
	en: { [ARTICLES]: 'articles', [PAGES]: 'pages' },
	pt_BR: { [ARTICLES]: 'artigos', [PAGES]: 'paginas' },
	es: { [ARTICLES]: 'articulos', [PAGES]: 'paginas' }
}

const ALL_LOCALES: RushLocalePaths = { pt_BR: '', en: 'en', es: 'es' }

let stub: StubApi
let project: ProjectDir | undefined

function collectionsFor(locale: string): unknown[] {
	return Object.entries(COLLECTION_SLUGS[locale] ?? {}).map(([id, slug]) => ({
		id,
		slug,
		name: slug,
		is_reorderable: false,
		items_per_page: 12,
		created_at: '2026-09-01T10:00:00Z',
		updated_at: '2026-09-01T10:00:00Z'
	}))
}

function apiEnv(extra: Record<string, string> = {}): Record<string, string> {
	return {
		RUSH_API_URL: stub.api.url,
		RUSH_SITE_ID: stub.api.siteId,
		RUSH_API_TOKEN: stub.api.token,
		...extra
	}
}

function useProject(env: Record<string, string>): URL {
	project = projectWithEnv(env)
	return project.root
}

function options(
	localePaths: RushLocalePaths,
	extra: Partial<RushAstroOptions> = {}
): RushAstroOptions {
	return { localePaths, ...extra }
}

beforeAll(async () => {
	stub = await startStubApi()
	stub.handle((request) =>
		request.path === `${SITE_PREFIX}/site`
			? envelope(siteExample())
			: envelope(collectionsFor(request.query.get('locale') ?? ''))
	)
})

afterEach(() => {
	stub.requests.length = 0
	project?.remove()
	project = undefined
})

afterAll(() => stub.close())

describe('astro:config:setup', () => {
	it('registers the astro:env schema', async () => {
		const { updates } = await runSetup(rush(options(ALL_LOCALES)), useProject(apiEnv()))
		expect(updates[0]?.env?.schema).toEqual({
			RUSH_API_URL: { type: 'string', context: 'server', access: 'public', url: true },
			RUSH_SITE_ID: { type: 'string', context: 'server', access: 'public' },
			RUSH_API_TOKEN: { type: 'string', context: 'server', access: 'secret' },
			RUSH_MEDIA_URL: {
				type: 'string',
				context: 'server',
				access: 'public',
				url: true,
				optional: true
			},
			RUSH_PREVIEW: { type: 'boolean', context: 'server', access: 'public', default: false }
		})
	})

	it('registers the media host from RUSH_MEDIA_URL as a remote image host', async () => {
		const root = useProject(apiEnv({ RUSH_MEDIA_URL: 'https://media.example.com/uploads' }))
		const { updates } = await runSetup(rush(options(ALL_LOCALES)), root)
		expect(updates[0]?.image?.remotePatterns).toEqual([
			{ protocol: 'https', hostname: 'media.example.com' }
		])
	})

	it('registers the API host when RUSH_MEDIA_URL is unset', async () => {
		const { updates } = await runSetup(rush(options(ALL_LOCALES)), useProject(apiEnv()))
		const { hostname, port } = new URL(stub.api.url)
		expect(updates[0]?.image?.remotePatterns).toEqual([{ protocol: 'http', hostname, port }])
	})

	it('injects the on-demand forms route and the middleware', async () => {
		const setup = await runSetup(rush(options(ALL_LOCALES)), useProject(apiEnv()))
		expect(setup.routes).toEqual([
			{
				pattern: '/_rush/forms/[key]',
				entrypoint: '@rushcms/astro/routes/forms',
				prerender: false
			}
		])
		expect(setup.middlewares).toEqual([
			{ order: 'pre', entrypoint: '@rushcms/astro/middleware' }
		])
		expect(stub.requests).toEqual([])
	})

	it('rejects invalid url options before touching the API', async () => {
		const integration = rush(options({ pt_BR: '', en: '' }))
		await expect(runSetup(integration, useProject(apiEnv()))).rejects.toThrow(
			'more than one empty prefix'
		)
	})
})

describe('site check at build and dev start', () => {
	it('fails the build when localePaths misses a site locale, listing both sets', async () => {
		const integration = rush(options({ pt_BR: '', en: 'en' }))
		await runSetup(integration, useProject(apiEnv()))
		await expect(runStartHook(integration, 'astro:build:start')).rejects.toThrow(
			'localePaths locales [pt_BR, en] differ from the site locales [en, pt_BR, es]'
		)
	})

	it('fails the dev server when localePaths has a locale the site does not serve', async () => {
		const integration = rush(options({ pt_BR: '', en: 'en', fr: 'fr' }))
		await runSetup(integration, useProject(apiEnv()), 'dev')
		await expect(runStartHook(integration, 'astro:server:setup')).rejects.toThrow(
			'localePaths locales [pt_BR, en, fr] differ from the site locales [en, pt_BR, es]'
		)
	})

	it('fails when an API variable is missing', async () => {
		const integration = rush(options(ALL_LOCALES))
		const root = useProject({ RUSH_API_URL: stub.api.url, RUSH_SITE_ID: stub.api.siteId })
		await runSetup(integration, root)
		await expect(runStartHook(integration, 'astro:build:start')).rejects.toThrow(
			'missing environment variables: RUSH_API_TOKEN'
		)
		expect(stub.requests).toEqual([])
	})

	it('accepts the same locale set in any order and serves the site config', async () => {
		const integration = rush(
			options(ALL_LOCALES, {
				routes: { artigos: '/{locale}/blog/{slug}', pages: '/{locale}/{slug}' },
				seo: { artigos: { description: 'summary' } }
			})
		)
		const { plugin } = await runSetup(integration, useProject(apiEnv()))
		await runStartHook(integration, 'astro:build:start')
		const config = await loadVirtualConfig(plugin)
		expect(config).toEqual({
			routes: { artigos: '/{locale}/blog/{slug}', pages: '/{locale}/{slug}' },
			localePaths: ALL_LOCALES,
			routeKeysById: { [ARTICLES]: 'artigos', [PAGES]: 'pages' },
			defaultLocale: 'en',
			seo: { artigos: { description: 'summary' } },
			memo: true,
			preview: false
		})
		expect(stub.requests.map((request) => `${request.path}?${request.query}`).sort()).toEqual([
			`${SITE_PREFIX}/collections?locale=en`,
			`${SITE_PREFIX}/collections?locale=es`,
			`${SITE_PREFIX}/collections?locale=pt_BR`,
			`${SITE_PREFIX}/site?`
		])
		expect(
			new Set(stub.requests.map((request) => request.headers.get('authorization')))
		).toEqual(new Set([`Bearer ${stub.api.token}`]))
	})

	it('turns the static memo off in dev', async () => {
		const integration = rush(options(ALL_LOCALES))
		const { plugin } = await runSetup(integration, useProject(apiEnv()), 'dev')
		await runStartHook(integration, 'astro:server:setup')
		expect((await loadVirtualConfig(plugin)).memo).toBe(false)
	})
})

describe('preview deployment mode', () => {
	const PAGE = 'src/pages/index.astro'
	const PREVIEW_ROUTE = {
		pattern: '/_rush/preview',
		entrypoint: '@rushcms/astro/routes/preview',
		prerender: false
	}
	const EXIT_ROUTE = {
		pattern: '/_rush/preview/exit',
		entrypoint: '@rushcms/astro/routes/preview-exit',
		prerender: false
	}

	it.each([
		['true', true, false],
		['true', false, false],
		['true', undefined, false],
		['false', true, true],
		['false', false, false],
		['false', undefined, undefined]
	])(
		'with RUSH_PREVIEW=%s turns a route with prerender %s into prerender %s',
		async (flag, prerender, expected) => {
			const integration = rush(options(ALL_LOCALES))
			await runSetup(integration, useProject(apiEnv({ RUSH_PREVIEW: flag })))
			const route = { component: PAGE, ...(prerender === undefined ? {} : { prerender }) }
			await runRouteSetup(integration, route)
			expect(route.prerender).toBe(expected)
		}
	)

	it('injects the preview routes only in preview mode', async () => {
		const preview = await runSetup(
			rush(options(ALL_LOCALES)),
			useProject(apiEnv({ RUSH_PREVIEW: 'true' }))
		)
		expect(preview.routes.slice(1)).toEqual([PREVIEW_ROUTE, EXIT_ROUTE])
		project?.remove()
		const production = await runSetup(rush(options(ALL_LOCALES)), useProject(apiEnv()))
		expect(production.routes.map((route) => route.pattern)).toEqual(['/_rush/forms/[key]'])
	})

	it('marks the site config of a preview build', async () => {
		const integration = rush(options(ALL_LOCALES))
		const { plugin } = await runSetup(integration, useProject(apiEnv({ RUSH_PREVIEW: 'true' })))
		await runStartHook(integration, 'astro:build:start')
		expect((await loadVirtualConfig(plugin)).preview).toBe(true)
	})
})
