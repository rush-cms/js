import { isRecord } from '@rushcms/client/internal'

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

export type Translated = Record<string, string>

export type SiteSettingsWrite = {
	default_locale: string
	locales: string[]
	homepage_preview_url_template: string
}

export type SiteWrite = {
	name: string
	slug: string
	settings: SiteSettingsWrite
}

export type CollectionWrite = {
	name: Translated
	slug: Translated
	preview_url_template: string
	site_locales: string[]
}

export type CollectionPatch = {
	items_per_page: number
	site_locales: string[]
}

export type NavigationAttributeWrite = {
	name: string
	value: string
}

export type NavigationItemWrite = {
	label: Translated
	type: 'url' | 'entry' | 'collection'
	url?: string
	collection_id?: string
	target?: string
	nofollow?: boolean
	noreferrer?: boolean
	class?: string
	attributes?: NavigationAttributeWrite[]
	children: NavigationItemWrite[]
}

export type NavigationWrite = {
	name: Translated
	key: string
	items: NavigationItemWrite[]
	is_active: boolean
}

export type EntryTranslationWrite = {
	title: string
	slug: string
	excerpt: string
	data: Record<string, unknown>
}

export type EntryWrite = {
	site_locales: string[]
	translations: Record<string, EntryTranslationWrite>
}

export type AdminApi = {
	submissions(siteId: string, formKey: string): Promise<Submission[]>
	setCaptchaSecret(siteId: string, secret: string): Promise<void>
	createMessageForm(siteId: string, key: string): Promise<string>
	deleteForm(siteId: string, formId: string): Promise<void>
	createSite(site: SiteWrite): Promise<string>
	deleteSite(siteId: string): Promise<void>
	createDeliveryToken(siteId: string, name: string): Promise<string>
	collectionId(siteId: string, locale: string, slug: string): Promise<string>
	createCollection(siteId: string, collection: CollectionWrite): Promise<string>
	updateCollection(siteId: string, collectionId: string, patch: CollectionPatch): Promise<void>
	createNavigation(siteId: string, navigation: NavigationWrite): Promise<string>
	deleteNavigation(siteId: string, navigationId: string): Promise<void>
	createEntry(siteId: string, collectionId: string, entry: EntryWrite): Promise<string>
	deleteEntry(siteId: string, collectionId: string, entryId: string): Promise<void>
	previewLink(siteId: string, document: string, locale: string): Promise<string>
}

type FormFieldWrite = {
	handle: string
	type: string
	label: Record<string, string>
	required: boolean
}

type FormWrite = {
	name: Record<string, string>
	key: string
	fields: FormFieldWrite[]
}

type Envelope = {
	data: unknown
}

type CookieJar = Map<string, string>

type Session = {
	token: string
	siteId: string | undefined
	cookies: CookieJar
}

const CSRF_COOKIE = 'rush_csrf'

const CSRF_HEADER = 'X-CSRF-Token'

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

function rememberCookies(jar: CookieJar, response: Response): void {
	for (const line of response.headers.getSetCookie()) {
		const [pair = '', ...attributes] = line.split(';').map((part) => part.trim())
		const separator = pair.indexOf('=')
		if (separator > 0 && !attributes.includes('Max-Age=0')) {
			jar.set(pair.slice(0, separator), pair.slice(separator + 1))
		}
	}
}

function cookieHeader(jar: CookieJar): string {
	return [...jar].map(([name, value]) => `${name}=${value}`).join('; ')
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
			Authorization: `Bearer ${session.token}`,
			Cookie: cookieHeader(session.cookies),
			[CSRF_HEADER]: session.cookies.get(CSRF_COOKIE) ?? ''
		}
	})
	rememberCookies(session.cookies, response)
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
	const session: Session = { token: tokenOf(body), siteId: undefined, cookies: new Map() }
	rememberCookies(session.cookies, response)

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

	function idOf(value: unknown): string {
		if (!isRecord(value) || typeof value['id'] !== 'string') {
			throw new Error(`no id in ${JSON.stringify(value)}`)
		}
		return value['id']
	}

	function post(path: string, body: unknown): Promise<unknown> {
		return call(apiUrl, session, path, { method: 'POST', body: JSON.stringify(body) })
	}

	async function create(siteId: string, path: string, body: unknown): Promise<string> {
		await useSite(siteId)
		return idOf(dataOf(await post(path, body)))
	}

	async function remove(siteId: string, path: string): Promise<void> {
		await useSite(siteId)
		await call(apiUrl, session, path, { method: 'DELETE' })
	}

	async function formId(key: string): Promise<string> {
		const forms = listOf(dataOf(await call(apiUrl, session, '/admin/forms')))
		const form = forms.find((item) => isRecord(item) && item['key'] === key)
		if (form === undefined) {
			throw new Error(`form ${key} not found in the admin`)
		}
		return idOf(form)
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
		},
		createMessageForm: (siteId, key) => {
			const form: FormWrite = {
				name: { en: key },
				key,
				fields: [
					{
						handle: 'message',
						type: 'textarea',
						label: { en: 'Message' },
						required: true
					}
				]
			}
			return create(siteId, '/admin/forms', form)
		},
		deleteForm: (siteId, id) => remove(siteId, `/admin/forms/${id}`),
		createSite: async (site) => idOf(dataOf(await post('/admin/sites', site))),
		deleteSite: async (siteId) => {
			await remove(siteId, `/admin/sites/${siteId}`)
			session.siteId = undefined
		},
		createDeliveryToken: async (siteId, name) => {
			await useSite(siteId)
			const created = await post('/admin/tokens', { name, scope: 'delivery' })
			if (!isRecord(created) || typeof created['token'] !== 'string') {
				throw new Error('no token in the created token response')
			}
			return created['token']
		},
		collectionId: async (siteId, locale, slug) => {
			await useSite(siteId)
			const collections = listOf(dataOf(await call(apiUrl, session, '/admin/collections')))
			const found = collections.find(
				(item) => isRecord(item) && isRecord(item['slug']) && item['slug'][locale] === slug
			)
			if (found === undefined) {
				throw new Error(`collection ${locale}:${slug} not found in the admin`)
			}
			return idOf(found)
		},
		createCollection: (siteId, collection) => create(siteId, '/admin/collections', collection),
		updateCollection: async (siteId, id, patch) => {
			await useSite(siteId)
			await call(apiUrl, session, `/admin/collections/${id}`, {
				method: 'PUT',
				body: JSON.stringify(patch)
			})
		},
		createNavigation: (siteId, navigation) => create(siteId, '/admin/navigations', navigation),
		deleteNavigation: (siteId, id) => remove(siteId, `/admin/navigations/${id}`),
		createEntry: (siteId, collectionId, entry) =>
			create(siteId, `/admin/collections/${collectionId}/entries`, entry),
		deleteEntry: (siteId, collectionId, id) =>
			remove(siteId, `/admin/collections/${collectionId}/entries/${id}`),
		previewLink: async (siteId, document, locale) => {
			await useSite(siteId)
			const link = dataOf(await post(`/admin${document}/preview-link`, { locale }))
			if (!isRecord(link) || typeof link['url'] !== 'string') {
				throw new Error(`no url in the preview link of ${document}`)
			}
			return link['url']
		}
	}
}
