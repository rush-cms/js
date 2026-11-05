import { describe, expect, it } from 'vitest'
import { requestExample, responseExample } from './fixtures/contract'
import { apiPath, header, jsonResponse, testClient } from './fixtures/fetch'
import type { TestClient } from './fixtures/fetch'

const SUBMIT_PATH = '/api/v1/{site_id}/forms/{key}/submit'

function submitClient(): TestClient {
	return testClient(() => jsonResponse(responseExample('FormSubmitted'), 201), {
		locale: 'pt_BR',
		perspective: 'published'
	})
}

describe('forms.submit', () => {
	it('posts JSON with the visitor IP and captcha token headers', async () => {
		const submission = requestExample(SUBMIT_PATH, 'post') as Record<string, unknown>
		const { client, calls } = submitClient()

		const result = await client.forms.submit('contact', submission, {
			clientIp: '203.0.113.7',
			captchaToken: 'XXXX.DUMMY.TOKEN.XXXX'
		})

		expect(result).toEqual({ received: true })
		const [call] = calls
		expect(call?.init.method).toBe('POST')
		expect(call && apiPath(call)).toBe('/forms/contact/submit')
		expect(call?.url.search).toBe('')
		expect(call && header(call, 'X-Rush-Client-IP')).toBe('203.0.113.7')
		expect(call && header(call, 'X-Captcha-Token')).toBe('XXXX.DUMMY.TOKEN.XXXX')
		expect(call && header(call, 'Content-Type')).toBe('application/json')
		expect(call && header(call, 'Authorization')).toBe('Bearer delivery-token')
		expect(JSON.parse(call?.init.body as string)).toEqual(submission)
	})

	it('omits the optional headers when not given', async () => {
		const { client, calls } = submitClient()

		await client.forms.submit('contact', { name: 'Ana' })

		const [call] = calls
		expect(call && header(call, 'X-Rush-Client-IP')).toBeNull()
		expect(call && header(call, 'X-Captcha-Token')).toBeNull()
	})

	it('passes FormData through for multipart submissions', async () => {
		const { client, calls } = submitClient()
		const data = new FormData()
		data.append('name', 'Ana')

		await client.forms.submit('contact', data, { clientIp: '2001:db8::1' })

		const [call] = calls
		expect(call?.init.body).toBe(data)
		expect(call && header(call, 'Content-Type')).toBeNull()
		expect(call && header(call, 'X-Rush-Client-IP')).toBe('2001:db8::1')
	})
})
