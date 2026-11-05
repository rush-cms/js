import type { RushSiteConfig } from '../../src/config'
import { attachRuntime, createRushRuntime } from '../../src/runtime'
import type { RushApiSettings } from '../../src/settings'

export function siteConfig(overrides: Partial<RushSiteConfig> = {}): RushSiteConfig {
	return {
		routes: {},
		localePaths: { pt_BR: '', en: 'en', es: 'es' },
		routeKeysById: {},
		defaultLocale: 'en',
		seo: {},
		memo: true,
		...overrides
	}
}

export function rushLocals(api: RushApiSettings, config: RushSiteConfig = siteConfig()): object {
	const locals = {}
	attachRuntime(locals, createRushRuntime({ api, config }))
	return locals
}
