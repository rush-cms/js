/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import { getViteConfig } from 'astro/config'

export default getViteConfig({
	resolve: {
		alias: {
			'@rushcms/client': fileURLToPath(new URL('../client/src/index.ts', import.meta.url))
		}
	},
	test: { include: ['tests/**/*.test.ts'], passWithNoTests: true }
})
