import type { LocaleCode, RushLocalePaths, Site } from './types'

export type SiteLocales = Pick<Site, 'default_locale' | 'locales'>

function languageOf(locale: LocaleCode): string {
	return (locale.split(/[_-]/)[0] ?? '').toLowerCase()
}

function fullCodeOf(locale: LocaleCode): string {
	return locale.toLowerCase().replaceAll('_', '-')
}

export function suggestLocalePaths(site: SiteLocales): RushLocalePaths {
	const languages = site.locales.map(languageOf)
	const shared = new Set(
		languages.filter((language, index) => languages.indexOf(language) !== index)
	)
	return Object.fromEntries(
		site.locales.map((locale) => {
			const language = languageOf(locale)
			if (locale === site.default_locale) {
				return [locale, '']
			}
			return [locale, shared.has(language) ? fullCodeOf(locale) : language]
		})
	)
}
