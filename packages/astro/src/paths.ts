import type { Entry, RouteParams, RushClient, RushUrls } from '@rushcms/client'
import { localizedEntries } from './localized-entries'
import type { LocalizedEntry } from './localized-entries'

export type EntryStaticPath = {
	params: RouteParams
	props: { entry: Entry }
}

function paramsKey(params: RouteParams): string {
	return JSON.stringify(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)))
}

function preferred(current: LocalizedEntry | undefined, next: LocalizedEntry): LocalizedEntry {
	return current !== undefined && (!current.entry.fallback || next.entry.fallback)
		? current
		: next
}

function paramsOf(urls: RushUrls, { locale, entry }: LocalizedEntry): RouteParams {
	return urls.entryParams(entry.collection, locale, entry.slug)
}

export async function collectEntryPages(
	collection: string,
	client: RushClient,
	urls: RushUrls
): Promise<LocalizedEntry[]> {
	const pages = new Map<string, LocalizedEntry>()
	for await (const next of localizedEntries(collection, client, urls)) {
		const key = paramsKey(paramsOf(urls, next))
		pages.set(key, preferred(pages.get(key), next))
	}
	return [...pages.values()]
}

export async function collectEntryPaths(
	collection: string,
	client: RushClient,
	urls: RushUrls
): Promise<EntryStaticPath[]> {
	const pages = await collectEntryPages(collection, client, urls)
	return pages.map((page) => ({ params: paramsOf(urls, page), props: { entry: page.entry } }))
}

export async function entryPaths(
	collection: string,
	rush?: RushClient
): Promise<EntryStaticPath[]> {
	const { siteRuntime } = await import('./site-runtime')
	return collectEntryPaths(collection, rush ?? siteRuntime.onDemandClient(), siteRuntime.urls)
}
