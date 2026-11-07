import type { CollectionPage, HomepagePage } from '@rushcms/astro'
import type { CollectionRef, Entry, LocaleCode, RushUrls } from '@rushcms/client'
import GenericList from './collection.astro'
import GenericEntry from './entry.astro'

export type HomeViewProps = {
	page: HomepagePage
}

export type ListViewProps = {
	page: CollectionPage
}

export type EntryViewProps = {
	entry: Entry
	locale: LocaleCode
}

export type ListView = (props: ListViewProps) => unknown

export type EntryView = (props: EntryViewProps) => unknown

export type CollectionViews = {
	list: ListView
	entry: EntryView
}

export type ViewMap = Record<string, Partial<CollectionViews>>

const generic: CollectionViews = { list: GenericList, entry: GenericEntry }

// TODO: map a collection id or slug (any locale) to its own views, e.g. `posts: { entry: PostView }`.
const views: ViewMap = {}

export function viewsFor(collection: CollectionRef | undefined, urls: RushUrls): CollectionViews {
	const key =
		collection === undefined
			? undefined
			: urls.collectionKeys(collection).find((candidate) => Object.hasOwn(views, candidate))
	return { ...generic, ...(key === undefined ? {} : views[key]) }
}
