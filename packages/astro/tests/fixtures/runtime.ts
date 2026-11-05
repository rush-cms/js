import type { RushSiteConfig } from '../../src/config'
import { attachRuntime, createRushRuntime } from '../../src/runtime'
import type { RushApiSettings } from '../../src/settings'

export const LOCALE_PATHS = { pt_BR: 'pt', en: 'en', es: 'es' }

export const OFFLINE_API: RushApiSettings = {
	url: 'http://127.0.0.1:1',
	siteId: 'site',
	token: 'delivery'
}

export function siteConfig(overrides: Partial<RushSiteConfig> = {}): RushSiteConfig {
	return {
		routes: {},
		localePaths: { pt_BR: '', en: 'en', es: 'es' },
		routeKeysById: {},
		defaultLocale: 'en',
		seo: {},
		memo: true,
		preview: false,
		...overrides
	}
}

export function rushLocals(api: RushApiSettings, config: RushSiteConfig = siteConfig()): object {
	const locals = {}
	attachRuntime(locals, createRushRuntime({ api, config }))
	return locals
}
