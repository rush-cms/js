import type {
	LocaleCode,
	RushCollections,
	RushLocalePaths,
	RushPageSegments,
	RushRoutes,
	RushTaxonomies
} from '@rushcms/client'
import type { Plugin } from 'vite'

export type SeoFieldMap = {
	title?: string
	description?: string
	image?: string
}

export type RushAstroOptions = {
	routes?: RushRoutes
	localePaths: RushLocalePaths
	pageSegments?: RushPageSegments
	taxonomies?: RushTaxonomies
	seo?: Record<string, SeoFieldMap>
	trustedProxies?: number
	forms?: boolean
}

export type RushSiteConfig = {
	routes: RushRoutes
	localePaths: RushLocalePaths
	collections: RushCollections
	pageSegments: RushPageSegments
	taxonomies: RushTaxonomies
	defaultLocale: LocaleCode
	seo: Record<string, SeoFieldMap>
	memo: boolean
	preview: boolean
	trustedProxies: number
}

export type RushConfigPlugin = Plugin & {
	resolveId(id: string): string | undefined
	load(id: string): Promise<string | undefined>
}

export const VIRTUAL_CONFIG_ID = 'virtual:rush/config'

export const CONFIG_PLUGIN_NAME = '@rushcms/astro:config'

const RESOLVED_CONFIG_ID = `\0${VIRTUAL_CONFIG_ID}`

export function rushConfigPlugin(load: () => Promise<RushSiteConfig>): RushConfigPlugin {
	return {
		name: CONFIG_PLUGIN_NAME,
		resolveId: (id: string) => (id === VIRTUAL_CONFIG_ID ? RESOLVED_CONFIG_ID : undefined),
		load: async (id: string) =>
			id === RESOLVED_CONFIG_ID ? `export default ${JSON.stringify(await load())}` : undefined
	}
}
