import type { Form } from '@rushcms/client'
import type { FormStatus } from './forms'

export type FormMessages = Record<string, string>

export type MessageParams = Record<string, unknown>

export type FormField = Form['fields'][number]

export type ChoiceKind = 'select' | 'radio' | 'checkbox'

export const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js'

const STATUSES: FormStatus[] = ['sent', 'error']

const PARAM_PLACEHOLDER = /\{(\w+)\}/g

export function formAction(key: string): string {
	return `/_rush/forms/${encodeURIComponent(key)}`
}

export function formStatusOf(params: URLSearchParams, key: string): FormStatus | undefined {
	const status = params.get('status')
	return params.get('rush_form') === key ? STATUSES.find((item) => item === status) : undefined
}

export function messageFor(
	messages: FormMessages,
	code: string,
	params: MessageParams = {}
): string {
	const template = Object.hasOwn(messages, code) ? messages[code] : undefined
	return (template ?? code).replace(PARAM_PLACEHOLDER, (placeholder, name: string) =>
		Object.hasOwn(params, name) ? String(params[name]) : placeholder
	)
}

export function fieldId(form: Form, field: FormField): string {
	return `rush-form-${form.key}-${field.handle}`
}

export function errorId(form: Form, field: FormField): string {
	return `${fieldId(form, field)}-error`
}

export function helpId(form: Form, field: FormField): string {
	return `${fieldId(form, field)}-help`
}
