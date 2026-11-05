import { createUrls } from '@rushcms/client'
import type { AstroIntegration } from 'astro'
import { rushConfigPlugin } from './config'
import type { RushAstroOptions, RushSiteConfig } from './config'
import { loadRushEnv, mediaPatterns, rushEnvSchema } from './env'
import { readApiSettings } from './settings'
import { loadSiteConfig } from './site'

const PACKAGE_NAME = '@rushcms/astro'

const FORMS_ROUTE = '/_rush/forms/[key]'

type SiteLoader = () => Promise<RushSiteConfig>

function once(load: SiteLoader): SiteLoader {
	let pending: Promise<RushSiteConfig> | undefined
	return () => {
		pending ??= load()
		return pending
	}
}

export function rush(options: RushAstroOptions): AstroIntegration {
	let site: SiteLoader = () =>
		Promise.reject(new Error(`${PACKAGE_NAME}: astro:config:setup did not run`))

	return {
		name: PACKAGE_NAME,
		hooks: {
			'astro:config:setup': async ({
				config,
				command,
				updateConfig,
				addMiddleware,
				injectRoute
			}) => {
				createUrls(options)
				const env = await loadRushEnv(config, command)
				site = once(() =>
					loadSiteConfig({
						api: readApiSettings(env),
						options,
						memo: command === 'build'
					})
				)
				updateConfig({
					env: { schema: await rushEnvSchema() },
					image: { remotePatterns: mediaPatterns(env) },
					vite: {
						plugins: [rushConfigPlugin(() => site())],
						ssr: { noExternal: [PACKAGE_NAME] }
					}
				})
				addMiddleware({ order: 'pre', entrypoint: `${PACKAGE_NAME}/middleware` })
				injectRoute({
					pattern: FORMS_ROUTE,
					entrypoint: `${PACKAGE_NAME}/routes/forms`,
					prerender: false
				})
			},
			'astro:build:start': async () => {
				await site()
			},
			'astro:server:setup': async () => {
				await site()
			}
		}
	}
}
