import { createUrls } from '@rushcms/client'
import type { Collection, LocaleCode, RushUrls } from '@rushcms/client'
import { buildClient } from './build-client'
import { siteConfig } from './site-config'
import { localeUrls } from './urls'

export async function localizedPaths<T, P>(
	load: (locale: LocaleCode) => Promise<T[]>,
	toPath: (item: T, locale: string | undefined) => P
): Promise<P[]> {
	const groups = await Promise.all(
		localeUrls.locales.map(async (locale) =>
			(await load(locale)).map((item) => toPath(item, localeUrls.localeParam(locale)))
		)
	)
	return groups.flat()
}

export async function buildUrls(): Promise<RushUrls> {
	const lists = await Promise.all(
		localeUrls.locales.map(async (locale): Promise<[LocaleCode, Collection[]]> => [
			locale,
			await buildClient.collections.list({ locale })
		])
	)
	return createUrls({ ...siteConfig, collections: Object.fromEntries(lists) })
}
