import { afterEach, describe, expect, it, vi } from 'vitest'
import { enhanceForms, sendForm, submitForm } from '../src/form-enhance'
import type { FetchFunction } from '../src/form-enhance'

type Deferred = {
	promise: Promise<Response>
	resolve(response: Response): void
}

const MESSAGES = {
	sent: 'Thanks!',
	error: 'Something went wrong',
	required: 'Required',
	too_short: 'At least {min} characters',
	rate_limited: 'Try again in {retry_after} seconds',
	captcha_failed: 'Captcha failed'
}

function formHtml(extra = ''): string {
	return `
		<form method="post" action="/_rush/forms/contact" data-rush-form="contact" data-messages='${JSON.stringify(MESSAGES)}'>
			<p role="status" data-rush-status hidden></p>
			<input name="email" value="a@b.c">
			<p data-rush-error-for="email" hidden></p>
			<input name="name" value="Ann">
			<p data-rush-error-for="name" hidden></p>
			${extra}
			<button type="submit">Send</button>
		</form>`
}

function mount(extra = ''): HTMLFormElement {
	document.body.innerHTML = formHtml(extra)
	const form = document.querySelector('form')
	if (form === null) {
		throw new Error('form did not mount')
	}
	return form
}

function controlOf(form: HTMLFormElement, name: string): HTMLInputElement {
	const control = form.querySelector<HTMLInputElement>(`input[name=${name}]`)
	if (control === null) {
		throw new Error(`no control ${name}`)
	}
	return control
}

function typeInto(form: HTMLFormElement, name: string, value: string): void {
	controlOf(form, name).value = value
}

function valueOf(form: HTMLFormElement, name: string): string {
	return controlOf(form, name).value
}

function replying(response: Response): FetchFunction & ReturnType<typeof vi.fn> {
	return vi.fn(async () => response)
}

function deferred(): Deferred {
	let resolve: (response: Response) => void = () => undefined
	const promise = new Promise<Response>((done) => {
		resolve = done
	})
	return { promise, resolve }
}

function failure(status: number, body: Record<string, unknown>): Response {
	return Response.json(body, { status })
}

function text(selector: string): string {
	return document.querySelector(selector)?.textContent ?? ''
}

afterEach(() => {
	document.body.innerHTML = ''
	window.history.replaceState(null, '', '/')
})

describe('sendForm', () => {
	it('posts the form data as multipart asking for json', async () => {
		const form = mount()
		const fetchImpl = replying(Response.json({ data: { received: true } }, { status: 201 }))
		await sendForm(form, fetchImpl)
		const [url, init] = fetchImpl.mock.calls[0] ?? []
		expect(url).toBe('/_rush/forms/contact')
		expect(init?.method).toBe('POST')
		expect(new Headers(init?.headers).get('Accept')).toBe('application/json')
		const body = init?.body
		expect(body).toBeInstanceOf(FormData)
		expect((body as FormData).get('email')).toBe('a@b.c')
	})

	it('shows the sent status and resets the form on success', async () => {
		const form = mount()
		typeInto(form, 'email', 'typed')
		await sendForm(form, replying(Response.json({ data: {} }, { status: 201 })))
		expect(text('[data-rush-status]')).toBe('Thanks!')
		expect(valueOf(form, 'email')).toBe('a@b.c')
		expect(document.querySelector<HTMLElement>('[data-rush-status]')?.hidden).toBe(false)
		expect(form.querySelector('[data-rush-status]')?.getAttribute('data-state')).toBe('sent')
	})

	it('puts field errors under their field with aria-invalid and interpolated params', async () => {
		const form = mount()
		await sendForm(
			form,
			replying(
				failure(422, {
					code: 'validation_failed',
					errors: [
						{ field: 'email', code: 'required' },
						{ field: 'name', code: 'too_short', params: { min: 3 } },
						{ field: 'unknown', code: 'required' }
					]
				})
			)
		)
		expect(text('[data-rush-error-for=email]')).toBe('Required')
		expect(text('[data-rush-error-for=name]')).toBe('At least 3 characters')
		expect(form.querySelector('[name=email]')?.getAttribute('aria-invalid')).toBe('true')
		expect(form.querySelector('[name=name]')?.getAttribute('aria-invalid')).toBe('true')
		expect(document.querySelector<HTMLElement>('[data-rush-error-for=email]')?.hidden).toBe(
			false
		)
		expect(text('[data-rush-status]')).toBe('Something went wrong')
	})

	it('clears previous errors before sending again', async () => {
		const form = mount()
		await sendForm(
			form,
			replying(
				failure(422, {
					code: 'validation_failed',
					errors: [{ field: 'email', code: 'required' }]
				})
			)
		)
		await sendForm(form, replying(Response.json({ data: {} }, { status: 201 })))
		expect(text('[data-rush-error-for=email]')).toBe('')
		expect(form.querySelector('[name=email]')?.hasAttribute('aria-invalid')).toBe(false)
	})

	it('shows the top-level code message with retry_after on a 429', async () => {
		const form = mount()
		await sendForm(
			form,
			replying(
				failure(429, { code: 'rate_limited', params: { retry_after: 42 }, errors: [] })
			)
		)
		expect(text('[data-rush-status]')).toBe('Try again in 42 seconds')
	})

	it('shows the captcha message and falls back to the error status for unknown codes', async () => {
		const form = mount()
		await sendForm(form, replying(failure(422, { code: 'captcha_failed', errors: [] })))
		expect(text('[data-rush-status]')).toBe('Captcha failed')
		await sendForm(form, replying(failure(503, { code: 'captcha_unavailable', errors: [] })))
		expect(text('[data-rush-status]')).toBe('Something went wrong')
	})

	it('shows the error status for an unreadable body or a network failure', async () => {
		const form = mount()
		await sendForm(form, replying(new Response('<html>', { status: 502 })))
		expect(text('[data-rush-status]')).toBe('Something went wrong')
		const broken = vi.fn(async () => {
			throw new TypeError('offline')
		})
		await sendForm(form, broken)
		expect(text('[data-rush-status]')).toBe('Something went wrong')
	})

	it('works with controls named action and reset', async () => {
		const form = mount('<input name="action" value="x"><input name="reset" value="y">')
		typeInto(form, 'action', 'typed')
		const fetchImpl = replying(Response.json({ data: {} }, { status: 201 }))
		await sendForm(form, fetchImpl)
		expect(fetchImpl.mock.calls[0]?.[0]).toBe('/_rush/forms/contact')
		expect(form.querySelector<HTMLInputElement>('[name=action]')?.value).toBe('x')
		expect(text('[data-rush-status]')).toBe('Thanks!')
	})

	it('puts the error on a field named action', async () => {
		const form = mount('<input name="action"><p data-rush-error-for="action" hidden></p>')
		await sendForm(
			form,
			replying(
				failure(422, {
					code: 'validation_failed',
					errors: [{ field: 'action', code: 'required' }]
				})
			)
		)
		expect(text('[data-rush-error-for=action]')).toBe('Required')
	})
})

describe('submitForm', () => {
	it('disables the submit buttons while sending and enables them afterwards', async () => {
		const form = mount()
		const button = form.querySelector('button')
		const pending = deferred()
		const done = submitForm(
			form,
			vi.fn(() => pending.promise)
		)
		expect(button?.disabled).toBe(true)
		pending.resolve(Response.json({ data: {} }, { status: 201 }))
		await done
		expect(button?.disabled).toBe(false)
	})

	it('enables the buttons again after a failure', async () => {
		const form = mount()
		await submitForm(form, replying(failure(500, {})))
		expect(form.querySelector('button')?.disabled).toBe(false)
	})
})

describe('enhanceForms', () => {
	it('takes over the submit event', async () => {
		const form = mount()
		const pending = deferred()
		const fetchImpl = vi.fn(() => pending.promise)
		enhanceForms(document, fetchImpl)
		const event = new Event('submit', { cancelable: true })
		form.dispatchEvent(event)
		expect(event.defaultPrevented).toBe(true)
		expect(fetchImpl).toHaveBeenCalledOnce()
		pending.resolve(Response.json({ data: {} }, { status: 201 }))
		await pending.promise
	})

	it('shows the status found in the query string for its form', () => {
		window.history.replaceState(null, '', '/contact?rush_form=contact&status=sent')
		mount()
		enhanceForms(document, vi.fn())
		expect(text('[data-rush-status]')).toBe('Thanks!')
	})

	it('ignores the status of another form', () => {
		window.history.replaceState(null, '', '/contact?rush_form=other&status=sent')
		mount()
		enhanceForms(document, vi.fn())
		expect(text('[data-rush-status]')).toBe('')
	})
})
