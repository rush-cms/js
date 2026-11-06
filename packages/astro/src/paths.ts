import type { Entry, RouteParams, RushClient, RushUrls } from '@rushcms/client'
import { localizedEntries } from './localized-entries'

export type EntryStaticPath = {
	params: RouteParams
	props: { entry: Entry }
}

function paramsKey(params: RouteParams): string {
	return JSON.stringify(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)))
}

function preferred(current: EntryStaticPath | undefined, next: EntryStaticPath): EntryStaticPath {
	return current !== undefined && (!current.props.entry.fallback || next.props.entry.fallback)
		? current
		: next
}

export async function collectEntryPaths(
	collection: string,
	client: RushClient,
	urls: RushUrls
): Promise<EntryStaticPath[]> {
	const paths = new Map<string, EntryStaticPath>()
	for await (const { locale, entry } of localizedEntries(collection, client, urls)) {
		const next: EntryStaticPath = {
			params: urls.entryParams(entry.collection, locale, entry.slug),
			props: { entry }
		}
		const key = paramsKey(next.params)
		paths.set(key, preferred(paths.get(key), next))
	}
	return [...paths.values()]
}

export async function entryPaths(
	collection: string,
	rush?: RushClient
): Promise<EntryStaticPath[]> {
	const { siteRuntime } = await import('./site-runtime')
	return collectEntryPaths(collection, rush ?? siteRuntime.onDemandClient(), siteRuntime.urls)
}
