import assert from 'node:assert/strict'
import type { AdminApi, Submission } from './admin-api.ts'
import type { Walker } from './browser.ts'
import { hopsOf } from './browser.ts'
import { fillContact, markerFor, statusOf, submitWithScript } from './contact-form.ts'
import { PROXY_HOST, PROXY_PORT } from './env.ts'
import { localTarget, startProxy } from './proxy.ts'
import { Blocked } from './results.ts'

export const LOOPBACK: ReadonlySet<string> = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

const FORGED_BY_BROWSER = '198.51.100.66'

const FORM_KEY = 'contact'

export type ContactForm = {
	admin: AdminApi
	siteId: string
	path: string
	sentText: string
}

export type FormOrigin = {
	base: string
	label: string
	headers: Record<string, string>
	storedIps: ReadonlySet<string>
}

export function directOrigin(base: string): FormOrigin {
	return { base, label: base, headers: {}, storedIps: LOOPBACK }
}

async function submissionWith(
	admin: AdminApi,
	siteId: string,
	formKey: string,
	marker: string
): Promise<Submission> {
	const found = (await admin.submissions(siteId, formKey)).find(
		(submission) => submission.data['message'] === marker
	)
	assert.ok(found, `no stored submission with message ${marker}`)
	return found
}

async function storedFrom(
	form: ContactForm,
	origin: FormOrigin,
	marker: string
): Promise<Submission> {
	const stored = await submissionWith(form.admin, form.siteId, FORM_KEY, marker)
	assert.ok(origin.storedIps.has(stored.ip_address ?? ''), `stored ip ${stored.ip_address}`)
	return stored
}

export function sentWithScript(
	walker: Walker,
	form: ContactForm,
	origin: FormOrigin,
	shot: string
): Promise<string> {
	return walker.withPage(async (page) => {
		await page.setExtraHTTPHeaders(origin.headers)
		await page.goto(`${origin.base}${form.path}`)
		const marker = markerFor('js')
		const outcome = await submitWithScript(page, marker)
		assert.equal(outcome.status, 201)
		assert.equal(outcome.state, 'sent')
		assert.equal(outcome.text, form.sentText)
		assert.equal(new URL(page.url()).pathname, form.path)
		const stored = await storedFrom(form, origin, marker)
		const file = await walker.shot(page, shot)
		return `${origin.label}: fetch POST ${outcome.status}, in-place status "${outcome.text}", stored with ip ${stored.ip_address} [${file}]`
	})
}

export function sentWithoutScript(
	walker: Walker,
	form: ContactForm,
	origin: FormOrigin,
	shot: string
): Promise<string> {
	return walker.withPage(async (page) => {
		await page.setJavaScriptEnabled(false)
		await page.setExtraHTTPHeaders(origin.headers)
		await page.goto(`${origin.base}${form.path}`)
		const marker = markerFor('nojs')
		await fillContact(page, marker)
		const [response] = await Promise.all([
			page.waitForNavigation(),
			page.click('form[data-rush-form] button[type="submit"]')
		])
		assert.ok(response, 'no navigation after the plain form post')
		const back = `${form.path}?rush_form=${FORM_KEY}&status=sent`
		assert.deepEqual(hopsOf(response), [
			{ status: 303, path: `/_rush/forms/${FORM_KEY}` },
			{ status: 200, path: back }
		])
		const status = await statusOf(page)
		assert.deepEqual(status, { state: 'sent', text: form.sentText })
		const stored = await storedFrom(form, origin, marker)
		const file = await walker.shot(page, shot)
		return `${origin.label}: plain POST -303-> ${back}, server-rendered "${status.text}", stored with ip ${stored.ip_address} [${file}]`
	})
}

export async function behindProxy(
	walker: Walker,
	sitePort: number,
	use: (origin: FormOrigin) => Promise<string>
): Promise<string> {
	const visitorIp = walker.visitorIp
	if (visitorIp === undefined) {
		throw new Blocked('no non-loopback IPv4 interface to reach the proxy from')
	}
	const proxy = await startProxy(PROXY_PORT, localTarget(sitePort))
	try {
		return await use({
			base: `http://${PROXY_HOST}:${PROXY_PORT}`,
			label: `via proxy ${PROXY_HOST}:${PROXY_PORT} (browser sends X-Forwarded-For ${FORGED_BY_BROWSER}, the proxy appends the socket address ${visitorIp}, trustedProxies 1, Node sees the proxy on loopback)`,
			headers: { 'X-Forwarded-For': FORGED_BY_BROWSER },
			storedIps: new Set([visitorIp])
		})
	} finally {
		await proxy.close()
	}
}
