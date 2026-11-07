import { optional } from '@rushcms/client'
import type {
	Collection,
	CollectionMatch,
	EntriesResource,
	EntryMatch,
	Homepage,
	LocaleCode,
	RushClient,
	RushUrls
} from '@rushcms/client'
import { MISSING, resolveEntry } from './entry-route'
import type { EntryFound, EntryMissing, EntryMoved, EntryRouteContext } from './entry-route'
import { collectEntryPages } from './paths'
import { runtimeOf } from './runtime'
import type { RushContext, RushRuntime } from './runtime'

export type EntryListPage = Awaited<ReturnType<EntriesResource['list']>>

export type HomepagePage = {
	kind: 'homepage'
	locale: LocaleCode
	homepage: Homepage | undefined
}

export type CollectionPage = {
	kind: 'collection'
	locale: LocaleCode
	collection: Collection
	page: number
	entries: EntryListPage
}

export type SitePage = HomepagePage | CollectionPage | EntryFound

export type PageResolution = SitePage | EntryMoved | EntryMissing

export type SitePathParams = {
	path: string | undefined
}

export type SitePathProps = {
	page: SitePage
}

export type SiteStaticPath = {
	params: SitePathParams
	props: SitePathProps
}

export type SitePageProps = Partial<SitePathProps>

export type SitePageRoute = {
	url: URL
	props: SitePageProps
}

export type SitePageContext = RushContext & SitePageRoute

type LocaleCollections = {
	locale: LocaleCode
	collections: Collection[]
}

const FIRST_PAGE = 1

const NO_PROPS: EntryRouteContext['props'] = {}

export function findHomepage(
	client: RushClient,
	locale: LocaleCode
): Promise<Homepage | undefined> {
	return optional(client.homepage.get({ locale }))
}

async function homepagePage(client: RushClient, locale: LocaleCode): Promise<HomepagePage> {
	return { kind: 'homepage', locale, homepage: await findHomepage(client, locale) }
}

async function collectionPage(
	client: RushClient,
	collection: Collection,
	locale: LocaleCode,
	page: number
): Promise<CollectionPage> {
	const entries = await client.entries.list(collection.slug, {
		locale,
		page,
		per_page: collection.items_per_page
	})
	return { kind: 'collection', locale, collection, page, entries }
}

function lastPage(page: CollectionPage): number {
	return Math.max(FIRST_PAGE, page.entries.meta.last_page)
}

async function collectionPages(
	client: RushClient,
	collection: Collection,
	locale: LocaleCode
): Promise<CollectionPage[]> {
	const first = await collectionPage(client, collection, locale, FIRST_PAGE)
	const rest = Array.from({ length: lastPage(first) - FIRST_PAGE }, (_, index) =>
		collectionPage(client, collection, locale, FIRST_PAGE + 1 + index)
	)
	return [first, ...(await Promise.all(rest))]
}

async function routedCollections(
	client: RushClient,
	urls: RushUrls,
	locale: LocaleCode
): Promise<LocaleCollections> {
	const collections = await client.collections.list({ locale })
	return { locale, collections: collections.filter((collection) => urls.routed(collection)) }
}

function collectionKeys(lists: LocaleCollections[]): string[] {
	const keys = new Map<string, string>()
	for (const collection of lists.flatMap((list) => list.collections)) {
		if (!keys.has(collection.id)) {
			keys.set(collection.id, collection.slug)
		}
	}
	return [...keys.values()]
}

function urlOf(page: SitePage, urls: RushUrls): string {
	switch (page.kind) {
		case 'homepage':
			return urls.homepage(page.locale)
		case 'collection':
			return urls.collection(page.collection, page.locale, page.page)
		case 'found':
			return urls.servedPath(page.entry, page.locale)
	}
}

function pathParam(url: string): string | undefined {
	const path = url.slice(1)
	return path === '' ? undefined : path
}

export async function collectSitePaths(
	client: RushClient,
	urls: RushUrls
): Promise<SiteStaticPath[]> {
	const homepages = await Promise.all(urls.locales.map((locale) => homepagePage(client, locale)))
	const lists = await Promise.all(
		urls.locales.map((locale) => routedCollections(client, urls, locale))
	)
	const listPages = await Promise.all(
		lists.flatMap(({ locale, collections }) =>
			collections.map((collection) => collectionPages(client, collection, locale))
		)
	)
	const entryPages = await Promise.all(
		collectionKeys(lists).map((key) => collectEntryPages(key, client, urls))
	)
	const entries = entryPages
		.flat()
		.map(({ locale, entry }): EntryFound => ({ kind: 'found', entry, locale }))
	const paths = new Map<string, SiteStaticPath>()
	for (const page of [...homepages, ...listPages.flat(), ...entries]) {
		const url = urlOf(page, urls)
		if (!paths.has(url)) {
			paths.set(url, { params: { path: pathParam(url) }, props: { page } })
		}
	}
	return [...paths.values()]
}

export async function sitePaths(rush?: RushClient): Promise<SiteStaticPath[]> {
	const { siteRuntime } = await import('./site-runtime')
	return collectSitePaths(rush ?? siteRuntime.onDemandClient(), siteRuntime.urls)
}

async function resolveCollection(
	runtime: RushRuntime,
	context: SitePageContext,
	match: CollectionMatch
): Promise<CollectionPage | EntryMissing> {
	const { locale } = match
	const client = runtime.clientIn(context, locale)
	const collection = await optional(client.collections.get(match.collection.slug, { locale }))
	if (collection === undefined) {
		return MISSING
	}
	const found = await collectionPage(client, collection, locale, match.page)
	return found.page > lastPage(found) ? MISSING : found
}

function resolveMatchedEntry(
	runtime: RushRuntime,
	context: SitePageContext,
	match: EntryMatch
): Promise<PageResolution> {
	const entryContext: EntryRouteContext = {
		locals: context.locals,
		currentLocale: context.currentLocale,
		isPrerendered: context.isPrerendered,
		params: context.params,
		props: NO_PROPS
	}
	return resolveEntry(entryContext, {
		locale: runtime.urls.localeParam(match.locale) ?? '',
		collection: match.collection.slug,
		slug: match.slug
	})
}

export async function resolvePage(context: SitePageContext): Promise<PageResolution> {
	const { page } = context.props
	if (page !== undefined) {
		return page
	}
	const runtime = runtimeOf(context.locals)
	const match = runtime.urls.match(context.url.pathname)
	switch (match?.kind) {
		case 'homepage':
			return homepagePage(runtime.clientIn(context, match.locale), match.locale)
		case 'collection':
			return resolveCollection(runtime, context, match)
		case 'entry':
			return resolveMatchedEntry(runtime, context, match)
		case undefined:
			return MISSING
	}
}
