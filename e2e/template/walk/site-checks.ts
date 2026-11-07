import assert from 'node:assert/strict'
import { join } from 'node:path'
import type { Page, Walker } from '../../walk-kit/browser.ts'
import { openOk } from '../../walk-kit/browser.ts'
import { alternateLinks, attribute, textOf } from '../../walk-kit/dom.ts'
import { loadedImages, richText } from '../../walk-kit/rich-text.ts'
import type { RenderedRichText } from '../../walk-kit/rich-text.ts'
import { SITE_URL } from './env.ts'
import { httpStatus } from './http.ts'
import { PREVIEW_OUT_DIR, fileCount, filesContaining } from './project.ts'
import type { Project } from './project.ts'

export const FRONT_HEADING = 'Your Rush CMS site is up and running.'

export type FrontPage = {
	path: string
	lang: string
	title: string
	collections: string[]
}

export type FrontSite = {
	name: string
	pages: FrontPage[]
}

export type RenderedLink = {
	label: string
	href: string | null
	target: string | null
	rel: string | null
	classes: string[]
	track: string | null
}

export type SwitcherLink = {
	hreflang: string | null
	href: string | null
	current: string | null
}

export type PageChrome = {
	path: string
	main: RenderedLink[]
	footer: RenderedLink[]
	switcher: SwitcherLink[]
}

export type ListPage = {
	path: string
	entries: number
	previous: string | null
	next: string | null
}

export type EntryPage = {
	path: string
	lang: string
	title: string
	alternates: string[]
	richText: RenderedRichText
}

export type LanguageSwitch = {
	from: string
	hreflang: string
	to: string
	lang: string
	title: string
}

export type SitemapSpec = {
	includes: string[]
	excludes: string[]
}

const MAIN_NAV = 'header nav[aria-label="Main"]'
const FOOTER_NAV = 'footer nav[aria-label="Footer"]'
const SWITCHER = 'nav[aria-label="Language"]'
const CONTENT_LINKS = 'section[aria-labelledby="content-heading"] a'
const PAGINATION = 'nav[aria-label="Pagination"]'
const EMPTY_LIST = 'Nothing has been published here yet.'
const NOT_FOUND_HEADING = 'Page not found'
const SITEMAP_LOC = /<loc>([^<]+)<\/loc>/g
const NOT_FOUND = 404
const FEATURED = 'article > figure img'

async function linksIn(page: Page, container: string): Promise<RenderedLink[]> {
	return page.$$eval(`${container} a`, (links) =>
		links.map((link) => ({
			label: link.textContent?.trim() ?? '',
			href: link.getAttribute('href'),
			target: link.getAttribute('target'),
			rel: link.getAttribute('rel'),
			classes: [...link.classList],
			track: link.getAttribute('data-track')
		}))
	)
}

async function switcherLinks(page: Page): Promise<SwitcherLink[]> {
	return page.$$eval(`${SWITCHER} a`, (links) =>
		links.map((link) => ({
			hreflang: link.getAttribute('hreflang'),
			href: link.getAttribute('href'),
			current: link.getAttribute('aria-current')
		}))
	)
}

async function hrefsIn(page: Page, selector: string): Promise<(string | null)[]> {
	return page.$$eval(selector, (links) => links.map((link) => link.getAttribute('href')))
}

async function assertAnswering(urls: string[]): Promise<void> {
	for (const url of urls) {
		assert.equal(await httpStatus(url), 200, `GET ${url}`)
	}
}

function internal(hrefs: (string | null)[]): string[] {
	return hrefs
		.filter((href): href is string => href?.startsWith('/') === true)
		.map((href) => `${SITE_URL}${href}`)
}

async function bodyText(page: Page): Promise<string> {
	return page.$eval('body', (body) => body.innerText)
}

function sorted(hrefs: (string | null)[]): string[] {
	return hrefs.map((href) => href ?? '').toSorted((a, b) => a.localeCompare(b))
}

function shotName(prefix: string, path: string): string {
	return `${prefix}${path.replaceAll('/', '_') || '_'}`
}

export function frontPages(walker: Walker, site: FrontSite, prefix: string): Promise<string> {
	return walker.withPage(async (page) => {
		const seen: string[] = []
		for (const front of site.pages) {
			await openOk(page, `${SITE_URL}${front.path}`)
			assert.equal(await attribute(page, 'html', 'lang'), front.lang)
			assert.equal(await textOf(page, 'h1'), FRONT_HEADING)
			assert.equal(await page.title(), front.title)
			assert.ok((await bodyText(page)).includes(`Connected to ${site.name}`), 'site name')
			const collections = await hrefsIn(page, CONTENT_LINKS)
			assert.deepEqual(sorted(collections), sorted(front.collections))
			await assertAnswering(internal(collections))
			const shot = await walker.shot(page, shotName(`${prefix}front`, front.path))
			seen.push(
				`${front.path} 200 lang=${front.lang} title "${front.title}" collections ${front.collections.join(',') || 'none'} [${shot}]`
			)
		}
		return seen.join('; ')
	})
}

export function pageChrome(walker: Walker, chromes: PageChrome[], prefix: string): Promise<string> {
	return walker.withPage(async (page) => {
		const seen: string[] = []
		for (const chrome of chromes) {
			await openOk(page, `${SITE_URL}${chrome.path}`)
			const main = await linksIn(page, MAIN_NAV)
			const footer = await linksIn(page, FOOTER_NAV)
			const switcher = await switcherLinks(page)
			assert.deepEqual(main, chrome.main)
			assert.deepEqual(footer, chrome.footer)
			assert.deepEqual(switcher, chrome.switcher)
			for (const [selector, links] of [
				[MAIN_NAV, main],
				[FOOTER_NAV, footer],
				[SWITCHER, switcher]
			] as const) {
				assert.equal(
					(await page.$(selector)) !== null,
					links.length > 0,
					`${selector} rendered`
				)
			}
			await assertAnswering(
				internal([...main, ...footer, ...switcher].map((link) => link.href))
			)
			const shot = await walker.shot(page, shotName(`${prefix}chrome`, chrome.path))
			const external = [...main, ...footer].filter((link) => link.target !== null)
			seen.push(
				`${chrome.path}: main ${main.length} links, footer ${footer.length}, switcher ${switcher.length}${external.map((link) => `; ${link.label} -> ${link.href} target=${link.target} rel="${link.rel}"`).join('')} [${shot}]`
			)
		}
		return `${seen.join(' | ')}; every internal href answers 200`
	})
}

export function collectionPages(
	walker: Walker,
	lists: ListPage[],
	beyond: string[],
	prefix: string
): Promise<string> {
	return walker.withPage(async (page) => {
		const seen: string[] = []
		for (const list of lists) {
			await openOk(page, `${SITE_URL}${list.path}`)
			assert.equal((await page.$$('#content article')).length, list.entries, list.path)
			const [previous = null] = await hrefsIn(page, `${PAGINATION} a[rel="prev"]`)
			const [next = null] = await hrefsIn(page, `${PAGINATION} a[rel="next"]`)
			assert.deepEqual({ previous, next }, { previous: list.previous, next: list.next })
			assert.equal(
				await attribute(page, 'link[rel="canonical"]', 'href'),
				`${SITE_URL}${list.path}`
			)
			if (list.entries === 0) {
				assert.ok((await bodyText(page)).includes(EMPTY_LIST), 'empty list notice')
			}
			const shot = await walker.shot(page, shotName(`${prefix}list`, list.path))
			seen.push(
				`${list.path} ${list.entries} entries prev=${previous} next=${next} [${shot}]`
			)
		}
		for (const path of beyond) {
			assert.equal(await httpStatus(`${SITE_URL}${path}`), NOT_FOUND, `GET ${path}`)
		}
		return `${seen.join('; ')}; ${beyond.join(', ')} -> 404`
	})
}

export function entryPages(walker: Walker, entries: EntryPage[], prefix: string): Promise<string> {
	return walker.withPage(async (page) => {
		const seen: string[] = []
		for (const entry of entries) {
			await openOk(page, `${SITE_URL}${entry.path}`)
			assert.equal(await attribute(page, 'html', 'lang'), entry.lang)
			assert.equal(await textOf(page, 'h1'), entry.title)
			assert.deepEqual(await alternateLinks(page), entry.alternates)
			assert.equal(
				await attribute(page, 'link[rel="canonical"]', 'href'),
				`${SITE_URL}${entry.path}`
			)
			assert.deepEqual(await richText(page, '.prose'), entry.richText)
			assert.deepEqual(await loadedImages(page, FEATURED), [true])
			const featured = await attribute(page, FEATURED, 'src')
			assert.ok(featured?.startsWith('/_astro/'), `optimized featured image ${featured}`)
			const shot = await walker.shot(page, shotName(`${prefix}entry`, entry.path))
			seen.push(
				`${entry.path} "${entry.title}" lang=${entry.lang}, ${entry.alternates.length} hreflang links, rich text h2/link/${entry.richText.items} items/${entry.richText.images} image, featured ${featured} [${shot}]`
			)
		}
		return seen.join('; ')
	})
}

export function languageSwitch(walker: Walker, change: LanguageSwitch): Promise<string> {
	return walker.withPage(async (page) => {
		await openOk(page, `${SITE_URL}${change.from}`)
		await Promise.all([
			page.waitForNavigation(),
			page.click(`${SWITCHER} a[hreflang="${change.hreflang}"]`)
		])
		assert.equal(new URL(page.url()).pathname, change.to)
		assert.equal(await attribute(page, 'html', 'lang'), change.lang)
		assert.equal(await textOf(page, 'h1'), change.title)
		const shot = await walker.shot(page, 'a-switched-language')
		return `${change.from} -> click ${change.hreflang} -> ${change.to} lang=${change.lang} "${change.title}" [${shot}]`
	})
}

export function notFoundPages(
	walker: Walker,
	siteName: string,
	paths: string[],
	prefix: string
): Promise<string> {
	return walker.withPage(async (page) => {
		for (const path of paths) {
			const response = await page.goto(`${SITE_URL}${path}`)
			assert.equal(response?.status(), NOT_FOUND, `GET ${path}`)
			assert.equal(await textOf(page, 'h1'), NOT_FOUND_HEADING)
			assert.ok(
				(await bodyText(page)).includes(siteName),
				'the layout renders around the 404'
			)
		}
		const shot = await walker.shot(page, `${prefix}not-found`)
		return `${paths.join(', ')} -> 404 "${NOT_FOUND_HEADING}" inside the site layout [${shot}]`
	})
}

export async function sitemapAndRobots(base: string, sitemap: SitemapSpec): Promise<string> {
	const response = await fetch(`${base}/sitemap.xml`)
	assert.equal(response.status, 200)
	const xml = await response.text()
	const locs = [...xml.matchAll(SITEMAP_LOC)].map((match) => match[1] ?? '')
	for (const url of sitemap.includes) {
		assert.ok(locs.includes(url), `sitemap lists ${url}`)
	}
	for (const part of sitemap.excludes) {
		assert.ok(!locs.some((loc) => loc.includes(part)), `sitemap skips ${part}`)
	}
	await assertAnswering(locs.map((loc) => loc.replace(SITE_URL, base)))
	const robots = await (await fetch(`${base}/robots.txt`)).text()
	assert.equal(robots, `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`)
	return `sitemap.xml: ${locs.length} <loc> entries, all answer 200 (${locs.map((loc) => loc.replace(SITE_URL, '') || '/').join(' ')}); robots.txt allows / and names the sitemap`
}

export function tokenAbsent(project: Project, token: string): Promise<string> {
	const checked = ['dist/client', `${PREVIEW_OUT_DIR}/client`].map((dir) => {
		const path = join(project.path, dir)
		assert.deepEqual(filesContaining(path, token), [], `token in ${dir}`)
		return `${dir} (${fileCount(path)} files)`
	})
	return Promise.resolve(`delivery token found in none of ${checked.join(', ')}`)
}
