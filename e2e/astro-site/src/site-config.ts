import type { RushRoutes, UrlConfig } from '@rushcms/client'

export const SOLUTIONS_KEY = 'servicos'

export const SOLUTIONS_SEGMENT = 'solutions'

const fixedRoutes: RushRoutes =
	process.env['RUSH_CAPTCHA_SITE'] === 'true'
		? {}
		: { [SOLUTIONS_KEY]: `/{locale}/${SOLUTIONS_SEGMENT}/{slug}` }

export const siteConfig: UrlConfig = {
	localePaths: { pt_BR: 'pt', en: 'en', es: 'es' },
	routes: { ...fixedRoutes, '*': '/{locale}/{collection}/{slug}' }
}

export const defaultPath = '/pt'
