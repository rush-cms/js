import type { Page } from 'puppeteer-core'

export type RenderedRichText = {
	heading: string | null
	links: (string | null)[]
	items: number
	images: number
	callout: string | null
}

export async function loadedImages(page: Page, selector: string): Promise<boolean[]> {
	return page.$$eval(selector, (images) =>
		Promise.all(
			images.map((image) => {
				if (!(image instanceof HTMLImageElement)) {
					return Promise.resolve(false)
				}
				image.loading = 'eager'
				return image.decode().then(
					() => image.naturalWidth > 0,
					() => false
				)
			})
		)
	)
}

export async function richText(page: Page, container: string): Promise<RenderedRichText> {
	const loaded = await loadedImages(page, `${container} img`)
	const rendered = await page.$eval(container, (body) => ({
		heading: body.querySelector('h2')?.textContent ?? null,
		links: [...body.querySelectorAll('a')].map((link) => link.getAttribute('href')),
		items: body.querySelectorAll('ul > li').length,
		callout: body.querySelector('[data-callout]')?.textContent ?? null
	}))
	return { ...rendered, images: loaded.filter(Boolean).length }
}
