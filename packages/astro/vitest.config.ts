/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import { getViteConfig } from 'astro/config'

const DOM_TEST = 'tests/form-enhance.test.ts'

export default getViteConfig({
	resolve: {
		alias: {
			'@rushcms/client': fileURLToPath(new URL('../client/src/index.ts', import.meta.url)),
			'@rushcms/astro/components-runtime': fileURLToPath(
				new URL('./src/components-runtime.ts', import.meta.url)
			),
			'@rushcms/astro/form-enhance': fileURLToPath(
				new URL('./src/form-enhance.ts', import.meta.url)
			)
		}
	},
	test: {
		passWithNoTests: true,
		projects: [
			{
				extends: true,
				test: {
					name: 'node',
					include: ['tests/**/*.test.ts'],
					exclude: [DOM_TEST]
				}
			},
			{
				extends: true,
				test: { name: 'dom', environment: 'happy-dom', include: [DOM_TEST] }
			}
		]
	}
})
