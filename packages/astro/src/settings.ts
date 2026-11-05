export type RushApiSettings = {
	url: string
	siteId: string
	token: string
}

export type RushApiEnv = {
	RUSH_API_URL?: string | undefined
	RUSH_SITE_ID?: string | undefined
	RUSH_API_TOKEN?: string | undefined
}

const API_VARIABLES = ['RUSH_API_URL', 'RUSH_SITE_ID', 'RUSH_API_TOKEN'] as const

export function readApiSettings(env: RushApiEnv): RushApiSettings {
	const { RUSH_API_URL: url, RUSH_SITE_ID: siteId, RUSH_API_TOKEN: token } = env
	if (url && siteId && token) {
		return { url, siteId, token }
	}
	const missing = API_VARIABLES.filter((name) => !env[name])
	throw new Error(`@rushcms/astro: missing environment variables: ${missing.join(', ')}`)
}
