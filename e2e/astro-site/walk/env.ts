import { PREVIEW_PORT, SITE_PORT, localUrl, required } from '../../walk-kit/env.ts'

export type WalkEnv = {
	apiUrl: string
	siteId: string
	captchaSiteId: string
	adminEmail: string
	adminPassword: string
	apiToken: string
	chromePath: string
	shotsDir: string
	apiLog: string | undefined
}

export type Instance = 'site' | 'preview' | 'captcha'

export const PORTS: Record<Instance, number> = {
	site: SITE_PORT,
	preview: PREVIEW_PORT,
	captcha: 4323
}

export const SITE_URL = localUrl(PORTS.site)
export const PREVIEW_URL = localUrl(PORTS.preview)
export const CAPTCHA_URL = localUrl(PORTS.captcha)
export const ADMIN_URL = 'http://localhost:5174'

export function readWalkEnv(): WalkEnv {
	return {
		apiUrl: required('RUSH_API_URL'),
		siteId: required('RUSH_SITE_ID'),
		captchaSiteId: required('RUSH_CAPTCHA_SITE_ID'),
		adminEmail: required('ADMIN_EMAIL'),
		adminPassword: required('ADMIN_PASSWORD'),
		apiToken: required('RUSH_API_TOKEN'),
		chromePath: required('CHROME_PATH'),
		shotsDir: required('E2E_SHOTS_DIR'),
		apiLog: process.env['API_LOG'] || undefined
	}
}
