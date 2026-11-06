import assert from 'node:assert/strict'
import type { AdminApi, Submission } from './admin-api.ts'
import type { Walker } from './browser.ts'
import { hopsOf } from './browser.ts'
import { fillContact, markerFor, statusOf, submitWithScript } from './contact-form.ts'
import { Blocked } from './results.ts'
import { PROXY_HOST, PROXY_PORT, SITE_URL } from './env.ts'
import { startProxy } from './proxy.ts'

const VISITOR_LIMIT = 5

const CONTACT_PAGE = `${SITE_URL}/pt/contact`

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

async function submissionWith(
	admin: AdminApi,
	siteId: string,
	marker: string
): Promise<Submission> {
	const found = (await admin.submissions(siteId, 'contact')).find(
		(submission) => submission.data['message'] === marker
	)
	assert.ok(found, `no stored submission with message ${marker}`)
	return found
}

export async function formWithScript(
	walker: Walker,
	admin: AdminApi,
	siteId: string
): Promise<string> {
	const page = await walker.page()
	await page.goto(CONTACT_PAGE)
	const marker = markerFor('js')
	const outcome = await submitWithScript(page, marker)
	assert.equal(outcome.status, 201)
	assert.equal(outcome.state, 'sent')
	assert.equal(outcome.text, 'Mensagem enviada')
	assert.equal(new URL(page.url()).pathname, '/pt/contact')
	const stored = await submissionWith(admin, siteId, marker)
	assert.ok(LOOPBACK.has(stored.ip_address ?? ''), `ip ${stored.ip_address}`)
	const shot = await walker.shot(page, '06-form-js-sent')
	await page.close()
	return `fetch POST ${outcome.status}, in-place status "${outcome.text}", stored with ip ${stored.ip_address} [${shot}]`
}

export async function formWithoutScript(
	walker: Walker,
	admin: AdminApi,
	siteId: string
): Promise<string> {
	const page = await walker.page()
	await page.setJavaScriptEnabled(false)
	await page.goto(CONTACT_PAGE)
	const marker = markerFor('nojs')
	await fillContact(page, marker)
	const [response] = await Promise.all([
		page.waitForNavigation(),
		page.click('form[data-rush-form] button[type="submit"]')
	])
	assert.ok(response, 'no navigation after the plain form post')
	assert.deepEqual(hopsOf(response), [
		{ status: 303, path: '/_rush/forms/contact' },
		{ status: 200, path: '/pt/contact?rush_form=contact&status=sent' }
	])
	const status = await statusOf(page)
	assert.deepEqual(status, { state: 'sent', text: 'Mensagem enviada' })
	await submissionWith(admin, siteId, marker)
	const shot = await walker.shot(page, '07-form-nojs-sent')
	await page.close()
	return `plain POST -303-> /pt/contact?rush_form=contact&status=sent, server-rendered "${status.text}", stored [${shot}]`
}

export async function visitorIpBehindProxy(
	walker: Walker,
	admin: AdminApi,
	siteId: string
): Promise<string> {
	if (walker.visitorIp === undefined) {
		throw new Blocked('no non-loopback IPv4 interface to reach the proxy from')
	}
	const proxy = await startProxy(PROXY_PORT, { host: 'localhost', port: 4321 })
	try {
		const page = await walker.page()
		await page.goto(`http://${PROXY_HOST}:${PROXY_PORT}/pt/contact`)
		const marker = markerFor('proxy')
		const outcome = await submitWithScript(page, marker)
		assert.equal(outcome.status, 201)
		const stored = await submissionWith(admin, siteId, marker)
		assert.equal(stored.ip_address, walker.visitorIp)
		const shot = await walker.shot(page, '08-form-behind-proxy')
		await page.close()
		return `via proxy ${PROXY_HOST}:${PROXY_PORT} (X-Forwarded-For = socket address ${walker.visitorIp}, Node sees the proxy on loopback): stored ip_address ${stored.ip_address} [${shot}]`
	} finally {
		await proxy.close()
	}
}

export async function visitorRateLimit(walker: Walker): Promise<string> {
	const page = await walker.page()
	const accepted: number[] = []
	for (let attempt = 0; attempt <= VISITOR_LIMIT; attempt++) {
		await page.goto(CONTACT_PAGE)
		const outcome = await submitWithScript(page, markerFor(`limit-${attempt}`))
		if (outcome.status === 429) {
			assert.equal(outcome.state, 'error')
			assert.match(outcome.text, /^Muitas tentativas, tente em \d+s$/)
			const shot = await walker.shot(page, '09-form-429')
			await page.close()
			return `429 on post ${accepted.length + 1} of this loop (limit ${VISITOR_LIMIT}/min per site+form+visitor, window shared with the earlier posts); message "${outcome.text}" [${shot}]`
		}
		assert.equal(outcome.status, 201)
		accepted.push(outcome.status)
	}
	throw new Error(`no 429 after ${accepted.length} accepted posts`)
}
