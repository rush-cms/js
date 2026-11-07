import type { APIRoute } from 'astro'
import { RUSH_PREVIEW } from 'astro:env/server'

export const GET: APIRoute = ({ site }) => {
	const rules = RUSH_PREVIEW ? 'Disallow: /' : 'Allow: /'
	const sitemap = site === undefined ? '' : `\nSitemap: ${new URL('/sitemap.xml', site).href}\n`
	return new Response(`User-agent: *\n${rules}\n${sitemap}`, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' }
	})
}
