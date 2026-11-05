import { fileURLToPath } from 'node:url'
import type { AstroConfig, RemotePattern } from 'astro'

export type RushEnv = Record<string, string>

export type RushEnvSource = Pick<AstroConfig, 'root' | 'vite'>

export type RushCommand = 'dev' | 'build' | 'preview' | 'sync'

export async function rushEnvSchema(): Promise<AstroConfig['env']['schema']> {
	const { envField } = await import('astro/config')
	return {
		RUSH_API_URL: envField.string({ context: 'server', access: 'public', url: true }),
		RUSH_SITE_ID: envField.string({ context: 'server', access: 'public' }),
		RUSH_API_TOKEN: envField.string({ context: 'server', access: 'secret' }),
		RUSH_MEDIA_URL: envField.string({
			context: 'server',
			access: 'public',
			url: true,
			optional: true
		}),
		RUSH_PREVIEW: envField.boolean({ context: 'server', access: 'public', default: false })
	}
}

export async function loadRushEnv(source: RushEnvSource, command: RushCommand): Promise<RushEnv> {
	const { loadEnv } = await import('vite')
	const mode = command === 'build' ? 'production' : 'development'
	return loadEnv(mode, source.vite.envDir || fileURLToPath(source.root), 'RUSH_')
}

export function mediaPatterns(env: RushEnv): RemotePattern[] {
	const media = env.RUSH_MEDIA_URL || env.RUSH_API_URL
	if (media === undefined || !URL.canParse(media)) {
		return []
	}
	const url = new URL(media)
	const pattern: RemotePattern = {
		protocol: url.protocol.slice(0, -1),
		hostname: url.hostname
	}
	return [url.port === '' ? pattern : { ...pattern, port: url.port }]
}
