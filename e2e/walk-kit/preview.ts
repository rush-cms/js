import assert from 'node:assert/strict'
import type { Cookie, Page } from 'puppeteer-core'
import type { Walker } from './browser.ts'

const PREVIEW_COOKIE = 'rush_preview'

export const PREVIEW_BANNER = '[data-rush-preview]'

function redirectCount(): number {
	const [navigation] = performance.getEntriesByType('navigation')
	return navigation instanceof PerformanceNavigationTiming ? navigation.redirectCount : -1
}

export async function previewCookie(walker: Walker): Promise<Cookie | undefined> {
	return (await walker.browser.cookies()).find((cookie) => cookie.name === PREVIEW_COOKIE)
}

export async function assertPreviewLanding(
	walker: Walker,
	preview: Page,
	path: string
): Promise<void> {
	assert.equal(new URL(preview.url()).pathname, path)
	assert.equal(await preview.evaluate(redirectCount), 1)
	const reloaded = await preview.reload()
	assert.equal(reloaded?.headers()['x-robots-tag'], 'noindex')
	assert.notEqual(await preview.$(PREVIEW_BANNER), null, 'the preview banner is shown')
	assert.ok((await previewCookie(walker))?.httpOnly, 'rush_preview cookie is HttpOnly')
}

export async function exitPreview(walker: Walker, preview: Page, path: string): Promise<number> {
	const [response] = await Promise.all([
		preview.waitForNavigation(),
		preview.click(`${PREVIEW_BANNER} a`)
	])
	assert.equal(new URL(preview.url()).pathname, path)
	assert.equal(await preview.$(PREVIEW_BANNER), null)
	assert.equal(await previewCookie(walker), undefined)
	return response?.status() ?? 0
}
