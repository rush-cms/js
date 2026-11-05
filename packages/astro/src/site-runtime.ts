import { RUSH_API_TOKEN, RUSH_API_URL, RUSH_SITE_ID } from 'astro:env/server'
import config from 'virtual:rush/config'
import { createRushRuntime } from './runtime'
import { readApiSettings } from './settings'

export const siteRuntime = createRushRuntime({
	api: readApiSettings({ RUSH_API_URL, RUSH_SITE_ID, RUSH_API_TOKEN }),
	config
})
