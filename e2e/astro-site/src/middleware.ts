import { defineMiddleware } from 'astro:middleware'
import { hasUnknownLocale } from './urls'

export const onRequest = defineMiddleware((context, next) =>
	hasUnknownLocale(context.params) ? new Response(null, { status: 404 }) : next()
)
