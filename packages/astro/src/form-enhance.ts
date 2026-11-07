import { isRecord } from '@rushcms/client/internal'
import { formStatusOf, messageFor } from './form-model'
import type { FormMessages, MessageParams } from './form-model'
import type { FormStatus } from './forms'

export type FetchFunction = typeof fetch

type FieldErrorBody = {
	field: string
	code: string
	params?: MessageParams
}

type FormFailure = {
	code?: string
	params?: MessageParams
	errors: FieldErrorBody[]
}

const FORM_SELECTOR = 'form[data-rush-form]'
const STATUS_SELECTOR = '[data-rush-status]'
const ERROR_SELECTOR = '[data-rush-error-for]'
const SUBMIT_SELECTOR = 'button[type="submit"]'

function messagesOf(form: HTMLFormElement): FormMessages {
	try {
		const parsed: unknown = JSON.parse(form.getAttribute('data-messages') ?? '{}')
		return isRecord(parsed)
			? Object.fromEntries(
					Object.entries(parsed).filter(
						(entry): entry is [string, string] => typeof entry[1] === 'string'
					)
				)
			: {}
	} catch {
		return {}
	}
}

function showStatus(form: HTMLFormElement, status: FormStatus | undefined, text?: string): void {
	const element = form.querySelector<HTMLElement>(STATUS_SELECTOR)
	if (element === null) {
		return
	}
	element.hidden = status === undefined
	element.textContent = status === undefined ? '' : (text ?? messageFor(messagesOf(form), status))
	if (status === undefined) {
		element.removeAttribute('data-state')
	} else {
		element.setAttribute('data-state', status)
	}
}

function controlsOf(form: HTMLFormElement, handle: string): Element[] {
	return [...form.querySelectorAll('[name]')].filter(
		(element) => element.getAttribute('name') === handle
	)
}

function clearErrors(form: HTMLFormElement): void {
	for (const element of form.querySelectorAll<HTMLElement>(ERROR_SELECTOR)) {
		element.hidden = true
		element.textContent = ''
	}
	for (const control of form.querySelectorAll('[aria-invalid]')) {
		control.removeAttribute('aria-invalid')
	}
}

function showFieldError(form: HTMLFormElement, error: FieldErrorBody): void {
	const element = [...form.querySelectorAll<HTMLElement>(ERROR_SELECTOR)].find(
		(candidate) => candidate.getAttribute('data-rush-error-for') === error.field
	)
	if (element === undefined) {
		return
	}
	element.hidden = false
	element.textContent = messageFor(messagesOf(form), error.code, error.params)
	for (const control of controlsOf(form, error.field)) {
		control.setAttribute('aria-invalid', 'true')
	}
}

function isFieldError(value: unknown): value is FieldErrorBody {
	return isRecord(value) && typeof value.field === 'string' && typeof value.code === 'string'
}

async function failureOf(response: Response): Promise<FormFailure> {
	try {
		const body: unknown = await response.json()
		if (!isRecord(body)) {
			return { errors: [] }
		}
		return {
			errors: Array.isArray(body.errors) ? body.errors.filter(isFieldError) : [],
			...(typeof body.code === 'string' ? { code: body.code } : {}),
			...(isRecord(body.params) ? { params: body.params } : {})
		}
	} catch {
		return { errors: [] }
	}
}

function failureText(form: HTMLFormElement, failure: FormFailure): string {
	const messages = messagesOf(form)
	return failure.code !== undefined && Object.hasOwn(messages, failure.code)
		? messageFor(messages, failure.code, failure.params)
		: messageFor(messages, 'error')
}

function resetCaptcha(): void {
	const turnstile: unknown = Reflect.get(window, 'turnstile')
	if (isRecord(turnstile) && typeof turnstile.reset === 'function') {
		turnstile.reset()
	}
}

export async function sendForm(form: HTMLFormElement, fetchImpl: FetchFunction): Promise<void> {
	clearErrors(form)
	showStatus(form, undefined)
	try {
		const response = await fetchImpl(form.getAttribute('action') ?? '', {
			method: 'POST',
			body: new FormData(form),
			headers: { Accept: 'application/json' }
		})
		if (response.ok) {
			HTMLFormElement.prototype.reset.call(form)
			showStatus(form, 'sent')
			return
		}
		const failure = await failureOf(response)
		for (const error of failure.errors) {
			showFieldError(form, error)
		}
		showStatus(form, 'error', failureText(form, failure))
	} catch {
		showStatus(form, 'error')
	} finally {
		resetCaptcha()
	}
}

export async function submitForm(form: HTMLFormElement, fetchImpl: FetchFunction): Promise<void> {
	const buttons = form.querySelectorAll<HTMLButtonElement>(SUBMIT_SELECTOR)
	for (const button of buttons) {
		button.disabled = true
	}
	try {
		await sendForm(form, fetchImpl)
	} finally {
		for (const button of buttons) {
			button.disabled = false
		}
	}
}

function enhance(form: HTMLFormElement, fetchImpl: FetchFunction): void {
	form.addEventListener('submit', (event) => {
		event.preventDefault()
		void submitForm(form, fetchImpl)
	})
	const status = formStatusOf(
		new URLSearchParams(window.location.search),
		form.getAttribute('data-rush-form') ?? ''
	)
	if (status !== undefined) {
		showStatus(form, status)
	}
}

export function enhanceForms(root: ParentNode, fetchImpl: FetchFunction = fetch): void {
	for (const form of root.querySelectorAll<HTMLFormElement>(FORM_SELECTOR)) {
		enhance(form, fetchImpl)
	}
}
