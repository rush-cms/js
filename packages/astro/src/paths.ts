import type { Entry, RouteParams, RushClient, RushUrls } from '@rushcms/client'

export type EntryStaticPath = {
	params: RouteParams
	props: { entry: Entry }
}

export async function collectEntryPaths(
	collection: string,
	client: RushClient,
	urls: RushUrls
): Promise<EntryStaticPath[]> {
	const paths: EntryStaticPath[] = []
	for (const locale of urls.locales) {
		for await (const entry of client.entries.all(collection, { locale })) {
			paths.push({
				params: urls.entryParams(entry.collection, locale, entry.slug),
				props: { entry }
			})
		}
	}
	return paths
}

export async function entryPaths(
	collection: string,
	rush?: RushClient
): Promise<EntryStaticPath[]> {
	const { siteRuntime } = await import('./site-runtime')
	return collectEntryPaths(collection, rush ?? siteRuntime.onDemandClient(), siteRuntime.urls)
}
