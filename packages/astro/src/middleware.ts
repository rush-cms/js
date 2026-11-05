import type { MiddlewareHandler } from 'astro'
import { RUSH_API_TOKEN, RUSH_API_URL, RUSH_SITE_ID } from 'astro:env/server'
import config from 'virtual:rush/config'
import { createRushMiddleware } from './preview'
import { createRushRuntime } from './runtime'
import { readApiSettings } from './settings'

export const onRequest: MiddlewareHandler = createRushMiddleware(
	createRushRuntime({
		api: readApiSettings({ RUSH_API_URL, RUSH_SITE_ID, RUSH_API_TOKEN }),
		config
	})
)
