import { sitemapResponse } from '@rushcms/astro'
import type { APIRoute } from 'astro'

export const GET: APIRoute = (context) => sitemapResponse({ context })
