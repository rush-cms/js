import { describe, expect, it } from 'vitest'
import { createUrls } from '../src/index'
import type { LocaleCode, RushLocalePaths } from '../src/index'
import { suggestLocalePaths } from '../src/internal'
import type { SiteLocales } from '../src/internal'
import { nonEmptySubsets } from './fixtures/subsets'

const POOL: LocaleCode[] = [
	'en',
	'en_US',
	'en_GB',
	'pt_BR',
	'pt_PT',
	'es',
	'es_419',
	'zh_Hant_TW',
	'fr',
	'de_CH'
]

function sites(): SiteLocales[] {
	return nonEmptySubsets(POOL).flatMap((locales) =>
		[locales, [...locales].reverse()].flatMap((order) =>
			order.map((defaultLocale) => ({ default_locale: defaultLocale, locales: order }))
		)
	)
}

function languageOf(locale: LocaleCode): string {
	return (locale.split(/[_-]/)[0] ?? '').toLowerCase()
}

function expectedPrefix(site: SiteLocales, locale: LocaleCode): string {
	if (locale === site.default_locale) {
		return ''
	}
	const shared = site.locales.filter((other) => languageOf(other) === languageOf(locale))
	return shared.length > 1 ? locale.toLowerCase().replaceAll('_', '-') : languageOf(locale)
}

function assertSuggestion(site: SiteLocales, suggestion: RushLocalePaths): void {
	const prefixes = Object.values(suggestion)
	expect(Object.keys(suggestion)).toEqual(site.locales)
	expect(prefixes.filter((prefix) => prefix === '')).toHaveLength(1)
	expect(suggestion[site.default_locale]).toBe('')
	expect(new Set(prefixes).size).toBe(prefixes.length)
	expect(prefixes.every((prefix) => !prefix.includes('/'))).toBe(true)
	for (const locale of site.locales) {
		expect(suggestion[locale]).toBe(expectedPrefix(site, locale))
	}
	expect(() => createUrls({ localePaths: suggestion })).not.toThrow()
}

describe('suggestLocalePaths', () => {
	it('follows the spec examples', () => {
		expect(
			suggestLocalePaths({ default_locale: 'pt_BR', locales: ['pt_BR', 'en_US', 'es'] })
		).toEqual({ pt_BR: '', en_US: 'en', es: 'es' })
		expect(
			suggestLocalePaths({ default_locale: 'en', locales: ['en', 'pt_BR', 'pt_PT'] })
		).toEqual({ en: '', pt_BR: 'pt-br', pt_PT: 'pt-pt' })
		expect(
			suggestLocalePaths({ default_locale: 'pt_PT', locales: ['en', 'pt_PT', 'pt_BR'] })
		).toEqual({ en: 'en', pt_PT: '', pt_BR: 'pt-br' })
	})

	it('holds for every generated locale set', () => {
		const generated = sites()
		expect(generated.length).toBeGreaterThan(10_000)
		for (const site of generated) {
			assertSuggestion(site, suggestLocalePaths(site))
		}
	})
})
