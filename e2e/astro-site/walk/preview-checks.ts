import assert from 'node:assert/strict'
import type { HTTPResponse, Page, Walker } from '../../walk-kit/browser.ts'
import type { WalkEnv } from './env.ts'
import { ADMIN_URL, PREVIEW_URL, SITE_URL } from './env.ts'
import { PREVIEW_BANNER, assertPreviewLanding, exitPreview } from '../../walk-kit/preview.ts'
import { withRestore } from '../../walk-kit/restore.ts'

const ENTRY_PATH = '/pt/artigos/ola-mundo'
const ENTRY_TITLE = 'Olá, mundo'
const PUBLISHED_EXCERPT = 'Olá, mundo (pt_BR)'
const EXCERPT_FIELD = '#entry-excerpt'

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
	await preview.waitForSelector(PREVIEW_BANNER)
	return preview
}

const NON_PREFIX_LOCALES = ['pt_BR', 'PT']

export function unknownLocaleOnPreview(walker: Walker): Promise<string> {
	return walker.withPage(async (page) => {
		const seen: string[] = []
		for (const locale of NON_PREFIX_LOCALES) {
			const response = await page.goto(`${PREVIEW_URL}/${locale}/`)
			assert.equal(response?.status(), 404, `GET /${locale}/`)
			seen.push(`/${locale}/ ${response.status()}`)
		}
		return seen.join('; ')
	})
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
		await assertPreviewLanding(walker, preview, ENTRY_PATH)
		assert.equal(await excerpt(preview), draft)
		const previewShot = await walker.shot(preview, '13-preview-draft')

		await walker.withPage(async (published) => {
			await published.goto(`${SITE_URL}${ENTRY_PATH}`)
			assert.equal(await excerpt(published), PUBLISHED_EXCERPT)
		})

		await exitPreview(walker, preview, ENTRY_PATH)
		assert.equal(await excerpt(preview), PUBLISHED_EXCERPT)
		const exitShot = await walker.shot(preview, '14-preview-exited')
		return `admin Save (draft excerpt "${draft}") -> Publishing options > Preview opened ${PREVIEW_URL}/_rush/preview?token=… redirected once to ${ENTRY_PATH} with banner, draft excerpt, X-Robots-Tag noindex, HttpOnly rush_preview; ${SITE_URL} still shows "${PUBLISHED_EXCERPT}"; Exit -> published page, no banner, cookie cleared [${editorShot}, ${previewShot}, ${exitShot}]`
	} finally {
		await preview.close().catch(() => undefined)
	}
}
