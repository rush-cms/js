import type { LocaleCode, RushClient, Tag, TagType } from '@rushcms/client'

export async function listedTags(
	client: RushClient,
	type: TagType,
	locale: LocaleCode
): Promise<Tag[]> {
	const tags = await client.tags.list({ type, locale })
	return tags.filter((tag) => tag.entry_count > 0)
}
