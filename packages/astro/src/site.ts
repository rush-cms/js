import { createClient } from '@rushcms/client'
import type { Collection, LocaleCode, RushRoutes } from '@rushcms/client'
import type { RushAstroOptions, RushSiteConfig } from './config'
import type { RushApiSettings } from './settings'

export type RushSiteRequest = {
	api: RushApiSettings
	options: RushAstroOptions
	memo: boolean
}

export function assertLocales(configured: LocaleCode[], served: LocaleCode[]): void {
	const servedSet = new Set(served)
	const same =
		configured.length === servedSet.size && configured.every((locale) => servedSet.has(locale))
	if (!same) {
		throw new Error(
			`@rushcms/astro: localePaths locales [${configured.join(', ')}] differ from the site locales [${served.join(', ')}]`
		)
	}
}

export function routeKeysById(
	routes: RushRoutes,
	collections: Collection[]
): Record<string, string> {
	const keys: Record<string, string> = {}
	for (const collection of collections) {
		if (!Object.hasOwn(keys, collection.id) && Object.hasOwn(routes, collection.slug)) {
			keys[collection.id] = collection.slug
		}
	}
	return keys
}

export async function loadSiteConfig(request: RushSiteRequest): Promise<RushSiteConfig> {
	const { options } = request
	const client = createClient(request.api)
	const site = await client.site.get()
	const locales = Object.keys(options.localePaths)
	assertLocales(locales, site.locales)
	const routes = options.routes ?? {}
	const lists = await Promise.all(locales.map((locale) => client.collections.list({ locale })))
	return {
		routes,
		localePaths: options.localePaths,
		routeKeysById: routeKeysById(routes, lists.flat()),
		defaultLocale: site.default_locale,
		seo: options.seo ?? {},
		memo: request.memo
	}
}
