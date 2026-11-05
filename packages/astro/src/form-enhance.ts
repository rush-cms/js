import { isRecord } from '@rushcms/client'
import { formStatusOf, messageFor } from './form-model'
import type { FormMessages } from './form-model'
import type { FormStatus } from './forms'

type FieldErrorBody = {
	field: string
	code: string
	params?: Record<string, unknown>
}

const FORM_SELECTOR = 'form[data-rush-form]'
const STATUS_SELECTOR = '[data-rush-status]'
const ERROR_SELECTOR = '[data-rush-error-for]'

function messagesOf(form: HTMLFormElement): FormMessages {
	try {
		const parsed: unknown = JSON.parse(form.dataset.messages ?? '{}')
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

function showStatus(form: HTMLFormElement, status: FormStatus | undefined): void {
	const element = form.querySelector<HTMLElement>(STATUS_SELECTOR)
	if (element === null) {
		return
	}
	element.hidden = status === undefined
	element.textContent = status === undefined ? '' : messageFor(messagesOf(form), status)
	if (status === undefined) {
		delete element.dataset.rushStatus
	} else {
		element.dataset.rushStatus = status
	}
}

function controlsOf(form: HTMLFormElement, handle: string): Element[] {
	return [...form.elements].filter((element) => element.getAttribute('name') === handle)
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
		(candidate) => candidate.dataset.rushErrorFor === error.field
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

async function fieldErrorsOf(response: Response): Promise<FieldErrorBody[]> {
	try {
		const body: unknown = await response.json()
		return isRecord(body) && Array.isArray(body.errors) ? body.errors.filter(isFieldError) : []
	} catch {
		return []
	}
}

function resetCaptcha(): void {
	const turnstile: unknown = Reflect.get(window, 'turnstile')
	if (isRecord(turnstile) && typeof turnstile.reset === 'function') {
		turnstile.reset()
	}
}

async function send(form: HTMLFormElement): Promise<void> {
	clearErrors(form)
	showStatus(form, undefined)
	try {
		const response = await fetch(form.action, {
			method: 'POST',
			body: new FormData(form),
			headers: { Accept: 'application/json' }
		})
		if (response.ok) {
			form.reset()
			showStatus(form, 'sent')
			return
		}
		for (const error of await fieldErrorsOf(response)) {
			showFieldError(form, error)
		}
		showStatus(form, 'error')
	} catch {
		showStatus(form, 'error')
	} finally {
		resetCaptcha()
	}
}

function enhance(form: HTMLFormElement): void {
	form.addEventListener('submit', (event) => {
		event.preventDefault()
		const buttons = form.querySelectorAll<HTMLButtonElement>('button[type="submit"]')
		for (const button of buttons) {
			button.disabled = true
		}
		void send(form).finally(() => {
			for (const button of buttons) {
				button.disabled = false
			}
		})
	})
	const status = formStatusOf(
		new URLSearchParams(window.location.search),
		form.dataset.rushForm ?? ''
	)
	if (status !== undefined) {
		showStatus(form, status)
	}
}

export function enhanceForms(root: ParentNode): void {
	for (const form of root.querySelectorAll<HTMLFormElement>(FORM_SELECTOR)) {
		enhance(form)
	}
}
