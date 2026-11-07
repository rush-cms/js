import assert from 'node:assert/strict'
import { randomInt } from 'node:crypto'
import { isRecord } from '@rushcms/client/internal'
import type { AdminApi } from '../../walk-kit/admin-api.ts'
import type { Walker } from '../../walk-kit/browser.ts'
import { VISITOR, markerFor, submitWithScript } from '../../walk-kit/contact-form.ts'
import { PROXY_PORT } from '../../walk-kit/env.ts'
import {
	LOOPBACK,
	behindProxy,
	directOrigin,
	sentWithScript,
	sentWithoutScript
} from '../../walk-kit/form-checks.ts'
import type { ContactForm } from '../../walk-kit/form-checks.ts'
import { localTarget, startProxy } from '../../walk-kit/proxy.ts'
import { withRestore } from '../../walk-kit/restore.ts'
import { PORTS, PREVIEW_URL, SITE_URL } from './env.ts'
import type { WalkEnv } from './env.ts'
import { submitContactDirect } from './public-api.ts'

const VISITOR_LIMIT = 5
const WINDOW_SECONDS = 60

const PROXIED_CONTACT_PAGE = `http://localhost:${PROXY_PORT}/pt/contact`

function contactForm(admin: AdminApi, siteId: string): ContactForm {
	return { admin, siteId, path: '/pt/contact', sentText: 'Mensagem enviada' }
}

export function formWithScript(walker: Walker, admin: AdminApi, siteId: string): Promise<string> {
	return sentWithScript(
		walker,
		contactForm(admin, siteId),
		directOrigin(SITE_URL),
		'06-form-js-sent'
	)
}

export function formWithoutScript(
	walker: Walker,
	admin: AdminApi,
	siteId: string
): Promise<string> {
	return sentWithoutScript(
		walker,
		contactForm(admin, siteId),
		directOrigin(SITE_URL),
		'07-form-nojs-sent'
	)
}

export function visitorIpBehindProxy(
	walker: Walker,
	admin: AdminApi,
	siteId: string
): Promise<string> {
	return behindProxy(walker, PORTS.site, (origin) =>
		sentWithScript(walker, contactForm(admin, siteId), origin, '08-form-behind-proxy')
	)
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
	const proxy = await startProxy(PROXY_PORT, localTarget(PORTS.site), ip)
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

function forgedChain(attempt: number): string {
	return `198.51.100.${attempt}, 203.0.113.${attempt}`
}

async function postForged(key: string, attempt: number, marker: string): Promise<number> {
	const response = await fetch(`${PREVIEW_URL}/_rush/forms/${key}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json',
			'X-Forwarded-For': forgedChain(attempt)
		},
		body: JSON.stringify({ message: marker })
	})
	await response.arrayBuffer()
	return response.status
}

export async function forgedForwardedForDirect(admin: AdminApi, siteId: string): Promise<string> {
	const key = `forged-xff-${Date.now()}`
	const formId = await admin.createMessageForm(siteId, key)
	return withRestore(
		() => admin.deleteForm(siteId, formId),
		async () => {
			const statuses: number[] = []
			const forged = new Set<string>()
			for (let attempt = 1; attempt <= VISITOR_LIMIT + 1; attempt++) {
				forgedChain(attempt)
					.split(', ')
					.forEach((entry) => forged.add(entry))
				statuses.push(await postForged(key, attempt, markerFor(`xff-${attempt}`)))
			}
			assert.deepEqual(statuses, [...Array<number>(VISITOR_LIMIT).fill(201), 429])
			const stored = await admin.submissions(siteId, key)
			assert.equal(stored.length, VISITOR_LIMIT)
			const ips = new Set(stored.map((submission) => submission.ip_address ?? ''))
			for (const ip of ips) {
				assert.ok(LOOPBACK.has(ip), `stored ip ${ip}`)
				assert.ok(!forged.has(ip), `forged ip ${ip} stored`)
			}
			return `form ${key} on ${PREVIEW_URL} (trustedProxies 0, Host in allowedDomains), 6 direct posts with rotating X-Forwarded-For ${forgedChain(1)} … ${forgedChain(VISITOR_LIMIT + 1)}: statuses ${statuses.join(',')}; stored ip_address ${[...ips].join(',')} (the Astro server, none forged); form deleted afterwards`
		}
	)
}
