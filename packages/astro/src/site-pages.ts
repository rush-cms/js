import { optional } from '@rushcms/client'
import type {
	Alternate,
	Collection,
	CollectionMatch,
	EntriesResource,
	EntryMatch,
	Homepage,
	LocaleCode,
	PaginationMeta,
	RushClient,
	RushUrls,
	Tag,
	TagsResource,
	TaxonomyMatch
} from '@rushcms/client'
import { MISSING, resolveEntry } from './entry-route'
import type { EntryFound, EntryMissing, EntryMoved, EntryRouteContext } from './entry-route'
import { firstByKey } from './first-by-key'
import { collectEntryPages } from './paths'
import { runtimeOf } from './runtime'
import type { RushContext, RushRuntime } from './runtime'
import { tagAlternates } from './alternate-links'
import { tagsByLocale } from './taxonomies'
import type { LocaleTags } from './taxonomies'

export type EntryListPage = Awaited<ReturnType<EntriesResource['list']>>

export type TaxonomyEntryPage = Awaited<ReturnType<TagsResource['entries']>>

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
	lastPage: number
	entries: EntryListPage
}

export type TaxonomyPage = {
	kind: 'taxonomy'
	locale: LocaleCode
	tag: Tag
	page: number
	lastPage: number
	entries: TaxonomyEntryPage
	alternates: Alternate[]
}

export type SitePage = HomepagePage | CollectionPage | TaxonomyPage | EntryFound

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
	props: SitePageProps
}

export type SitePageContext = RushContext & SitePageRoute

type LocaleCollections = {
	locale: LocaleCode
	collections: Collection[]
}

type PagedPage = {
	page: number
	lastPage: number
}

type PageLoader<P> = (page: number) => Promise<P>

type ListedPage = {
	url: string
	page: SitePage
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

function lastPageOf(meta: PaginationMeta): number {
	return Math.max(FIRST_PAGE, meta.last_page)
}

async function everyPage<P extends PagedPage>(load: PageLoader<P>): Promise<P[]> {
	const first = await load(FIRST_PAGE)
	const rest = Array.from({ length: first.lastPage - FIRST_PAGE }, (_, index) =>
		load(FIRST_PAGE + 1 + index)
	)
	return [first, ...(await Promise.all(rest))]
}

function withinLastPage<P extends PagedPage>(found: P): P | EntryMissing {
	return found.page > found.lastPage ? MISSING : found
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
	return {
		kind: 'collection',
		locale,
		collection,
		page,
		lastPage: lastPageOf(entries.meta),
		entries
	}
}

function collectionPages(
	client: RushClient,
	collection: Collection,
	locale: LocaleCode
): Promise<CollectionPage[]> {
	return everyPage((page) => collectionPage(client, collection, locale, page))
}

async function taxonomyPage(
	client: RushClient,
	tag: Tag,
	locale: LocaleCode,
	page: number,
	alternates: Alternate[]
): Promise<TaxonomyPage> {
	const entries = await client.tags.entries(tag.slug, { type: tag.type, locale, page })
	return {
		kind: 'taxonomy',
		locale,
		tag,
		page,
		lastPage: lastPageOf(entries.meta),
		entries,
		alternates
	}
}

function typePages(
	client: RushClient,
	urls: RushUrls,
	lists: LocaleTags[]
): Promise<TaxonomyPage[]>[] {
	return lists.flatMap(({ locale, tags }) =>
		tags.map((tag) => {
			const alternates = tagAlternates(lists, tag.id, urls)
			return everyPage((page) => taxonomyPage(client, tag, locale, page, alternates))
		})
	)
}

async function taxonomyPages(client: RushClient, urls: RushUrls): Promise<TaxonomyPage[]> {
	const groups = await Promise.all(
		urls.taxonomyTypes.map((type) => tagsByLocale(client, urls, type))
	)
	const pages = await Promise.all(groups.flatMap((lists) => typePages(client, urls, lists)))
	return pages.flat()
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
	return firstByKey(
		lists.flatMap((list) => list.collections),
		(collection) => collection.id
	).map((collection) => collection.slug)
}

function urlOf(page: SitePage, urls: RushUrls): string | undefined {
	switch (page.kind) {
		case 'homepage':
			return urls.homepage(page.locale)
		case 'collection':
			return urls.collection(page.collection, page.locale, page.page)
		case 'taxonomy':
			return urls.taxonomy(page.tag, page.locale, page.page)
		case 'found':
			return urls.servedPath(page.entry, page.locale)
	}
}

function listed(page: SitePage, urls: RushUrls): ListedPage[] {
	const url = urlOf(page, urls)
	return url === undefined ? [] : [{ url, page }]
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
	const taxonomies = await taxonomyPages(client, urls)
	const entries = entryPages
		.flat()
		.map(({ locale, entry }): EntryFound => ({ kind: 'found', entry, locale }))
	const pages = [...homepages, ...listPages.flat(), ...entries, ...taxonomies].flatMap((page) =>
		listed(page, urls)
	)
	return firstByKey(pages, ({ url }) => url).map(({ url, page }) => ({
		params: { path: pathParam(url) },
		props: { page }
	}))
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
	return withinLastPage(await collectionPage(client, collection, locale, match.page))
}

async function resolveTaxonomy(
	runtime: RushRuntime,
	context: SitePageContext,
	match: TaxonomyMatch
): Promise<TaxonomyPage | EntryMissing> {
	const { locale } = match
	const client = runtime.clientIn(context, locale)
	const lists = await tagsByLocale(client, runtime.urls, match.type)
	const tag = lists
		.find((list) => list.locale === locale)
		?.tags.find((candidate) => candidate.slug === match.slug)
	if (tag === undefined) {
		return MISSING
	}
	const alternates = tagAlternates(lists, tag.id, runtime.urls)
	return withinLastPage(await taxonomyPage(client, tag, locale, match.page, alternates))
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
		url: context.url,
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
		case 'taxonomy':
			return resolveTaxonomy(runtime, context, match)
		case 'entry':
			return resolveMatchedEntry(runtime, context, match)
		case undefined:
			return MISSING
	}
}
