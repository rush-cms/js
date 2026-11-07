import type { Page } from 'puppeteer-core'

export async function alternateLinks(page: Page): Promise<string[]> {
	return page.$$eval('link[rel="alternate"][hreflang]', (links) =>
		links.map((link) => `${link.getAttribute('hreflang')} ${link.getAttribute('href')}`)
	)
}

export async function attribute(
	page: Page,
	selector: string,
	name: string
): Promise<string | null> {
	return page.$eval(selector, (element, key) => element.getAttribute(key), name)
}

export async function textOf(page: Page, selector: string): Promise<string | null> {
	return page.$eval(selector, (element) => element.textContent?.trim() ?? null)
}
