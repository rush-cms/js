import assert from 'node:assert/strict'
import type { Walker } from '../../walk-kit/browser.ts'
import { openOk } from '../../walk-kit/browser.ts'
import { textOf } from '../../walk-kit/dom.ts'
import { PREVIEW_BANNER, assertPreviewLanding, exitPreview } from '../../walk-kit/preview.ts'
import { PREVIEW_URL, SITE_URL } from './env.ts'
import { httpStatus } from './http.ts'
import type { BuildResult } from './project.ts'

export type PreviewPage = {
	path: string
	title: string
}

const IGNORED_PATHS_WARNING = 'getStaticPaths() ignored'
const PRERENDERED_PAGE = /\.(html|xml|txt) \(\+/

export function builtWithoutWarnings(build: BuildResult, preview: boolean): Promise<string> {
	assert.equal(build.code, 0, `build exited ${build.code}\n${build.output.slice(-3000)}`)
	const lines = build.output.split('\n')
	const warnings = lines.filter((line) => line.includes(IGNORED_PATHS_WARNING)).length
	if (preview) {
		assert.equal(warnings, 0, `${warnings} "${IGNORED_PATHS_WARNING}" lines`)
	}
	const prerendered = lines.filter((line) => PRERENDERED_PAGE.test(line)).length
	return Promise.resolve(
		`exit 0, ${prerendered} prerendered pages, ${warnings} "${IGNORED_PATHS_WARNING}" lines`
	)
}

export function previewOnDemand(walker: Walker, page: PreviewPage): Promise<string> {
	return walker.withPage(async (tab) => {
		const response = await openOk(tab, `${PREVIEW_URL}${page.path}`)
		assert.equal(response.headers()['x-robots-tag'], 'noindex')
		assert.equal(await tab.$(PREVIEW_BANNER), null)
		assert.equal(await textOf(tab, 'h1'), page.title)
		const robots = await (await fetch(`${PREVIEW_URL}/robots.txt`)).text()
		assert.ok(robots.includes('Disallow: /'), `preview robots.txt: ${robots}`)
		return `${PREVIEW_URL}${page.path} 200 on demand, X-Robots-Tag noindex, no banner without a session, "${page.title}"; robots.txt disallows /`
	})
}

export function previewDraft(
	walker: Walker,
	link: string,
	draft: PreviewPage,
	shot: string
): Promise<string> {
	return walker.withPage(async (tab) => {
		const url = new URL(link)
		assert.equal(url.origin, PREVIEW_URL)
		assert.equal(url.pathname, '/_rush/preview')
		assert.equal(
			await httpStatus(`${SITE_URL}${draft.path}`),
			404,
			'the draft is not on the production site'
		)
		await tab.goto(link)
		await assertPreviewLanding(walker, tab, draft.path)
		assert.equal(await textOf(tab, 'h1'), draft.title)
		const previewShot = await walker.shot(tab, `${shot}-draft`)
		const exited = await exitPreview(walker, tab, draft.path)
		assert.equal(exited, 404, 'the draft is gone once the preview ends')
		const exitShot = await walker.shot(tab, `${shot}-exited`)
		return `admin preview link ${url.origin}${url.pathname}?token=… -> one redirect to ${draft.path}: banner, "${draft.title}", X-Robots-Tag noindex, HttpOnly rush_preview; ${SITE_URL}${draft.path} 404; exit -> ${draft.path} ${exited}, no banner, cookie cleared [${previewShot}, ${exitShot}]`
	})
}
