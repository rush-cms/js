import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import type { AstroComponentFactory } from 'astro/runtime/server/index.js'

export type RenderSetup = {
	props?: Record<string, unknown>
	locals?: object
	url?: string
	site?: string | undefined
}

export const SITE = 'https://site.example'

export async function renderComponent(
	component: AstroComponentFactory,
	setup: RenderSetup = {}
): Promise<string> {
	const site = 'site' in setup ? setup.site : SITE
	const container = await AstroContainer.create(
		site === undefined ? {} : { astroConfig: { site } }
	)
	return container.renderToString(component, {
		props: setup.props ?? {},
		locals: setup.locals ?? {},
		request: new Request(setup.url ?? `${SITE}/pt/artigos/ola-mundo`)
	})
}

export function metaContent(html: string, attribute: string, key: string): string[] {
	const pattern = new RegExp(`<meta ${attribute}="${key}" content="([^"]*)"`, 'g')
	return [...html.matchAll(pattern)].map((match) => match[1] ?? '')
}

export function linkHrefs(html: string, rel: string): string[] {
	const pattern = new RegExp(`<link rel="${rel}"[^>]*? href="([^"]*)"`, 'g')
	return [...html.matchAll(pattern)].map((match) => match[1] ?? '')
}
