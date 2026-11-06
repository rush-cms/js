import { createClient } from '@rushcms/client'
import { RUSH_API_TOKEN, RUSH_API_URL, RUSH_SITE_ID } from 'astro:env/server'

export const buildClient = createClient({
	url: RUSH_API_URL,
	siteId: RUSH_SITE_ID,
	token: RUSH_API_TOKEN,
	memo: true
})
