import type { LocaleCode } from '@rushcms/client'
import { prefixOf, urls } from './urls'

export async function localizedPaths<T, P>(
	load: (locale: LocaleCode) => Promise<T[]>,
	toPath: (item: T, prefix: string) => P
): Promise<P[]> {
	const groups = await Promise.all(
		urls.locales.map(async (locale) =>
			(await load(locale)).map((item) => toPath(item, prefixOf(locale)))
		)
	)
	return groups.flat()
}
