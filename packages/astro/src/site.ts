import { createClient, createUrls, listCollectionsByLocale } from '@rushcms/client'
import type { LocaleCode, RushLocalePaths } from '@rushcms/client'
import { suggestLocalePaths } from '@rushcms/client/internal'
import type { SiteLocales } from '@rushcms/client/internal'
import type { RushAstroOptions, RushSiteConfig } from './config'
import type { RushApiSettings } from './settings'
import { trustedProxyCount } from './visitor-ip'

export type RushSiteRequest = {
	api: RushApiSettings
	options: RushAstroOptions
	memo: boolean
	preview: boolean
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/

function quoted(value: string): string {
	return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`
}

function objectLiteral(values: RushLocalePaths): string {
	const entries = Object.entries(values).map(
		([key, value]) => `${IDENTIFIER.test(key) ? key : quoted(key)}: ${quoted(value)}`
	)
	return entries.length === 0 ? '{}' : `{ ${entries.join(', ')} }`
}

function assertLocales(configured: LocaleCode[], site: SiteLocales): void {
	const served = new Set(site.locales)
	const same =
		configured.length === served.size && configured.every((locale) => served.has(locale))
	if (!same) {
		throw new Error(
			`@rushcms/astro: localePaths locales [${configured.join(', ')}] differ from the site locales [${site.locales.join(', ')}]. Set in astro.config:\n  localePaths: ${objectLiteral(suggestLocalePaths(site))}`
		)
	}
}

export async function loadSiteConfig(request: RushSiteRequest): Promise<RushSiteConfig> {
	const { options } = request
	const client = createClient(request.api)
	const site = await client.site.get()
	const locales = Object.keys(options.localePaths)
	assertLocales(locales, site)
	const config: RushSiteConfig = {
		routes: options.routes ?? {},
		localePaths: options.localePaths,
		collections: await listCollectionsByLocale(client, locales),
		pageSegments: options.pageSegments ?? {},
		taxonomies: options.taxonomies ?? {},
		defaultLocale: site.default_locale,
		seo: options.seo ?? {},
		memo: request.memo,
		preview: request.preview,
		trustedProxies: trustedProxyCount(options)
	}
	createUrls(config)
	return config
}
