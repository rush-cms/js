import type { Entry, LocaleCode, RushClient, RushUrls } from '@rushcms/client'

export type LocalizedEntry = {
	locale: LocaleCode
	entry: Entry
}

export async function* localizedEntries(
	collection: string,
	client: RushClient,
	urls: RushUrls
): AsyncGenerator<LocalizedEntry, void, undefined> {
	for (const locale of urls.locales) {
		const slug = urls.collectionRef(collection, locale)?.slug ?? collection
		for await (const entry of client.entries.all(slug, { locale })) {
			yield { locale, entry }
		}
	}
}
