import { describe, expect, it } from 'vitest'
import PreviewBanner from '../src/components/preview-banner.astro'
import { attachRuntime, createRushRuntime } from '../src/runtime'
import type { RushRuntime } from '../src/runtime'
import { renderComponent } from './fixtures/render'
import { siteConfig } from './fixtures/runtime'

const API = { url: 'http://127.0.0.1:1', siteId: 'site', token: 'delivery' }
const TOKEN = 'rush_prv_e30.sig'

function runtimeFor(preview: boolean): RushRuntime {
	return createRushRuntime({ api: API, config: siteConfig({ preview }) })
}

function render(runtime: RushRuntime, props: Record<string, unknown> = {}) {
	const locals = {}
	attachRuntime(locals, runtime)
	return renderComponent(PreviewBanner, {
		props,
		locals,
		url: 'https://site.example/pt/artigos/ola-mundo'
	})
}

describe('PreviewBanner', () => {
	it('renders with an exit link back to the current page in an active preview session', async () => {
		const html = await render(runtimeFor(true).preview(TOKEN))
		expect(html).toContain('data-rush-preview')
		expect(html).toContain('href="/_rush/preview/exit?return=%2Fpt%2Fartigos%2Fola-mundo"')
	})

	it('takes its texts from props', async () => {
		const html = await render(runtimeFor(true).preview(TOKEN), {
			label: 'Rascunho',
			exitLabel: 'Sair'
		})
		expect(html).toContain('Rascunho')
		expect(html).toContain('>Sair</a>')
	})

	it('renders nothing in preview mode without a cookie session', async () => {
		expect(await render(runtimeFor(true))).not.toContain('data-rush-preview')
	})

	it('renders nothing outside preview mode', async () => {
		expect(await render(runtimeFor(false))).not.toContain('data-rush-preview')
		expect(await render(runtimeFor(false).preview(TOKEN))).not.toContain('data-rush-preview')
	})

	it('renders nothing once the session fell back to published content', async () => {
		const session = { expired: true }
		expect(await render(runtimeFor(true).preview(TOKEN, session))).not.toContain(
			'data-rush-preview'
		)
	})
})
