import type { MiddlewareHandler } from 'astro'
import { RUSH_API_TOKEN, RUSH_API_URL, RUSH_SITE_ID } from 'astro:env/server'
import config from 'virtual:rush/config'
import { attachRuntime, createRushRuntime } from './runtime'
import { readApiSettings } from './settings'

const runtime = createRushRuntime({
	api: readApiSettings({ RUSH_API_URL, RUSH_SITE_ID, RUSH_API_TOKEN }),
	config
})

export const onRequest: MiddlewareHandler = (context, next) => {
	attachRuntime(context.locals, runtime)
	return next()
}
