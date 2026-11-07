import { PREVIEW_PORT, SITE_PORT, localUrl, required } from '../../walk-kit/env.ts'

export type TemplateEnv = {
	apiUrl: string
	siteId: string
	apiToken: string
	adminEmail: string
	adminPassword: string
	chromePath: string
	shotsDir: string
	workDir: string
}

export const SITE_URL = localUrl(SITE_PORT)
export const PREVIEW_URL = localUrl(PREVIEW_PORT)

export function readTemplateEnv(): TemplateEnv {
	return {
		apiUrl: required('RUSH_API_URL'),
		siteId: required('RUSH_SITE_ID'),
		apiToken: required('RUSH_API_TOKEN'),
		adminEmail: required('ADMIN_EMAIL'),
		adminPassword: required('ADMIN_PASSWORD'),
		chromePath: required('CHROME_PATH'),
		shotsDir: required('E2E_SHOTS_DIR'),
		workDir: required('E2E_WORK_DIR')
	}
}
