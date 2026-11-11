import { describe, expect, it } from 'vitest'
import { createUrls } from '@rushcms/client'
import type { Alternate, LocaleCode, RushLocalePaths } from '@rushcms/client'
import { X_DEFAULT, alternateIn, hreflangLinks } from '../src/alternate-links'
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

const LOCALES: LocaleCode[] = ['pt_BR', 'en', 'es']
const PREFIXES = { pt_BR: 'br', en: 'en', es: 'es' }
const SITE = new URL('https://site.example')

type XDefaultCase = {
	rootLocale: LocaleCode | undefined
	defaultLocale: LocaleCode
	listed: LocaleCode[]
}

function xDefaultCases(): XDefaultCase[] {
	const roots = [undefined, ...LOCALES]
	const subsets = Array.from({ length: 1 << LOCALES.length }, (_, mask) =>
		LOCALES.filter((_locale, index) => (mask >> index) & 1)
	)
	return roots.flatMap((rootLocale) =>
		LOCALES.flatMap((defaultLocale) =>
			subsets.map((listed) => ({ rootLocale, defaultLocale, listed }))
		)
	)
}

function pathsFor(rootLocale: LocaleCode | undefined): RushLocalePaths {
	return { ...PREFIXES, ...(rootLocale === undefined ? {} : { [rootLocale]: '' }) }
}

function expectedXDefault(testCase: XDefaultCase): string | undefined {
	const wanted = testCase.rootLocale ?? testCase.defaultLocale
	return testCase.listed.includes(wanted) ? `https://site.example/${wanted}` : undefined
}

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

	it('points x-default at the root-prefix locale instead of the default locale', async () => {
		const locals = rushLocals(
			OFFLINE_API,
			siteConfig({ defaultLocale: 'en', localePaths: { pt_BR: '', en: 'en', es: 'es' } })
		)
		const html = await renderComponent(Hreflang, { props: { alternates: CATEGORY }, locals })
		expect(hreflangsOf(html)).toEqual([
			'pt-BR https://site.example/pt/categoria/design',
			'en https://site.example/en/category/design',
			'x-default https://site.example/pt/categoria/design'
		])
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

describe('x-default rule', () => {
	const cases = xDefaultCases()

	it(`follows the root-prefix locale, else the default locale, over ${cases.length} configs`, () => {
		for (const testCase of cases) {
			const urls = createUrls({ localePaths: pathsFor(testCase.rootLocale) })
			const alternates = testCase.listed.map((locale) => alternateIn(locale, `/${locale}`))
			const links = hreflangLinks(alternates, urls, testCase.defaultLocale, SITE)
			const found = links.find((link) => link.hreflang === X_DEFAULT)?.url
			expect(found, JSON.stringify(testCase)).toBe(expectedXDefault(testCase))
			expect(links).toHaveLength(alternates.length + (found === undefined ? 0 : 1))
		}
	})
})
