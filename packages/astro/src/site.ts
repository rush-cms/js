import { createClient } from '@rushcms/client'
import type { CollectionSlug, LocaleCode } from '@rushcms/client'
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
	const lists = await Promise.all(
		locales.map(async (locale): Promise<[LocaleCode, CollectionSlug[]]> => {
			const collections = await client.collections.list({ locale })
			return [locale, collections.map(({ id, slug }) => ({ id, slug }))]
		})
	)
	return {
		routes: options.routes ?? {},
		localePaths: options.localePaths,
		collections: Object.fromEntries(lists),
		defaultLocale: site.default_locale,
		seo: options.seo ?? {},
		memo: request.memo,
		preview: request.preview
	}
}
