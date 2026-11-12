import { createUrls } from '@rushcms/client'
import type { AstroConfig, AstroIntegration } from 'astro'
import { rushConfigPlugin } from './config'
import type { RushAstroOptions, RushSiteConfig } from './config'
import { loadRushEnv, mediaPatterns, rushEnvSchema } from './env'
import type { RushCommand } from './env'
import { readApiSettings } from './settings'
import { loadSiteConfig } from './site'
import { trustedProxyCount } from './visitor-ip'

const PACKAGE_NAME = '@rushcms/astro'

const MISSING_SITE_MESSAGE = `${PACKAGE_NAME}: set "site" in astro.config before building; canonical, hreflang, Open Graph and sitemap URLs are built from it`

type RushRoute = {
	pattern: string
	entrypoint: string
}

const FORMS_ROUTES: RushRoute[] = [
	{ pattern: '/_rush/forms/[key]', entrypoint: `${PACKAGE_NAME}/routes/forms` }
]

const PREVIEW_ROUTES: RushRoute[] = [
	{ pattern: '/_rush/preview', entrypoint: `${PACKAGE_NAME}/routes/preview` },
	{ pattern: '/_rush/preview/exit', entrypoint: `${PACKAGE_NAME}/routes/preview-exit` }
]

type SiteLoader = () => Promise<RushSiteConfig>

function once(load: SiteLoader): SiteLoader {
	let pending: Promise<RushSiteConfig> | undefined
	return () => {
		pending ??= load()
		return pending
	}
}

export function siteFor(
	command: RushCommand,
	site: AstroConfig['site'],
	port: number
): AstroConfig['site'] {
	if (site !== undefined) {
		return site
	}
	if (command === 'build') {
		throw new Error(MISSING_SITE_MESSAGE)
	}
	return command === 'dev' ? `http://localhost:${port}` : undefined
}

export function rush(options: RushAstroOptions): AstroIntegration {
	let preview = false
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
				const resolvedSite = siteFor(command, config.site, config.server.port)
				const env = await loadRushEnv(config, command)
				preview = env.RUSH_PREVIEW === 'true'
				trustedProxyCount(options, preview)
				site = once(() =>
					loadSiteConfig({
						api: readApiSettings(env),
						options,
						memo: command === 'build',
						preview
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
				if (resolvedSite !== config.site) {
					updateConfig({ site: resolvedSite })
				}
				addMiddleware({ order: 'pre', entrypoint: `${PACKAGE_NAME}/middleware` })
				const siteRoutes = options.forms === false ? [] : FORMS_ROUTES
				for (const route of preview ? [...siteRoutes, ...PREVIEW_ROUTES] : siteRoutes) {
					injectRoute({ ...route, prerender: false })
				}
			},
			'astro:route:setup': ({ route }) => {
				if (preview) {
					route.prerender = false
				}
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
