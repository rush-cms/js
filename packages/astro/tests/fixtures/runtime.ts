import type { RouteParams, RushCollections } from '@rushcms/client'
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

export const LOCALE_PATHS = { pt_BR: 'pt', en: 'en', es: 'es' }

export const OFFLINE_API: RushApiSettings = {
	url: 'http://127.0.0.1:1',
	siteId: 'site',
	token: 'delivery'
}

export function collectionsOf(id: string, slugs: Record<string, string>): RushCollections {
	return Object.fromEntries(
		Object.entries(slugs).map(([locale, slug]) => [locale, [{ id, slug }]])
	)
}

export function siteConfig(overrides: Partial<RushSiteConfig> = {}): RushSiteConfig {
	return {
		routes: {},
		localePaths: { pt_BR: '', en: 'en', es: 'es' },
		collections: {},
		defaultLocale: 'en',
		seo: {},
		memo: true,
		preview: false,
		...overrides
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
