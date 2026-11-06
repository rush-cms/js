import type { RushCollections } from './urls'
import type { LocaleCode, RushClient } from './types'

export async function listCollectionsByLocale(
	client: RushClient,
	locales: readonly LocaleCode[]
): Promise<RushCollections> {
	const lists = await Promise.all(
		locales.map(async (locale) => {
			const collections = await client.collections.list({ locale })
			return [locale, collections.map(({ id, slug }) => ({ id, slug }))] as const
		})
	)
	return Object.fromEntries(lists)
}
