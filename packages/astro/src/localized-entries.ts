import type { CollectionRef, Entry, LocaleCode, RushClient, RushUrls } from '@rushcms/client'

export type LocalizedEntry = {
	locale: LocaleCode
	entry: Entry
}

function refOf(collection: string, urls: RushUrls): CollectionRef {
	const known = urls.locales
		.map((locale) => urls.collectionRef(collection, locale))
		.find((ref) => ref !== undefined)
	return known ?? { id: collection, slug: collection }
}

function assertRouted(collection: string, urls: RushUrls): void {
	if (!urls.routed(refOf(collection, urls))) {
		throw new Error(`@rushcms/astro: collection "${collection}" has no route`)
	}
}

export async function* localizedEntries(
	collection: string,
	client: RushClient,
	urls: RushUrls
): AsyncGenerator<LocalizedEntry, void, undefined> {
	assertRouted(collection, urls)
	for (const locale of urls.locales) {
		const slug = urls.collectionRef(collection, locale)?.slug ?? collection
		for await (const entry of client.entries.all(slug, { locale })) {
			yield { locale, entry }
		}
	}
}
