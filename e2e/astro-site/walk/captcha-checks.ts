import assert from 'node:assert/strict'
import type { Page, Walker } from '../../walk-kit/browser.ts'
import type { AdminApi } from '../../walk-kit/admin-api.ts'
import { markerFor, submitWithScript } from '../../walk-kit/contact-form.ts'
import { CAPTCHA_URL } from './env.ts'
import { withRestore } from '../../walk-kit/restore.ts'
import { Blocked } from '../../walk-kit/results.ts'

const PASSING_SECRET = '1x0000000000000000000000000000000AA'
const FAILING_SECRET = '2x0000000000000000000000000000000AA'

const TOKEN_TIMEOUT_MS = 30_000

export function useAlwaysPassSecret(admin: AdminApi, captchaSiteId: string): Promise<void> {
	return admin.setCaptchaSecret(captchaSiteId, PASSING_SECRET)
}

async function contactWithToken(page: Page): Promise<void> {
	await page.goto(`${CAPTCHA_URL}/pt/contact`)
	assert.equal(await page.$$eval('.cf-turnstile', (widgets) => widgets.length), 1)
	try {
		await page.waitForFunction(
			() =>
				(document.querySelector<HTMLInputElement>('[name="cf-turnstile-response"]')
					?.value ?? '') !== '',
			{ timeout: TOKEN_TIMEOUT_MS }
		)
	} catch {
		throw new Blocked(
			'the Turnstile widget produced no token (challenges.cloudflare.com unreachable?)'
		)
	}
}

export function turnstilePasses(walker: Walker): Promise<string> {
	return walker.withPage(async (page) => {
		await contactWithToken(page)
		const outcome = await submitWithScript(page, markerFor('captcha-pass'))
		assert.equal(outcome.status, 201)
		assert.equal(outcome.state, 'sent')
		const shot = await walker.shot(page, '10-turnstile-pass')
		return `widget token from the always-pass keys, API siteverify ok: POST ${outcome.status} "${outcome.text}" [${shot}]`
	})
}

export async function turnstileFails(
	walker: Walker,
	admin: AdminApi,
	captchaSiteId: string
): Promise<string> {
	return withRestore(
		() => useAlwaysPassSecret(admin, captchaSiteId),
		async () => {
			await admin.setCaptchaSecret(captchaSiteId, FAILING_SECRET)
			return walker.withPage(async (page) => {
				await contactWithToken(page)
				const outcome = await submitWithScript(page, markerFor('captcha-fail'))
				assert.equal(outcome.status, 422)
				assert.equal(outcome.state, 'error')
				assert.equal(outcome.text, 'Captcha inválido')
				const shot = await walker.shot(page, '11-turnstile-fail')
				return `secret flipped to the always-fail key via PUT /admin/sites/{id}: POST ${outcome.status} captcha_failed, message "${outcome.text}" [${shot}]`
			})
		}
	)
}
