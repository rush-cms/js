import type { MiddlewareHandler } from 'astro'
import { createRushMiddleware } from './preview'
import { siteRuntime } from './site-runtime'

export const onRequest: MiddlewareHandler = createRushMiddleware(siteRuntime)
