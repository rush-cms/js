import type { HTTPResponse, Page } from 'puppeteer-core'

export type FormOutcome = {
	status: number
	state: string | null
	text: string
	body: unknown
}

export type ContactData = {
	name: string
	email: string
	message: string
}

export type StatusText = {
	state: string | null
	text: string
}

export const VISITOR: Omit<ContactData, 'message'> = {
	name: 'E2E Visitor',
	email: 'visitor@example.com'
}

const FORM_POST = '/_rush/forms/contact'

export async function fillContact(page: Page, marker: string): Promise<void> {
	await page.type('[name="name"]', VISITOR.name)
	await page.type('[name="email"]', VISITOR.email)
	await page.type('[name="message"]', marker)
}

function isFormPost(response: HTTPResponse): boolean {
	return response.request().method() === 'POST' && response.url().includes(FORM_POST)
}

export async function statusOf(page: Page): Promise<StatusText> {
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
	const body: unknown = await response.json().catch(() => undefined)
	return { status: response.status(), body, ...(await statusOf(page)) }
}

export function markerFor(name: string): string {
	return `e2e-${name}-${Date.now()}`
}
