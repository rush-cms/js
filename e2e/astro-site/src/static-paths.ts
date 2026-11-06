import type { LocaleCode } from '@rushcms/client'
import { urls } from './urls'

export async function localizedPaths<T, P>(
	load: (locale: LocaleCode) => Promise<T[]>,
	toPath: (item: T, locale: string | undefined) => P
): Promise<P[]> {
	const groups = await Promise.all(
		urls.locales.map(async (locale) =>
			(await load(locale)).map((item) => toPath(item, urls.localeParam(locale)))
		)
	)
	return groups.flat()
}
