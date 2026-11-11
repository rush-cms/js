import { fileURLToPath } from 'node:url'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { AstroIntegration } from 'astro'
import type { RushLocalePaths, RushTaxonomies } from '@rushcms/client'
import type { SiteLocales } from '@rushcms/client/internal'
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
import type { RushSiteConfig } from '../src/config'
import { installedPackage } from '../../../scripts/installed-package'
import { ARTICLES } from './fixtures/runtime'

const COLD_IMPORT_TIMEOUT_MS = 60_000

const MANIFEST_PATH = fileURLToPath(new URL('../package.json', import.meta.url))

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
	return { localePaths, trustedProxies: 0, ...extra }
}

function untypedOptions(localePaths: RushLocalePaths, trustedProxies: unknown): RushAstroOptions {
	const fields: object =
		trustedProxies === undefined ? { localePaths } : { localePaths, trustedProxies }
	return fields as RushAstroOptions
}

async function preloadSetupDependencies(): Promise<void> {
	await Promise.all([import('astro/config'), import('vite')])
}

function serveSite(site: Partial<SiteLocales> = {}): void {
	stub.handle((request) =>
		request.path === `${SITE_PREFIX}/site`
			? envelope({ ...siteExample(), ...site })
			: envelope(collectionsFor(request.query.get('locale') ?? ''))
	)
}

async function builtConfig(
	integration: AstroIntegration,
	env: Record<string, string> = {}
): Promise<RushSiteConfig> {
	const { plugin } = await runSetup(integration, useProject(apiEnv(env)))
	await runStartHook(integration, 'astro:build:start')
	return loadVirtualConfig(plugin)
}

beforeAll(async () => {
	await preloadSetupDependencies()
	stub = await startStubApi()
}, COLD_IMPORT_TIMEOUT_MS)

beforeEach(() => {
	serveSite()
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

	it('injects entrypoints that an installed copy resolves through require.resolve', async () => {
		const setup = await runSetup(
			rush(options(ALL_LOCALES)),
			useProject(apiEnv({ RUSH_PREVIEW: 'true' }))
		)
		const installed = installedPackage(MANIFEST_PATH)
		try {
			const entrypoints = [...setup.routes, ...setup.middlewares].map(
				(injected) => injected.entrypoint
			)
			expect(entrypoints.map((entrypoint) => installed.resolve(String(entrypoint)))).toEqual([
				'dist/routes/forms.js',
				'dist/routes/preview.js',
				'dist/routes/preview-exit.js',
				'dist/middleware.js'
			])
		} finally {
			installed.remove()
		}
	})

	it('rejects invalid url options before touching the API', async () => {
		const integration = rush(options({ pt_BR: '', en: '' }))
		await expect(runSetup(integration, useProject(apiEnv()))).rejects.toThrow(
			'more than one empty prefix'
		)
	})
})

describe('trustedProxies', () => {
	it.each([undefined, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '1'])(
		'rejects %j at config setup, naming both topologies, before touching the API',
		async (trustedProxies) => {
			const integration = rush(untypedOptions(ALL_LOCALES, trustedProxies))
			const setup = runSetup(integration, useProject(apiEnv()))
			await expect(setup).rejects.toThrow(
				`trustedProxies is required and must be a non-negative integer, got ${String(trustedProxies)}.`
			)
			await expect(setup).rejects.toThrow(
				'0 when visitors reach the Astro Node server directly'
			)
			await expect(setup).rejects.toThrow(
				'n reverse proxies that each append to X-Forwarded-For'
			)
			expect(stub.requests).toEqual([])
		}
	)

	it('carries the hop count into the site config', async () => {
		const integration = rush(options(ALL_LOCALES, { trustedProxies: 2 }))
		expect((await builtConfig(integration)).trustedProxies).toBe(2)
	})
})

describe('site check at build and dev start', () => {
	it('fails the build when localePaths misses a site locale, listing both sets', async () => {
		const integration = rush(options({ pt_BR: '', en: 'en' }))
		await expect(builtConfig(integration)).rejects.toThrow(
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

	it('prints a paste-ready localePaths suggestion when the locales differ', async () => {
		serveSite({ default_locale: 'pt_BR', locales: ['pt_BR', 'en', 'es'] })
		await expect(builtConfig(rush(options({})))).rejects.toThrow(
			new Error(
				"@rushcms/astro: localePaths locales [] differ from the site locales [pt_BR, en, es]. Set in astro.config:\n  localePaths: { pt_BR: '', en: 'en', es: 'es' }"
			)
		)
	})

	it('quotes only the suggested keys that are not identifiers', async () => {
		serveSite({ default_locale: 'en', locales: ['en', 'pt-BR', 'pt-PT', 'es_419'] })
		await expect(builtConfig(rush(options({ en: '' })))).rejects.toThrow(
			new Error(
				"@rushcms/astro: localePaths locales [en] differ from the site locales [en, pt-BR, pt-PT, es_419]. Set in astro.config:\n  localePaths: { en: '', 'pt-BR': 'pt-br', 'pt-PT': 'pt-pt', es_419: 'es' }"
			)
		)
	})

	it('fails the build when a route key matches no site collection', async () => {
		const routes = { artigos: '/{locale}/blog/{slug}', artcles: '/{locale}/a/{slug}' }
		await expect(builtConfig(rush(options(ALL_LOCALES, { routes })))).rejects.toThrow(
			new Error('route "artcles" matches no collection')
		)
	})

	it('rejects invalid page segments before touching the API', async () => {
		const integration = rush(options(ALL_LOCALES, { pageSegments: { en: '' } }))
		await expect(runSetup(integration, useProject(apiEnv()))).rejects.toThrow(
			'pageSegments segment for "en" must not be empty'
		)
		expect(stub.requests).toEqual([])
	})

	it.each([
		[
			{ pt_BR: 'categoria', en: 'a/b', es: 'categoria' },
			'segment for "en" must not contain "/"'
		],
		[{ pt_BR: '', en: 'category', es: 'categoria' }, 'segment for "pt_BR" must not be empty'],
		[{ pt_BR: 'categoria', en: 'category' }, 'has no segment for locale "es"']
	])('rejects the taxonomy segments %j before touching the API', async (category, message) => {
		const integration = rush(options(ALL_LOCALES, { taxonomies: { category } }))
		await expect(runSetup(integration, useProject(apiEnv()))).rejects.toThrow(
			`taxonomies.category ${message}`
		)
		expect(stub.requests).toEqual([])
	})

	it('fails the build when a taxonomy segment produces the URLs of a collection route', async () => {
		const routes = { artigos: '/{locale}/blog/{slug}' }
		const taxonomies = { tag: { pt_BR: 'blog', en: 'blog', es: 'blog' } }
		await expect(
			builtConfig(rush(options(ALL_LOCALES, { routes, taxonomies })))
		).rejects.toThrow(new Error('routes "artigos" and "taxonomies.tag" produce the same URLs'))
	})

	it('carries the taxonomies into the site config', async () => {
		const taxonomies: RushTaxonomies = {
			category: { pt_BR: 'categoria', en: 'category', es: 'categoria' }
		}
		expect((await builtConfig(rush(options(ALL_LOCALES, { taxonomies })))).taxonomies).toEqual(
			taxonomies
		)
	})

	it('carries the page segments into the site config', async () => {
		const integration = rush(options(ALL_LOCALES, { pageSegments: { pt_BR: 'pagina' } }))
		expect((await builtConfig(integration)).pageSegments).toEqual({ pt_BR: 'pagina' })
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
		expect(await builtConfig(integration)).toEqual({
			routes: { artigos: '/{locale}/blog/{slug}', pages: '/{locale}/{slug}' },
			localePaths: ALL_LOCALES,
			collections: {
				en: [
					{ id: ARTICLES, slug: 'articles' },
					{ id: PAGES, slug: 'pages' }
				],
				pt_BR: [
					{ id: ARTICLES, slug: 'artigos' },
					{ id: PAGES, slug: 'paginas' }
				],
				es: [
					{ id: ARTICLES, slug: 'articulos' },
					{ id: PAGES, slug: 'paginas' }
				]
			},
			pageSegments: {},
			taxonomies: {},
			defaultLocale: 'en',
			seo: { artigos: { description: 'summary' } },
			memo: true,
			preview: false,
			trustedProxies: 0
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

	it('injects no forms route with forms: false and keeps the middleware', async () => {
		const setup = await runSetup(
			rush(options(ALL_LOCALES, { forms: false })),
			useProject(apiEnv())
		)
		expect(setup.routes).toEqual([])
		expect(setup.middlewares).toEqual([
			{ order: 'pre', entrypoint: '@rushcms/astro/middleware' }
		])
	})

	it('injects the forms route with forms: true', async () => {
		const setup = await runSetup(
			rush(options(ALL_LOCALES, { forms: true })),
			useProject(apiEnv())
		)
		expect(setup.routes.map((route) => route.pattern)).toEqual(['/_rush/forms/[key]'])
	})

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
		expect((await builtConfig(integration, { RUSH_PREVIEW: 'true' })).preview).toBe(true)
	})
})
