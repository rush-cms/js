import node from '@astrojs/node'
import rush from '@rushcms/astro'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

export default defineConfig({
	// TODO: set your production URL; canonical links, hreflang links and the sitemap are built from it.
	site: 'http://localhost:4321',
	output: 'static',
	adapter: node({ mode: 'standalone' }),
	security: {
		// TODO: list every domain that serves this site, or form posts and preview links fail there.
		allowedDomains: [{ protocol: 'https', hostname: 'www.example.com' }]
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
