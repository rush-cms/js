import type { CollectionRef, RouteParams, RushCollections, RushRoutes } from '@rushcms/client'
import type { AstroRuntimeLogger } from 'astro'
import { entryExample } from '../../../client/tests/fixtures/contract'
import { COLLECTION_SLUGS } from '../../../client/tests/fixtures/slugs'
import type { RushSiteConfig } from '../../src/config'
import type { EntryRouteContext, EntryRouteProps } from '../../src/entry-route'
import { attachRuntime, createRushRuntime } from '../../src/runtime'
import type { RushApiSettings } from '../../src/settings'

export type RouteContextInit = {
	locals: object
	currentLocale?: string | undefined
	isPrerendered?: boolean
	params?: RouteParams
	props?: EntryRouteProps
}

export type RecordingLogger = AstroRuntimeLogger & {
	readonly warnings: string[]
}

export const LOCALE_PATHS = { pt_BR: 'pt', en: 'en', es: 'es' }

export const GENERIC_ROUTES: RushRoutes = { '*': '/{locale}/{collection}/{slug}' }

export const ARTICLES = entryExample().collection.id

export const PREVIEW_TOKEN = 'rush_prv_e30.c2ln'

export const NEWS: CollectionRef = { id: '01JCNEWS00000000000000000', slug: 'news' }

export const OFFLINE_API: RushApiSettings = {
	url: 'http://127.0.0.1:1',
	siteId: 'site',
	token: 'delivery'
}

export function collectionsOf(
	id: string,
	slugs: Record<string, string>,
	...shared: CollectionRef[]
): RushCollections {
	return Object.fromEntries(
		Object.entries(slugs).map(([locale, slug]) => [locale, [{ id, slug }, ...shared]])
	)
}

export function siteConfig(overrides: Partial<RushSiteConfig> = {}): RushSiteConfig {
	return {
		routes: GENERIC_ROUTES,
		localePaths: { pt_BR: '', en: 'en', es: 'es' },
		collections: {},
		pageSegments: {},
		defaultLocale: 'en',
		seo: {},
		memo: true,
		preview: false,
		trustedProxies: 0,
		...overrides
	}
}

export function newsOnly(config: RushSiteConfig): RushSiteConfig {
	return {
		...config,
		routes: { [NEWS.slug]: '/{locale}/news/{slug}' },
		collections: collectionsOf(ARTICLES, COLLECTION_SLUGS, NEWS)
	}
}

export function recordingLogger(): RecordingLogger {
	const warnings: string[] = []
	const ignore = (): void => undefined
	return {
		warnings,
		info: ignore,
		warn: (message) => {
			warnings.push(message)
		},
		error: ignore
	}
}

export function rushLocals(
	api: RushApiSettings,
	config: RushSiteConfig = siteConfig(),
	previewToken?: string
): object {
	const locals = {}
	const runtime = createRushRuntime({ api, config })
	attachRuntime(locals, previewToken === undefined ? runtime : runtime.preview(previewToken))
	return locals
}

export function routeContext(init: RouteContextInit): EntryRouteContext {
	return {
		locals: init.locals,
		currentLocale: init.currentLocale,
		isPrerendered: init.isPrerendered ?? false,
		params: init.params ?? {},
		props: init.props ?? {}
	}
}
