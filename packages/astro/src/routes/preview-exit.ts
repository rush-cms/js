import type { APIRoute } from 'astro'
import { exitPreview } from '../preview'

export const prerender = false

export const GET: APIRoute = (context) => exitPreview(context)
