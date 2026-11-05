import { isRecord, toBcp47 } from '@rushcms/client'
import type { Entry, Homepage, LocaleCode, Media, RushUrls } from '@rushcms/client'
import type { SeoFieldMap } from './config'
import { absoluteLinks, hreflangLinks } from './alternate-links'
import type { HreflangLink } from './alternate-links'
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

export type SeoTags = {
	title?: string
	description?: string
	image?: SeoImage
	type: 'article' | 'website'
	canonical: string
	locale: string
	alternateLocales: string[]
	links: HreflangLink[]
}

function filled(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

function fieldMapOf(entry: Entry, seo: SeoSettings['seo']): SeoFieldMap {
	const keys = [
		entry.collection.id,
		entry.collection.slug,
		...Object.values(entry.translations).map((item) => item.collection_slug)
	]
	const key = keys.find((candidate) => Object.hasOwn(seo, candidate))
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

function entryImage(entry: Entry, field: string | undefined): SeoImage | undefined {
	if (field === undefined) {
		return describedImage(entry.featured_image)
	}
	const value: unknown = entry.data[field]
	if (isRecord(value)) {
		return describedImage(value)
	}
	const url = filled(value)
	return url === undefined ? undefined : describedImage(mediaByUrl(entry, url), url)
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
	}
	return tags
}

export function entrySeo(entry: Entry, settings: SeoSettings): SeoTags {
	const { urls, site } = settings
	const fields = fieldMapOf(entry, settings.seo)
	const tags: SeoTags = {
		type: 'article',
		canonical: absoluteUrl(urls.entry(entry), site),
		locale: toBcp47(entry.locale),
		alternateLocales: Object.keys(entry.translations)
			.filter((locale) => locale !== entry.locale)
			.map(toBcp47),
		links: absoluteLinks(hreflangLinks(entry, urls, settings.defaultLocale), site)
	}
	withText(
		tags,
		mappedText(entry, fields.title) ?? filled(entry.title),
		mappedText(entry, fields.description) ?? filled(entry.excerpt)
	)
	return withImage(tags, entryImage(entry, fields.image), site)
}

export function homepageSeo(homepage: Homepage, settings: SeoSettings): SeoTags {
	const { urls, site } = settings
	const meta = homepage.meta
	const tags: SeoTags = {
		type: 'website',
		canonical: absoluteUrl(urls.homepage(homepage.locale), site),
		locale: toBcp47(homepage.locale),
		alternateLocales: [],
		links: []
	}
	withText(tags, filled(meta?.title), filled(meta?.description))
	const image = filled(meta?.og_image)
	return withImage(tags, image === undefined ? undefined : { url: image }, site)
}
