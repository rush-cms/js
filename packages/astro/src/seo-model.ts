import { alternates, toBcp47 } from '@rushcms/client'
import { isRecord } from '@rushcms/client/internal'
import type { Alternate, Entry, Homepage, LocaleCode, Media, RushUrls } from '@rushcms/client'
import type { SeoFieldMap } from './config'
import { absoluteUrl } from './site-origin'

export type SeoSettings = {
	urls: RushUrls
	seo: Readonly<Record<string, SeoFieldMap>>
	defaultLocale: LocaleCode
	site: URL
}

export type SeoImage = {
	url: string
	width?: number
	height?: number
	alt?: string
}

export type TwitterCard = 'summary' | 'summary_large_image'

export type SeoTags = {
	title?: string
	documentTitle?: string
	description?: string
	image?: SeoImage
	type: 'article' | 'website'
	card: TwitterCard
	canonical: string
	locale: string
	alternateLocales: string[]
	alternates: Alternate[]
}

export type SeoPage = {
	locale: LocaleCode
	canonical: string
	title?: string | undefined
	description?: string | undefined
	alternates?: Alternate[] | undefined
	image?: Media | undefined
}

export type SeoOptions = {
	titleSuffix?: string | undefined
}

export type SeoEntryProps = SeoOptions & {
	entry: Entry
	homepage?: never
	page?: never
}

export type SeoHomepageProps = SeoOptions & {
	homepage: Homepage
	entry?: never
	page?: never
}

export type SeoPageProps = SeoOptions & {
	page: SeoPage
	entry?: never
	homepage?: never
}

export type SeoProps = SeoEntryProps | SeoHomepageProps | SeoPageProps

type SeoBase = Pick<SeoTags, 'type' | 'canonical' | 'locale' | 'alternates'>

function filled(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

function fieldMapOf(entry: Entry, { urls, seo }: SeoSettings): SeoFieldMap {
	const key = urls.collectionKeys(entry).find((candidate) => Object.hasOwn(seo, candidate))
	return (key === undefined ? undefined : seo[key]) ?? {}
}

function mappedText(entry: Entry, field: string | undefined): string | undefined {
	return field === undefined ? undefined : filled(entry.data[field])
}

function mediaByUrl(entry: Entry, url: string): Media | undefined {
	return Object.values(entry.media).find((media) => media.url === url)
}

function describedImage(media: Media | undefined, fallbackUrl?: string): SeoImage | undefined {
	const url = media?.url ?? fallbackUrl
	if (url === undefined || url === '') {
		return undefined
	}
	const image: SeoImage = { url }
	if (media?.width !== undefined) {
		image.width = media.width
	}
	if (media?.height !== undefined) {
		image.height = media.height
	}
	const alt = filled(media?.alt)
	if (alt !== undefined) {
		image.alt = alt
	}
	return image
}

function mappedImage(entry: Entry, field: string | undefined): SeoImage | undefined {
	if (field === undefined) {
		return undefined
	}
	const value: unknown = entry.data[field]
	if (isRecord(value)) {
		return describedImage(value)
	}
	const url = filled(value)
	return url === undefined ? undefined : describedImage(mediaByUrl(entry, url), url)
}

export function ogLocale(code: LocaleCode): string {
	return toBcp47(code).replaceAll('-', '_')
}

function seoTags(base: SeoBase, site: URL): SeoTags {
	const locale = ogLocale(base.locale)
	const alternateLocales = [
		...new Set(base.alternates.map((alternate) => ogLocale(alternate.locale)))
	].filter((alternate) => alternate !== locale)
	return {
		...base,
		canonical: absoluteUrl(base.canonical, site),
		locale,
		alternateLocales,
		card: 'summary'
	}
}

function withText(tags: SeoTags, title: string | undefined, description: string | undefined) {
	if (title !== undefined) {
		tags.title = title
	}
	if (description !== undefined) {
		tags.description = description
	}
}

function withImage(tags: SeoTags, image: SeoImage | undefined, site: URL): SeoTags {
	if (image !== undefined) {
		tags.image = { ...image, url: absoluteUrl(image.url, site) }
		tags.card = 'summary_large_image'
	}
	return tags
}

export function entrySeo(entry: Entry, settings: SeoSettings): SeoTags {
	const { urls, site } = settings
	const fields = fieldMapOf(entry, settings)
	const tags = seoTags(
		{
			type: 'article',
			canonical: urls.entry(entry),
			locale: entry.locale,
			alternates: alternates(entry, urls)
		},
		site
	)
	withText(
		tags,
		mappedText(entry, fields.title) ?? filled(entry.title),
		mappedText(entry, fields.description) ?? filled(entry.excerpt)
	)
	return withImage(
		tags,
		mappedImage(entry, fields.image) ?? describedImage(entry.featured_image),
		site
	)
}

export function homepageTitle(homepage: Homepage | undefined): string | undefined {
	return filled(homepage?.meta?.title)
}

export function homepageSeo(homepage: Homepage, settings: SeoSettings): SeoTags {
	const { urls, site } = settings
	const meta = homepage.meta
	const tags = seoTags(
		{
			type: 'website',
			canonical: urls.homepage(homepage.locale),
			locale: homepage.locale,
			alternates: alternates(homepage, urls)
		},
		site
	)
	withText(tags, homepageTitle(homepage), filled(meta?.description))
	const image = filled(meta?.og_image)
	return withImage(tags, image === undefined ? undefined : { url: image }, site)
}

export function pageSeo(page: SeoPage, { site }: SeoSettings): SeoTags {
	const tags = seoTags(
		{
			type: 'website',
			canonical: page.canonical,
			locale: page.locale,
			alternates: page.alternates ?? []
		},
		site
	)
	withText(tags, filled(page.title), filled(page.description))
	return withImage(tags, describedImage(page.image), site)
}

function formSeo(props: SeoProps, settings: SeoSettings): SeoTags {
	if (props.entry !== undefined) {
		return entrySeo(props.entry, settings)
	}
	return props.homepage !== undefined
		? homepageSeo(props.homepage, settings)
		: pageSeo(props.page, settings)
}

export function seoOf(props: SeoProps, settings: SeoSettings): SeoTags {
	const tags = formSeo(props, settings)
	if (tags.title !== undefined) {
		tags.documentTitle = `${tags.title}${props.titleSuffix ?? ''}`
	}
	return tags
}
