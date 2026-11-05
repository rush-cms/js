import type { DataOf, OperationId, PageOf, QueryOf, Schemas } from './contract'

export type Entry = Schemas['Entry']
export type Site = Schemas['Site']
export type Homepage = Schemas['Homepage']
export type Navigation = Schemas['Navigation']
export type NavigationItem = Schemas['NavigationItem']
export type SiteOptionGroup = Schemas['SiteOptionGroup']
export type Tag = Schemas['Tag']
export type Collection = Schemas['Collection']
export type Block = Schemas['Block']
export type Database = Schemas['Database']
export type DatabaseDetail = Schemas['DatabaseDetail']
export type LinkPage = Schemas['LinkPage']
export type Form = Schemas['Form']
export type FormSubmission = Schemas['FormSubmission']
export type FormSubmitResult = Schemas['FormSubmitResult']
export type Media = Schemas['Media']
export type PaginationMeta = Schemas['PaginationMeta']
export type Perspective = Schemas['Perspective']
export type LocaleCode = Schemas['LocaleCode']

export type RushFetch = (input: string, init: RequestInit) => Promise<Response>

export type EtagRecord = {
	etag: string
	body: unknown
}

export type EtagStore = {
	get(key: string): Promise<EtagRecord | undefined>
	set(key: string, value: EtagRecord): Promise<void>
}

export type RushRoutes = Record<string, string>

export type RushLocalePaths = Record<LocaleCode, string>

export type RushClientConfig = {
	url: string
	siteId: string
	token: string
	locale?: LocaleCode
	perspective?: Perspective
	fetch?: RushFetch
	memo?: boolean
	etagStore?: EtagStore
	routes?: RushRoutes
	localePaths?: RushLocalePaths
}

export type RequestOptions = QueryOf<'getEntry'>
export type PerspectiveOptions = QueryOf<'getSite'>
export type HomepageOptions = QueryOf<'getHomepage'>
export type EntryListOptions = QueryOf<'listEntries'>
export type EntrySearchOptions = Omit<QueryOf<'searchEntries'>, 'q'>
export type EntryWalkOptions = Omit<EntryListOptions, 'page' | 'per_page'>
export type TagListOptions = QueryOf<'listTags'>
export type TagEntriesOptions = QueryOf<'listTagEntries'>

export type FormSubmitOptions = {
	clientIp?: string
	captchaToken?: string
}

export type FormSubmitData = FormSubmission | FormData

export type CatalogResource<L extends OperationId, G extends OperationId> = {
	list(options?: QueryOf<L>): Promise<DataOf<L>>
	get(key: string, options?: QueryOf<G>): Promise<DataOf<G>>
}

export type SiteResource = {
	get(options?: PerspectiveOptions): Promise<Site>
}

export type HomepageResource = {
	get(options?: HomepageOptions): Promise<Homepage>
}

export type EntriesResource = {
	list(collection: string, options?: EntryListOptions): Promise<PageOf<'listEntries'>>
	get(collection: string, slug: string, options?: RequestOptions): Promise<Entry>
	search(
		collection: string,
		query: string,
		options?: EntrySearchOptions
	): Promise<PageOf<'searchEntries'>>
	all(collection: string, options?: EntryWalkOptions): AsyncGenerator<Entry, void, undefined>
}

export type TagsResource = {
	list(options?: TagListOptions): Promise<Tag[]>
	entries(tag: string, options?: TagEntriesOptions): Promise<PageOf<'listTagEntries'>>
}

export type FormsResource = CatalogResource<'listForms', 'getForm'> & {
	submit(
		key: string,
		data: FormSubmitData,
		options?: FormSubmitOptions
	): Promise<FormSubmitResult>
}

export type RushClient = {
	readonly routes: RushRoutes
	readonly localePaths: RushLocalePaths
	readonly site: SiteResource
	readonly collections: CatalogResource<'listCollections', 'getCollection'>
	readonly entries: EntriesResource
	readonly homepage: HomepageResource
	readonly navigations: CatalogResource<'listNavigations', 'getNavigation'>
	readonly siteOptions: CatalogResource<'listSiteOptionGroups', 'getSiteOptionGroup'>
	readonly tags: TagsResource
	readonly blocks: CatalogResource<'listBlocks', 'getBlock'>
	readonly databases: CatalogResource<'listDatabases', 'getDatabase'>
	readonly linkPages: CatalogResource<'listLinkPages', 'getLinkPage'>
	readonly forms: FormsResource
}
