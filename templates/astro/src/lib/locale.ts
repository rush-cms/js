import { getRush, getUrls } from '@rushcms/astro'
import type { RushContext } from '@rushcms/astro'
import { toBcp47 } from '@rushcms/client'
import type { LocaleCode } from '@rushcms/client'

export function inLocale(context: RushContext, locale: LocaleCode): RushContext {
	return {
		locals: context.locals,
		currentLocale: undefined,
		isPrerendered: context.isPrerendered,
		params: { locale: getUrls(context).localeParam(locale) }
	}
}

export async function localeOfPath(context: RushContext, pathname: string): Promise<LocaleCode> {
	const urls = getUrls(context)
	const segment = pathname.split('/').find((part) => part !== '')
	const found = urls.localeOf(segment) ?? urls.localeOf(undefined)
	return found ?? (await getRush(context).site.get()).default_locale
}

export function languageName(locale: LocaleCode): string {
	const tag = toBcp47(locale)
	const name = new Intl.DisplayNames([tag], { type: 'language' }).of(tag) ?? tag
	return name.charAt(0).toLocaleUpperCase(tag) + name.slice(1)
}

export function formatDate(value: string, locale: LocaleCode): string {
	return new Intl.DateTimeFormat(toBcp47(locale), { dateStyle: 'long' }).format(new Date(value))
}
