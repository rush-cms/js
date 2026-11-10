import type { LocaleCode, RushClient, RushUrls, Tag, TagType } from '@rushcms/client'

export type LocaleTags = {
	locale: LocaleCode
	tags: Tag[]
}

async function listedTags(client: RushClient, type: TagType, locale: LocaleCode): Promise<Tag[]> {
	const tags = await client.tags.list({ type, locale })
	return tags.filter((tag) => tag.entry_count > 0)
}

async function localeTags(
	client: RushClient,
	type: TagType,
	locale: LocaleCode
): Promise<LocaleTags> {
	return { locale, tags: await listedTags(client, type, locale) }
}

export function tagsByLocale(
	client: RushClient,
	urls: RushUrls,
	type: TagType
): Promise<LocaleTags[]> {
	return Promise.all(urls.locales.map((locale) => localeTags(client, type, locale)))
}
