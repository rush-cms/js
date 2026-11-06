export type WalkEnv = {
	apiUrl: string
	siteId: string
	captchaSiteId: string
	adminEmail: string
	adminPassword: string
	chromePath: string
	shotsDir: string
}

export const SITE_URL = 'http://localhost:4321'
export const PREVIEW_URL = 'http://localhost:4322'
export const CAPTCHA_URL = 'http://localhost:4323'
export const ADMIN_URL = 'http://localhost:5174'
export const PROXY_HOST = 'visitor.test'
export const PROXY_PORT = 4400

function required(name: string): string {
	const value = process.env[name]
	if (value === undefined || value === '') {
		throw new Error(`${name} is not set (see e2e/README.md)`)
	}
	return value
}

export function readWalkEnv(): WalkEnv {
	return {
		apiUrl: required('RUSH_API_URL'),
		siteId: required('RUSH_SITE_ID'),
		captchaSiteId: required('RUSH_CAPTCHA_SITE_ID'),
		adminEmail: required('ADMIN_EMAIL'),
		adminPassword: required('ADMIN_PASSWORD'),
		chromePath: required('CHROME_PATH'),
		shotsDir: required('E2E_SHOTS_DIR')
	}
}
