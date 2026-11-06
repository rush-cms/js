import assert from 'node:assert/strict'
import type { Page } from 'puppeteer-core'
import type { Walker } from './browser.ts'
import { hopsOf } from './browser.ts'
import { SITE_URL } from './env.ts'

type Redirect = {
	from: string
	to: string
}

const REDIRECTS: Redirect[] = [
	{ from: '/pt/artigos/guia-antigo', to: '/pt/artigos/guia-novo' },
	{ from: '/en/blog/old-guide', to: '/en/blog/new-guide' },
	{ from: '/pt/artigos/hello-world', to: '/pt/artigos/ola-mundo' },
	{ from: '/pt/blog/ola-mundo', to: '/pt/artigos/ola-mundo' },
	{ from: '/es/blog/hello-world', to: '/es/articulos/hola-mundo' }
]

async function alternateLinks(page: Page): Promise<string[]> {
	return page.$$eval('link[rel="alternate"][hreflang]', (links) =>
		links.map((link) => `${link.getAttribute('hreflang')} ${link.getAttribute('href')}`)
	)
}

async function attribute(page: Page, selector: string, name: string): Promise<string | null> {
	return page.$eval(selector, (element, key) => element.getAttribute(key), name)
}

async function entrySlugs(page: Page): Promise<(string | null)[]> {
	return page.$$eval('[data-entries] li', (items) =>
		items.map((item) => item.getAttribute('data-slug'))
	)
}

async function goto(page: Page, path: string): Promise<void> {
	const response = await page.goto(`${SITE_URL}${path}`)
	assert.equal(response?.status(), 200, `GET ${path}`)
}

export function languageSwitcher(walker: Walker): Promise<string> {
	return walker.withPage(async (page) => {
		await goto(page, '/en/blog/hello-world')
		assert.deepEqual(await alternateLinks(page), [
			`pt-BR ${SITE_URL}/pt/artigos/ola-mundo`,
			`en ${SITE_URL}/en/blog/hello-world`,
			`es ${SITE_URL}/es/articulos/hola-mundo`,
			`x-default ${SITE_URL}/pt/artigos/ola-mundo`
		])
		const before = await walker.shot(page, '01-switcher-en')
		await Promise.all([
			page.waitForNavigation(),
			page.click('[data-language-switcher] a[data-locale="es"]')
		])
		assert.equal(new URL(page.url()).pathname, '/es/articulos/hola-mundo')
		assert.equal(await attribute(page, 'html', 'lang'), 'es')
		assert.equal(await page.$eval('h1', (element) => element.textContent), 'Hola, mundo')
		const after = await walker.shot(page, '02-switcher-es')
		return `hreflang pt-BR/en/es/x-default on /en/blog/hello-world; ES link -> /es/articulos/hola-mundo (lang=es) [${before}, ${after}]`
	})
}

export function fallbackCanonical(walker: Walker): Promise<string> {
	return walker.withPage(async (page) => {
		await goto(page, '/es/articulos/only-in-english')
		assert.equal(await attribute(page, 'html', 'lang'), 'es')
		assert.equal(await attribute(page, 'article', 'data-fallback'), 'true')
		assert.equal(await attribute(page, 'article', 'data-locale'), 'en')
		const canonical = `${SITE_URL}/en/blog/only-in-english`
		assert.equal(await attribute(page, 'link[rel="canonical"]', 'href'), canonical)
		assert.deepEqual(await alternateLinks(page), [`en ${canonical}`])
		const sitemap = await (await fetch(`${SITE_URL}/sitemap.xml`)).text()
		assert.ok(sitemap.includes(`<loc>${canonical}</loc>`), 'sitemap lists the original')
		assert.ok(!sitemap.includes('/es/articulos/only-in-english'), 'sitemap skips the fallback')
		const shot = await walker.shot(page, '03-fallback-es')
		return `/es/articulos/only-in-english renders the en entry (fallback=true), canonical ${canonical}, hreflang en only; sitemap lists only the original [${shot}]`
	})
}

export function movedRedirects(walker: Walker): Promise<string> {
	return walker.withPage(async (page) => {
		const seen: string[] = []
		for (const redirect of REDIRECTS) {
			const response = await page.goto(`${SITE_URL}${redirect.from}`)
			assert.ok(response, `no response for ${redirect.from}`)
			assert.deepEqual(hopsOf(response), [
				{ status: 301, path: redirect.from },
				{ status: 200, path: redirect.to }
			])
			seen.push(`${redirect.from} -301-> ${redirect.to}`)
		}
		const shot = await walker.shot(page, '04-moved-landing')
		return `${seen.join('; ')} [${shot}]`
	})
}

export function servicesOrder(walker: Walker): Promise<string> {
	return walker.withPage(async (page) => {
		await goto(page, '/en/services')
		const slugs = await entrySlugs(page)
		assert.deepEqual(slugs, ['technical-support', 'web-development', 'seo-optimization'])
		await goto(page, '/pt/tags/destaque-0')
		const tagged = await entrySlugs(page)
		assert.equal(tagged.length, 2)
		const shot = await walker.shot(page, '05-tag-page')
		return `services in seeded order ${slugs.join(', ')}; tag destaque-0 lists ${tagged.join(', ')} [${shot}]`
	})
}
