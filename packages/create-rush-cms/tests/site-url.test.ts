import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TEMPLATE_SOURCE } from './support'

type AllowedDomain = {
	protocol: string
	hostname: string
}

type TemplateConfig = {
	site: string
	security: { allowedDomains: AllowedDomain[] }
}

type ConfigModule = {
	default: TemplateConfig
}

type SiteUrlCase = {
	name: string
	siteUrl: string
	site: string
	allowedDomains: AllowedDomain[]
}

vi.mock('@rushcms/astro', () => ({ default: () => ({ name: 'rush' }) }))

vi.mock('@astrojs/node', () => ({ default: () => ({ name: 'node' }) }))

const DEV_SITE = 'http://localhost:4321/'

const CASES: SiteUrlCase[] = [
	{
		name: 'an https production URL',
		siteUrl: 'https://www.example.com',
		site: 'https://www.example.com/',
		allowedDomains: [{ protocol: 'https', hostname: 'www.example.com' }]
	},
	{
		name: 'an http URL with a port',
		siteUrl: 'http://staging.example.com:8080',
		site: 'http://staging.example.com:8080/',
		allowedDomains: [{ protocol: 'http', hostname: 'staging.example.com' }]
	},
	{
		name: 'an empty value',
		siteUrl: '',
		site: DEV_SITE,
		allowedDomains: [{ protocol: 'http', hostname: 'localhost' }]
	}
]

async function loadConfig(): Promise<TemplateConfig> {
	vi.resetModules()
	const module = (await import(join(TEMPLATE_SOURCE, 'astro.config.ts'))) as ConfigModule
	return module.default
}

afterEach(() => {
	vi.unstubAllEnvs()
})

describe('template astro.config SITE_URL', () => {
	it.each(CASES)('derives site and allowedDomains from $name', async (testCase) => {
		vi.stubEnv('SITE_URL', testCase.siteUrl)
		const config = await loadConfig()
		expect(config.site).toBe(testCase.site)
		expect(config.security.allowedDomains).toEqual(testCase.allowedDomains)
	})

	it('falls back to the development URL when SITE_URL is unset', async () => {
		vi.stubEnv('SITE_URL', undefined)
		const config = await loadConfig()
		expect(config.site).toBe(DEV_SITE)
		expect(config.security.allowedDomains).toEqual([
			{ protocol: 'http', hostname: 'localhost' }
		])
	})
})
