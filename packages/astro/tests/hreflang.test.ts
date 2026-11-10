import { describe, expect, it } from 'vitest'
import type { Alternate } from '@rushcms/client'
import Hreflang from '../src/components/hreflang.astro'
import { renderComponent } from './fixtures/render'
import { LOCALE_PATHS, OFFLINE_API, rushLocals, siteConfig } from './fixtures/runtime'

const CATEGORY: Alternate[] = [
	{ locale: 'pt_BR', hreflang: 'pt-BR', url: '/pt/categoria/design' },
	{ locale: 'en', hreflang: 'en', url: '/en/category/design' }
]

const LOCALS = rushLocals(
	OFFLINE_API,
	siteConfig({ defaultLocale: 'en', localePaths: LOCALE_PATHS })
)

function hreflangsOf(html: string): string[] {
	const pattern = /<link rel="alternate" hreflang="([^"]*)" href="([^"]*)">/g
	return [...html.matchAll(pattern)].map(([, hreflang, url]) => `${hreflang} ${url}`)
}

describe('Hreflang', () => {
	it('links every alternate by its absolute URL and adds x-default for the default locale', async () => {
		const html = await renderComponent(Hreflang, {
			props: { alternates: CATEGORY },
			locals: LOCALS
		})
		expect(hreflangsOf(html)).toEqual([
			'pt-BR https://site.example/pt/categoria/design',
			'en https://site.example/en/category/design',
			'x-default https://site.example/en/category/design'
		])
	})

	it('adds no x-default when the default locale has no alternate', async () => {
		const html = await renderComponent(Hreflang, {
			props: { alternates: CATEGORY.slice(0, 1) },
			locals: LOCALS
		})
		expect(hreflangsOf(html)).toEqual(['pt-BR https://site.example/pt/categoria/design'])
	})

	it('renders nothing without alternates', async () => {
		const html = await renderComponent(Hreflang, { props: { alternates: [] }, locals: LOCALS })
		expect(hreflangsOf(html)).toEqual([])
	})

	it('throws without site', async () => {
		await expect(
			renderComponent(Hreflang, {
				props: { alternates: CATEGORY },
				locals: LOCALS,
				site: undefined
			})
		).rejects.toThrow('<Hreflang> needs "site" set in astro.config')
	})
})
