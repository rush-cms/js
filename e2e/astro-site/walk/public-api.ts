import { createClient } from '@rushcms/client'
import type { RushClient } from '@rushcms/client'
import type { ContactData } from './contact-form.ts'
import type { WalkEnv } from './env.ts'

export type DirectOutcome = {
	status: number
	retryAfter: string | null
}

export async function submitContactDirect(
	env: WalkEnv,
	visitorIp: string,
	data: ContactData
): Promise<DirectOutcome> {
	const response = await fetch(`${env.apiUrl}/api/v1/${env.siteId}/forms/contact/submit`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${env.apiToken}`,
			'X-Rush-Client-IP': visitorIp
		},
		body: JSON.stringify(data)
	})
	return { status: response.status, retryAfter: response.headers.get('Retry-After') }
}

export function publicClient(env: WalkEnv): RushClient {
	return createClient({ url: env.apiUrl, siteId: env.siteId, token: env.apiToken })
}
