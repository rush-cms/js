import { resolvePage } from '@rushcms/astro'
import type { EntryMissing, SitePage, SitePageContext } from '@rushcms/astro'
import type { APIContext } from 'astro'

export type RouteContext = SitePageContext & Pick<APIContext, 'redirect'>

export type RoutedPage = SitePage | EntryMissing

export async function routePage(context: RouteContext): Promise<RoutedPage | Response> {
	const page = await resolvePage(context)
	if (page.kind === 'moved') {
		return context.redirect(page.location, page.permanent ? 301 : 302)
	}
	return page
}
