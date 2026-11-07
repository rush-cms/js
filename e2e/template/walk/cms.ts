import type {
	AdminApi,
	EntryTranslationWrite,
	NavigationItemWrite,
	Translated
} from '../../walk-kit/admin-api.ts'
import { withRestore } from '../../walk-kit/restore.ts'
import { PREVIEW_URL } from './env.ts'

export type FixtureContent = {
	restore(): Promise<void>
}

export type FreshSite = {
	siteId: string
	token: string
	collectionId: string
}

export type Draft = {
	siteId: string
	collectionId: string
	locales: string[]
	locale: string
	translation: EntryTranslationWrite
}

export const SITE_A_LOCALES = ['pt_BR', 'en', 'es']
export const SITE_B_LOCALES = ['en']
export const BLOG_PAGE_SIZE = 2
const SEEDED_PAGE_SIZE = 15

const PREVIEW_BASE = `${PREVIEW_URL}/_rush/preview?token={token}&locale={locale}`
const ENTRY_PREVIEW = `${PREVIEW_BASE}&collection={collection}&slug={slug}`

function inEachLocale(pt: string, en: string, es: string): Translated {
	return { pt_BR: pt, en, es }
}

function footerItems(servicesId: string): NavigationItemWrite[] {
	return [
		{
			label: inEachLocale('Política', 'Policy', 'Política'),
			type: 'url',
			url: 'https://example.org/policy',
			target: '_blank',
			nofollow: true,
			noreferrer: true,
			class: 'footer-external',
			attributes: [
				{ name: 'rel', value: 'me' },
				{ name: 'data-track', value: 'footer' }
			],
			children: []
		},
		{
			label: inEachLocale('Serviços', 'Services', 'Servicios'),
			type: 'collection',
			collection_id: servicesId,
			children: []
		}
	]
}

export async function prepareSiteA(admin: AdminApi, siteId: string): Promise<FixtureContent> {
	const blogId = await admin.collectionId(siteId, 'pt_BR', 'artigos')
	const servicesId = await admin.collectionId(siteId, 'pt_BR', 'servicos')
	await admin.updateCollection(siteId, blogId, {
		items_per_page: BLOG_PAGE_SIZE,
		site_locales: SITE_A_LOCALES
	})
	const footerId = await admin.createNavigation(siteId, {
		name: inEachLocale('Rodapé', 'Footer', 'Pie'),
		key: 'footer',
		items: footerItems(servicesId),
		is_active: true
	})
	return {
		restore: async () => {
			await admin.deleteNavigation(siteId, footerId)
			await admin.updateCollection(siteId, blogId, {
				items_per_page: SEEDED_PAGE_SIZE,
				site_locales: SITE_A_LOCALES
			})
		}
	}
}

export async function createFreshSite(admin: AdminApi): Promise<FreshSite> {
	const siteId = await admin.createSite({
		name: 'Fresh T9',
		slug: `fresh-t9-${Date.now()}`,
		settings: {
			default_locale: 'en',
			locales: SITE_B_LOCALES,
			homepage_preview_url_template: PREVIEW_BASE
		}
	})
	const token = await admin.createDeliveryToken(siteId, 'template walk')
	const collectionId = await admin.createCollection(siteId, {
		name: { en: 'Posts' },
		slug: { en: 'posts' },
		preview_url_template: ENTRY_PREVIEW,
		site_locales: SITE_B_LOCALES
	})
	return { siteId, token, collectionId }
}

export async function withDraft<T>(
	admin: AdminApi,
	draft: Draft,
	use: (previewLink: string) => Promise<T>
): Promise<T> {
	const entryId = await admin.createEntry(draft.siteId, draft.collectionId, {
		site_locales: draft.locales,
		translations: { [draft.locale]: draft.translation }
	})
	return withRestore(
		() => admin.deleteEntry(draft.siteId, draft.collectionId, entryId),
		async () =>
			use(
				await admin.previewLink(
					draft.siteId,
					`/collections/${draft.collectionId}/entries/${entryId}`,
					draft.locale
				)
			)
	)
}
