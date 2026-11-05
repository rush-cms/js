import type { HeadersOf } from '../contract'
import type { RequestHeaders } from '../transport'
import type { FormSubmitData, FormSubmitOptions, FormsResource } from '../types'
import { createCatalog } from './catalog'
import type { ResourceContext } from './context'

type SubmitHeaders = HeadersOf<'submitForm'>

function contractHeaders(options: FormSubmitOptions): SubmitHeaders {
	const headers: SubmitHeaders = {}
	if (options.clientIp !== undefined) {
		headers['X-Rush-Client-IP'] = options.clientIp
	}
	if (options.captchaToken !== undefined) {
		headers['X-Captcha-Token'] = options.captchaToken
	}
	return headers
}

function encode(data: FormSubmitData, headers: SubmitHeaders): [BodyInit, RequestHeaders] {
	if (data instanceof FormData) {
		return [data, { ...headers }]
	}
	return [JSON.stringify(data), { ...headers, 'Content-Type': 'application/json' }]
}

export function createForms(context: ResourceContext): FormsResource {
	return {
		...createCatalog<'listForms', 'getForm'>(context, 'forms', 'localized'),
		submit: (key, data, options = {}) => {
			const [body, headers] = encode(data, contractHeaders(options))
			return context.send<'submitForm'>(['forms', key, 'submit'], body, headers)
		}
	}
}
