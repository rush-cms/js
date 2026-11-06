import assert from 'node:assert/strict'
import type { Page } from 'puppeteer-core'
import type { Redirect, Walker } from './browser.ts'
import { openOk, redirectedOnce } from './browser.ts'
import { PREVIEW_URL, SITE_URL } from './env.ts'

type FixedEntry = {
	locale: string
	path: string
	title: string
}

const SOLUTIONS: FixedEntry[] = [
	{ locale: 'pt_BR', path: '/pt/solutions/desenvolvimento-web', title: 'Desenvolvimento web' },
	{ locale: 'en', path: '/en/solutions/web-development', title: 'Web development' },
	{ locale: 'es', path: '/es/solutions/desarrollo-web', title: 'Desarrollo web' }
]

const [PT, EN, ES] = SOLUTIONS

function fromRouteKey(entry: FixedEntry): Redirect {
	return { from: `/${entry.locale}/servicos/${slugOf(entry)}`, to: entry.path }
}

function slugOf(entry: FixedEntry): string {
	return entry.path.split('/').at(-1) ?? ''
}

function fromOtherLocale(entry: FixedEntry, other: FixedEntry): Redirect {
	return { from: entry.path.replace(slugOf(entry), slugOf(other)), to: entry.path }
}

async function assertCanonical(page: Page, base: string, entry: FixedEntry): Promise<void> {
	await openOk(page, `${base}${entry.path}`)
	const rendered = await page.$eval('article', (article) => ({
		locale: article.getAttribute('data-locale'),
		title: article.querySelector('h1')?.textContent ?? null
	}))
	assert.deepEqual(rendered, { locale: entry.locale, title: entry.title })
	const canonical = await page.$eval('link[rel="canonical"]', (link) => link.getAttribute('href'))
	assert.equal(canonical, `${SITE_URL}${entry.path}`)
}

function required(entry: FixedEntry | undefined): FixedEntry {
	assert.ok(entry, 'fixed route entry')
	return entry
}

export function fixedRouteOnSite(walker: Walker): Promise<string> {
	return walker.withPage(async (page) => {
		const seen: string[] = []
		const shots: string[] = []
		for (const [index, entry] of SOLUTIONS.entries()) {
			await assertCanonical(page, SITE_URL, entry)
			const other = required(SOLUTIONS[(index + 1) % SOLUTIONS.length])
			seen.push(`${entry.path} 200`)
			seen.push(await redirectedOnce(page, SITE_URL, fromOtherLocale(entry, other), 301))
			shots.push(await walker.shot(page, `18-fixed-route-${entry.locale}`))
		}
		const fromKey = await redirectedOnce(page, SITE_URL, fromRouteKey(required(EN)), 301)
		return `${seen.join('; ')} (one hop each); ${fromKey} (catch-all) [${shots.join(', ')}]`
	})
}

export function fixedRouteOnPreview(walker: Walker): Promise<string> {
	return walker.withPage(async (page) => {
		const entry = required(EN)
		await assertCanonical(page, PREVIEW_URL, entry)
		const moved = await redirectedOnce(
			page,
			PREVIEW_URL,
			fromOtherLocale(entry, required(PT)),
			302
		)
		const fromEs = await redirectedOnce(
			page,
			PREVIEW_URL,
			fromOtherLocale(entry, required(ES)),
			302
		)
		const fromKey = await redirectedOnce(page, PREVIEW_URL, fromRouteKey(entry), 302)
		const shot = await walker.shot(page, '19-preview-fixed-route-en')
		return `${PREVIEW_URL}${entry.path} 200 on demand (route key servicos mapped to services); ${moved}; ${fromEs}; ${fromKey} [${shot}]`
	})
}
