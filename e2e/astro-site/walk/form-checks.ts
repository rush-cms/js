import assert from 'node:assert/strict'
import { randomInt } from 'node:crypto'
import { isRecord } from '@rushcms/client'
import type { AdminApi, Submission } from './admin-api.ts'
import type { Walker } from './browser.ts'
import { hopsOf } from './browser.ts'
import { VISITOR, fillContact, markerFor, statusOf, submitWithScript } from './contact-form.ts'
import { PORTS, PROXY_HOST, PROXY_PORT, SITE_URL } from './env.ts'
import type { WalkEnv } from './env.ts'
import { startProxy } from './proxy.ts'
import type { ProxyTarget } from './proxy.ts'
import { submitContactDirect } from './public-api.ts'
import { Blocked } from './results.ts'

const VISITOR_LIMIT = 5
const WINDOW_SECONDS = 60

const CONTACT_PAGE = `${SITE_URL}/pt/contact`
const PROXIED_CONTACT_PAGE = `http://localhost:${PROXY_PORT}/pt/contact`
const SITE_TARGET: ProxyTarget = { host: 'localhost', port: PORTS.site }

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

export function formWithScript(walker: Walker, admin: AdminApi, siteId: string): Promise<string> {
	return walker.withPage(async (page) => {
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
		return `fetch POST ${outcome.status}, in-place status "${outcome.text}", stored with ip ${stored.ip_address} [${shot}]`
	})
}

export function formWithoutScript(
	walker: Walker,
	admin: AdminApi,
	siteId: string
): Promise<string> {
	return walker.withPage(async (page) => {
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
		return `plain POST -303-> /pt/contact?rush_form=contact&status=sent, server-rendered "${status.text}", stored [${shot}]`
	})
}

export async function visitorIpBehindProxy(
	walker: Walker,
	admin: AdminApi,
	siteId: string
): Promise<string> {
	if (walker.visitorIp === undefined) {
		throw new Blocked('no non-loopback IPv4 interface to reach the proxy from')
	}
	const proxy = await startProxy(PROXY_PORT, SITE_TARGET)
	try {
		return await walker.withPage(async (page) => {
			await page.goto(`http://${PROXY_HOST}:${PROXY_PORT}/pt/contact`)
			const marker = markerFor('proxy')
			const outcome = await submitWithScript(page, marker)
			assert.equal(outcome.status, 201)
			const stored = await submissionWith(admin, siteId, marker)
			assert.equal(stored.ip_address, walker.visitorIp)
			const shot = await walker.shot(page, '08-form-behind-proxy')
			return `via proxy ${PROXY_HOST}:${PROXY_PORT} (X-Forwarded-For = socket address ${walker.visitorIp}, Node sees the proxy on loopback): stored ip_address ${stored.ip_address} [${shot}]`
		})
	} finally {
		await proxy.close()
	}
}

function freshVisitorIp(): string {
	return `198.18.${randomInt(256)}.${randomInt(1, 255)}`
}

function retryAfterOf(body: unknown): number {
	const params = isRecord(body) ? body['params'] : undefined
	const value = isRecord(params) ? params['retry_after'] : undefined
	assert.ok(
		typeof value === 'number' && Number.isInteger(value),
		`params.retry_after in ${JSON.stringify(body)}`
	)
	return value
}

function assertWithinWindow(seconds: number, label: string): void {
	assert.ok(seconds >= 1 && seconds <= WINDOW_SECONDS, `${label} ${seconds}s`)
}

export async function visitorRateLimit(walker: Walker, env: WalkEnv): Promise<string> {
	const ip = freshVisitorIp()
	const proxy = await startProxy(PROXY_PORT, SITE_TARGET, ip)
	try {
		return await walker.withPage(async (page) => {
			const accepted: number[] = []
			for (let attempt = 1; attempt <= VISITOR_LIMIT; attempt++) {
				await page.goto(PROXIED_CONTACT_PAGE)
				const outcome = await submitWithScript(page, markerFor(`limit-${attempt}`))
				assert.equal(outcome.status, 201, `post ${attempt} of a fresh visitor window`)
				accepted.push(outcome.status)
			}
			assert.equal(accepted.length, VISITOR_LIMIT)
			await page.goto(PROXIED_CONTACT_PAGE)
			const limited = await submitWithScript(page, markerFor('limit-over'))
			assert.equal(limited.status, 429)
			assert.equal(limited.state, 'error')
			const paramSeconds = retryAfterOf(limited.body)
			assertWithinWindow(paramSeconds, 'params.retry_after')
			assert.equal(limited.text, `Muitas tentativas, tente em ${paramSeconds}s`)
			const direct = await submitContactDirect(env, ip, {
				...VISITOR,
				message: markerFor('limit-direct')
			})
			assert.equal(direct.status, 429)
			const headerSeconds = Number(direct.retryAfter)
			assert.ok(Number.isInteger(headerSeconds), `Retry-After "${direct.retryAfter}"`)
			assertWithinWindow(headerSeconds, 'Retry-After')
			const shot = await walker.shot(page, '09-form-429')
			return `visitor ${ip} (fresh window): ${accepted.length} posts accepted, the 6th is 429 with params.retry_after ${paramSeconds} and message "${limited.text}"; a direct API post for the same visitor answers 429 with Retry-After ${headerSeconds} [${shot}]`
		})
	} finally {
		await proxy.close()
	}
}
