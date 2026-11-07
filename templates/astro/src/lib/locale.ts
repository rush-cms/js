import { toBcp47 } from '@rushcms/client'
import type { LocaleCode } from '@rushcms/client'

export function languageName(locale: LocaleCode): string {
	const tag = toBcp47(locale)
	const name = new Intl.DisplayNames([tag], { type: 'language' }).of(tag) ?? tag
	return name.charAt(0).toLocaleUpperCase(tag) + name.slice(1)
}

export function formatDate(value: string, locale: LocaleCode): string {
	return new Intl.DateTimeFormat(toBcp47(locale), { dateStyle: 'long' }).format(new Date(value))
}
