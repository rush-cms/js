import node from '@astrojs/node'
import rush from '@rushcms/astro'
import { defineConfig } from 'astro/config'
import { defaultPath, siteConfig } from './src/site-config'

const behindWalkerProxy = process.env['RUSH_PREVIEW'] !== 'true'

export default defineConfig({
	site: 'http://localhost:4321',
	output: 'static',
	adapter: node({ mode: 'standalone' }),
	redirects: { '/': defaultPath },
	security: {
		allowedDomains: [
			{ protocol: 'http', hostname: 'localhost' },
			{ protocol: 'http', hostname: 'visitor.test' }
		]
	},
	integrations: [rush({ ...siteConfig, trustedProxies: behindWalkerProxy ? 1 : 0 })]
})
