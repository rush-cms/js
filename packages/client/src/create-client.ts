import { createCatalog } from './resources/catalog'
import { createContext } from './resources/context'
import { createEntries } from './resources/entries'
import { createForms } from './resources/forms'
import { createTags } from './resources/tags'
import { createTransport } from './transport'
import type { RushClient, RushClientConfig } from './types'

export function createClient(config: RushClientConfig): RushClient {
	const context = createContext(createTransport(config), config)

	return {
		routes: config.routes ?? {},
		localePaths: config.localePaths ?? {},
		site: {
			get: (options) => context.data<'getSite'>(['site'], options, 'unlocalized')
		},
		collections: createCatalog(context, 'collections', 'localized'),
		entries: createEntries(context),
		homepage: {
			get: (options) => context.data<'getHomepage'>(['homepage'], options, 'localized')
		},
		navigations: createCatalog(context, 'navigations', 'localized'),
		siteOptions: createCatalog(context, 'site-options', 'localized'),
		tags: createTags(context),
		blocks: createCatalog(context, 'blocks', 'unlocalized'),
		databases: createCatalog(context, 'databases', 'localized'),
		linkPages: createCatalog(context, 'link-pages', 'unlocalized'),
		forms: createForms(context)
	}
}
