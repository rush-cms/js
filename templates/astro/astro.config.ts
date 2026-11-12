import node from '@astrojs/node'
import rush from '@rushcms/astro'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'
import { loadEnv } from 'vite'

const siteEnv = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), 'SITE_URL')

const siteUrl = siteEnv.SITE_URL ? new URL(siteEnv.SITE_URL) : undefined

export default defineConfig({
	...(siteUrl && { site: siteUrl.href }),
	output: 'static',
	adapter: node({ mode: 'standalone' }),
	security: {
		...(siteUrl && {
			allowedDomains: [
				{
					protocol: siteUrl.protocol === 'https:' ? 'https' : 'http',
					hostname: siteUrl.hostname
				}
			]
		})
	},
	vite: {
		plugins: [tailwindcss()]
	},
	integrations: [
		rush({
			// TODO: paste the localePaths line that the first `npm run dev` prints.
			localePaths: {},
			// TODO: replace '*' with one route per public collection, so data-only collections get no pages.
			routes: { '*': '/{locale}/{collection}/{slug}' },
			// TODO: set how many reverse proxies sit in front of the server (see "Deployment" in README.md).
			trustedProxies: 1
		})
	]
})
