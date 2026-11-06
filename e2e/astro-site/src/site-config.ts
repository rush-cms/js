import type { UrlConfig } from '@rushcms/client'

export const SOLUTIONS_KEY = 'servicos'

export const SOLUTIONS_SEGMENT = 'solutions'

export const siteConfig: UrlConfig = {
	localePaths: { pt_BR: 'pt', en: 'en', es: 'es' },
	routes: { [SOLUTIONS_KEY]: `/{locale}/${SOLUTIONS_SEGMENT}/{slug}` }
}

export const defaultPath = '/pt'
