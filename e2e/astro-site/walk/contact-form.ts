import type { HTTPResponse, Page } from 'puppeteer-core'

export type FormOutcome = {
	status: number
	state: string | null
	text: string
}

const FORM_POST = '/_rush/forms/contact'

export async function fillContact(page: Page, marker: string): Promise<void> {
	await page.type('[name="name"]', 'E2E Visitor')
	await page.type('[name="email"]', 'visitor@example.com')
	await page.type('[name="message"]', marker)
}

function isFormPost(response: HTTPResponse): boolean {
	return response.request().method() === 'POST' && response.url().includes(FORM_POST)
}

export async function statusOf(page: Page): Promise<Omit<FormOutcome, 'status'>> {
	return page.$eval('[data-rush-status]', (element) => ({
		state: element.getAttribute('data-state'),
		text: element.textContent?.trim() ?? ''
	}))
}

export async function submitWithScript(page: Page, marker: string): Promise<FormOutcome> {
	await fillContact(page, marker)
	const [response] = await Promise.all([
		page.waitForResponse(isFormPost),
		page.click('form[data-rush-form] button[type="submit"]')
	])
	await page.waitForFunction(
		() => document.querySelector('[data-rush-status]')?.hasAttribute('data-state') === true
	)
	return { status: response.status(), ...(await statusOf(page)) }
}

export function markerFor(name: string): string {
	return `e2e-${name}-${Date.now()}`
}
