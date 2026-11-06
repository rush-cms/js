import { isRecord } from '@rushcms/client'

export type Submission = {
	id: string
	data: Record<string, unknown>
	ip_address?: string
}

export type CaptchaSettings = {
	provider: string
	site_key: string
	secret_key: string
}

export type AdminApi = {
	submissions(siteId: string, formKey: string): Promise<Submission[]>
	setCaptchaSecret(siteId: string, secret: string): Promise<void>
}

type Envelope = {
	data: unknown
}

type Session = {
	token: string
	siteId: string | undefined
}

function isEnvelope(value: unknown): value is Envelope {
	return isRecord(value) && 'data' in value
}

function isSubmission(value: unknown): value is Submission {
	return isRecord(value) && typeof value['id'] === 'string' && isRecord(value['data'])
}

async function bodyOf(response: Response): Promise<unknown> {
	const text = await response.text()
	try {
		return JSON.parse(text)
	} catch {
		return text
	}
}

async function call(
	apiUrl: string,
	session: Session,
	path: string,
	init: RequestInit = {}
): Promise<unknown> {
	const response = await fetch(`${apiUrl}${path}`, {
		...init,
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${session.token}`
		}
	})
	const body = await bodyOf(response)
	if (!response.ok) {
		throw new Error(
			`${init.method ?? 'GET'} ${path}: ${response.status} ${JSON.stringify(body)}`
		)
	}
	return body
}

function listOf(value: unknown): unknown[] {
	return Array.isArray(value) ? Array.from<unknown>(value) : []
}

function tokenOf(body: unknown): string {
	if (!isRecord(body) || typeof body['access_token'] !== 'string') {
		throw new Error(`no access_token in ${JSON.stringify(body)}`)
	}
	return body['access_token']
}

function dataOf(body: unknown): unknown {
	if (!isEnvelope(body)) {
		throw new Error(`no data envelope in ${JSON.stringify(body)}`)
	}
	return body.data
}

export async function adminLogin(
	apiUrl: string,
	email: string,
	password: string
): Promise<AdminApi> {
	const response = await fetch(`${apiUrl}/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password })
	})
	const body = await bodyOf(response)
	if (!response.ok) {
		throw new Error(`POST /auth/login: ${response.status} ${JSON.stringify(body)}`)
	}
	const session: Session = { token: tokenOf(body), siteId: undefined }

	async function useSite(siteId: string): Promise<void> {
		if (session.siteId === siteId) {
			return
		}
		const switched = await call(apiUrl, session, '/auth/switch-site', {
			method: 'POST',
			body: JSON.stringify({ site_id: siteId })
		})
		session.token = tokenOf(switched)
		session.siteId = siteId
	}

	async function formId(key: string): Promise<string> {
		const forms = listOf(dataOf(await call(apiUrl, session, '/admin/forms')))
		const form = forms.find((item) => isRecord(item) && item['key'] === key)
		if (!isRecord(form) || typeof form['id'] !== 'string') {
			throw new Error(`form ${key} not found in the admin`)
		}
		return form['id']
	}

	return {
		submissions: async (siteId, formKey) => {
			await useSite(siteId)
			const id = await formId(formKey)
			const list = dataOf(
				await call(apiUrl, session, `/admin/forms/${id}/submissions?per_page=100`)
			)
			return listOf(list).filter(isSubmission)
		},
		setCaptchaSecret: async (siteId, secret) => {
			await useSite(siteId)
			const site = dataOf(await call(apiUrl, session, `/admin/sites/${siteId}`))
			const settings = isRecord(site) ? site['settings'] : undefined
			const captcha = isRecord(settings) ? settings['captcha'] : undefined
			if (!isRecord(settings) || !isRecord(captcha)) {
				throw new Error(`site ${siteId} has no captcha settings`)
			}
			const next: CaptchaSettings = {
				provider: String(captcha['provider']),
				site_key: String(captcha['site_key']),
				secret_key: secret
			}
			await call(apiUrl, session, `/admin/sites/${siteId}`, {
				method: 'PUT',
				body: JSON.stringify({ settings: { ...settings, captcha: next } })
			})
		}
	}
}
