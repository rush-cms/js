import { createClient, listCollectionsByLocale } from '@rushcms/client'
import type { LocaleCode } from '@rushcms/client'
import type { RushAstroOptions, RushSiteConfig } from './config'
import type { RushApiSettings } from './settings'

export type RushSiteRequest = {
	api: RushApiSettings
	options: RushAstroOptions
	memo: boolean
	preview: boolean
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

export async function loadSiteConfig(request: RushSiteRequest): Promise<RushSiteConfig> {
	const { options } = request
	const client = createClient(request.api)
	const site = await client.site.get()
	const locales = Object.keys(options.localePaths)
	assertLocales(locales, site.locales)
	return {
		routes: options.routes ?? {},
		localePaths: options.localePaths,
		collections: await listCollectionsByLocale(client, locales),
		defaultLocale: site.default_locale,
		seo: options.seo ?? {},
		memo: request.memo,
		preview: request.preview
	}
}
