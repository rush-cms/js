import type { APIRoute } from 'astro'
import { submitForm } from '../forms'

export const prerender = false

export const POST: APIRoute = (context) => submitForm(context)
