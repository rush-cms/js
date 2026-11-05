import { describe, expect, it } from 'vitest'
import FormComponent from '../src/components/form.astro'
import { formStatusOf, messageFor } from '../src/form-model'
import { formExample } from '../../client/tests/fixtures/contract'
import type { Form } from '@rushcms/client'
import { renderComponent } from './fixtures/render'

const FIELD_TYPES = [
	'text',
	'email',
	'textarea',
	'number',
	'tel',
	'url',
	'date',
	'select',
	'radio',
	'checkbox',
	'hidden'
] as const

function withFields(fields: Form['fields'], extra: Partial<Form> = {}): Form {
	const form = { ...formExample(), ...extra, fields }
	delete form.captcha
	return form
}

function render(form: Form, search = '', messages: Record<string, string> = {}) {
	return renderComponent(FormComponent, {
		props: { form, messages },
		url: `https://site.example/contact${search}`
	})
}

describe('Form rendering', () => {
	it('posts to the injected route as a plain html form', async () => {
		const html = await render(formExample())
		expect(html).toContain('method="post"')
		expect(html).toContain('action="/_rush/forms/contact"')
		expect(html).toContain('data-rush-form="contact"')
	})

	it('renders the schema fields with their constraints', async () => {
		const html = await render(formExample())
		expect(html).toContain('<label for="rush-form-contact-name">Nome</label>')
		expect(html).toMatch(
			/<input[^>]*type="text"[^>]*name="name"[^>]*required[^>]*maxlength="120"/
		)
		expect(html).toMatch(
			/<input[^>]*type="email"[^>]*name="email"[^>]*placeholder="voce@exemplo.com"/
		)
		expect(html).toContain('<legend>Assuntos</legend>')
		expect(html).toMatch(/<input[^>]*type="checkbox"[^>]*name="topics"[^>]*value="support"/)
		expect(html).toContain('Vendas')
		expect(html).toContain('data-rush-error-for="topics"')
	})

	it('renders every contract field type', async () => {
		const options = [{ value: 'a', label: 'Option A' }]
		const fields = FIELD_TYPES.map((type) => ({
			handle: `f_${type}`,
			type,
			label: `Label ${type}`,
			options: type === 'select' || type === 'radio' ? options : []
		}))
		const html = await render(withFields(fields))
		expect(html).toContain('<textarea')
		expect(html).toContain('<select')
		expect(html).toContain('<option value="a">Option A</option>')
		expect(html).toMatch(/<input[^>]*type="radio"[^>]*name="f_radio"[^>]*value="a"/)
		expect(html).toMatch(/<input[^>]*type="checkbox"[^>]*name="f_checkbox"/)
		expect(html).toMatch(/<input[^>]*type="hidden"[^>]*name="f_hidden"/)
		for (const type of ['number', 'tel', 'url', 'date']) {
			expect(html).toMatch(new RegExp(`<input[^>]*type="${type}"[^>]*name="f_${type}"`))
		}
	})

	it('wires help text and number and pattern constraints', async () => {
		const html = await render(
			withFields([
				{
					handle: 'age',
					type: 'number',
					label: 'Age',
					help_text: 'In years',
					min: 18,
					max: 99,
					pattern: '\\d+'
				}
			])
		)
		expect(html).toContain('aria-describedby="rush-form-contact-age-help"')
		expect(html).toContain('<p id="rush-form-contact-age-help">In years</p>')
		expect(html).toMatch(/min="18"/)
		expect(html).toMatch(/max="99"/)
		expect(html).toMatch(/pattern="\\d\+"/)
	})

	it('renders the honeypot input only when the form has one', async () => {
		expect(await render(formExample())).toContain('name="_gotcha"')
		const form = formExample()
		delete form.honeypot_field
		expect(await render(form)).not.toContain('_gotcha')
	})

	it('escapes labels', async () => {
		const html = await render(
			withFields([{ handle: 'x', type: 'text', label: '<script>alert(1)</script>' }])
		)
		expect(html).not.toContain('<script>alert(1)</script>')
	})
})

describe('Form captcha', () => {
	it('adds the Turnstile widget and script only when the schema has captcha', async () => {
		const html = await render(formExample())
		expect(html).toContain('class="cf-turnstile"')
		expect(html).toContain('data-sitekey="1x00000000000000000000AA"')
		expect(html).toContain('https://challenges.cloudflare.com/turnstile/v0/api.js')
	})

	it('adds nothing without captcha', async () => {
		const html = await render(withFields(formExample().fields))
		expect(html).not.toContain('cf-turnstile')
		expect(html).not.toContain('challenges.cloudflare.com')
	})
})

describe('Form status and messages', () => {
	it('shows the status of this form from the query string', async () => {
		const html = await render(formExample(), '?rush_form=contact&status=sent', {
			sent: 'Thanks!'
		})
		expect(html).toMatch(/<p role="status" data-rush-status="sent"[^>]*>\s*Thanks!\s*<\/p>/)
	})

	it('falls back to the status code without a message', async () => {
		const html = await render(formExample(), '?rush_form=contact&status=error')
		expect(html).toMatch(/data-rush-status="error"[^>]*>\s*error\s*<\/p>/)
	})

	it('ignores the status of another form or an unknown status', async () => {
		for (const search of ['?rush_form=other&status=sent', '?rush_form=contact&status=boom']) {
			const html = await render(formExample(), search)
			expect(html).toMatch(/<p role="status"[^>]* hidden[^>]*>\s*<\/p>/)
		}
	})

	it('embeds the messages for the client script as data', async () => {
		const html = await render(formExample(), '', { required: 'Required "field"' })
		expect(html).toContain(
			'data-messages="{&quot;required&quot;:&quot;Required \\&quot;field\\&quot;&quot;}"'
		)
	})
})

describe('form model', () => {
	it('looks field error messages up by code with params and falls back to the code', () => {
		const messages = {
			required: 'This field is required',
			too_short: 'At least {min} characters',
			constructor: 'x'
		}
		expect(messageFor(messages, 'required')).toBe('This field is required')
		expect(messageFor(messages, 'too_short', { min: 3 })).toBe('At least 3 characters')
		expect(messageFor(messages, 'too_short')).toBe('At least {min} characters')
		expect(messageFor(messages, 'invalid_email')).toBe('invalid_email')
		expect(messageFor({}, 'constructor')).toBe('constructor')
		expect(messageFor({}, 'toString')).toBe('toString')
	})

	it('reads the status only for the matching form', () => {
		const params = (search: string) => new URLSearchParams(search)
		expect(formStatusOf(params('rush_form=a&status=sent'), 'a')).toBe('sent')
		expect(formStatusOf(params('rush_form=a&status=error'), 'a')).toBe('error')
		expect(formStatusOf(params('rush_form=a&status=sent'), 'b')).toBeUndefined()
		expect(formStatusOf(params('rush_form=a&status=toString'), 'a')).toBeUndefined()
		expect(formStatusOf(params(''), 'a')).toBeUndefined()
	})
})
