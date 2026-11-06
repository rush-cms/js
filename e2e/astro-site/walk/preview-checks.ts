import assert from 'node:assert/strict'
import type { Cookie, HTTPResponse, Page } from 'puppeteer-core'
import type { Walker } from './browser.ts'
import type { WalkEnv } from './env.ts'
import { ADMIN_URL, PREVIEW_URL, SITE_URL } from './env.ts'
import { withRestore } from './restore.ts'

const ENTRY_PATH = '/pt/artigos/ola-mundo'
const ENTRY_TITLE = 'Olá, mundo'
const PUBLISHED_EXCERPT = 'Olá, mundo (pt_BR)'
const PREVIEW_COOKIE = 'rush_preview'
const EXCERPT_FIELD = '#entry-excerpt'

function redirectCount(): number {
	const [navigation] = performance.getEntriesByType('navigation')
	return navigation instanceof PerformanceNavigationTiming ? navigation.redirectCount : -1
}

async function excerpt(page: Page): Promise<string | null> {
	return page.$eval('[data-excerpt]', (element) => element.textContent)
}

function isEntrySave(response: HTTPResponse): boolean {
	const method = response.request().method()
	return (method === 'PUT' || method === 'PATCH') && response.url().includes('/entries/')
}

async function openEntryEditor(page: Page, env: WalkEnv): Promise<void> {
	await page.goto(`${ADMIN_URL}/login`, { waitUntil: 'networkidle0' })
	await page.type('input[type="email"]', env.adminEmail)
	await page.type('input[type="password"]', env.adminPassword)
	await Promise.all([page.waitForNavigation(), page.click('button[type="submit"]')])
	await (await page.waitForSelector('a::-p-text(Blog)'))?.click()
	await (await page.waitForSelector(`tr ::-p-text(${ENTRY_TITLE})`))?.click()
	await page.waitForSelector(EXCERPT_FIELD)
	await page.waitForNetworkIdle()
}

async function saveExcerpt(page: Page, text: string): Promise<void> {
	await page.click(EXCERPT_FIELD, { count: 3 })
	await page.keyboard.press('Backspace')
	await page.type(EXCERPT_FIELD, text)
	const [saved] = await Promise.all([
		page.waitForResponse(isEntrySave),
		page.click('button::-p-text(Save)')
	])
	assert.ok(saved.ok(), `admin save answered ${saved.status()}`)
}

async function openPreviewTab(walker: Walker, admin: Page): Promise<Page> {
	await admin.click('button[aria-label="Publishing options"]')
	const item = await admin.waitForSelector('[role="menuitem"]::-p-text(Preview)')
	const [target] = await Promise.all([
		walker.browser.waitForTarget((candidate) => candidate.url().startsWith(PREVIEW_URL)),
		item?.click()
	])
	const preview = await target.page()
	assert.ok(preview, 'the preview tab has no page')
	await preview.waitForSelector('[data-rush-preview]')
	return preview
}

async function previewCookie(walker: Walker): Promise<Cookie | undefined> {
	return (await walker.browser.cookies()).find((cookie) => cookie.name === PREVIEW_COOKIE)
}

export function previewFromAdmin(walker: Walker, env: WalkEnv): Promise<string> {
	return walker.withPage(async (admin) => {
		await openEntryEditor(admin, env)
		await saveExcerpt(admin, PUBLISHED_EXCERPT)
		const draft = `Rascunho ${Date.now()}`
		return withRestore(
			() => saveExcerpt(admin, PUBLISHED_EXCERPT),
			async () => {
				await saveExcerpt(admin, draft)
				return previewDraft(walker, admin, draft)
			}
		)
	})
}

async function previewDraft(walker: Walker, admin: Page, draft: string): Promise<string> {
	const editorShot = await walker.shot(admin, '12-admin-draft-saved')

	const preview = await openPreviewTab(walker, admin)
	try {
		assert.equal(new URL(preview.url()).pathname, ENTRY_PATH)
		assert.equal(await preview.evaluate(redirectCount), 1)
		const reloaded = await preview.reload()
		assert.equal(reloaded?.headers()['x-robots-tag'], 'noindex')
		assert.equal(await excerpt(preview), draft)
		assert.ok((await previewCookie(walker))?.httpOnly, 'rush_preview cookie is HttpOnly')
		const previewShot = await walker.shot(preview, '13-preview-draft')

		await walker.withPage(async (published) => {
			await published.goto(`${SITE_URL}${ENTRY_PATH}`)
			assert.equal(await excerpt(published), PUBLISHED_EXCERPT)
		})

		await Promise.all([preview.waitForNavigation(), preview.click('[data-rush-preview] a')])
		assert.equal(new URL(preview.url()).pathname, ENTRY_PATH)
		assert.equal(await preview.$('[data-rush-preview]'), null)
		assert.equal(await excerpt(preview), PUBLISHED_EXCERPT)
		assert.equal(await previewCookie(walker), undefined)
		const exitShot = await walker.shot(preview, '14-preview-exited')
		return `admin Save (draft excerpt "${draft}") -> Publishing options > Preview opened ${PREVIEW_URL}/_rush/preview?token=… redirected once to ${ENTRY_PATH} with banner, draft excerpt, X-Robots-Tag noindex, HttpOnly rush_preview; ${SITE_URL} still shows "${PUBLISHED_EXCERPT}"; Exit -> published page, no banner, cookie cleared [${editorShot}, ${previewShot}, ${exitShot}]`
	} finally {
		await preview.close().catch(() => undefined)
	}
}
