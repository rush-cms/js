import type { APIRoute } from 'astro'
import { startPreview } from '../preview'

export const prerender = false

export const GET: APIRoute = (context) => startPreview(context)
