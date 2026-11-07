import { RushError, isRushError } from '@rushcms/client'
import { isRecord } from '@rushcms/client/internal'
import type { FormSubmitData, FormSubmitOptions } from '@rushcms/client'
import type { APIContext } from 'astro'
import { seeOther } from './http'
import { runtimeOf } from './runtime'
import type { RushRuntime } from './runtime'
import { sameOriginUrl } from './same-origin'
import { FORWARDED_FOR_HEADER, visitorIp, visitorIpWarning } from './visitor-ip'
import type { VisitorIpSource } from './visitor-ip'

export type FormContext = Pick<
	APIContext,
	'request' | 'params' | 'url' | 'clientAddress' | 'locals' | 'logger'
>

export type FormStatus = 'sent' | 'error'

type Submission = {
	data: FormSubmitData
	captchaToken: string | undefined
}

type SubmissionBody = {
	data: FormSubmitData
	captchaField: unknown
}

const CAPTCHA_FIELD = 'cf-turnstile-response'
const FORM_TYPES = ['application/x-www-form-urlencoded', 'multipart/form-data']

function badRequest(message: string, cause?: unknown): RushError {
	return new RushError({
		status: 400,
		code: 'bad_request',
		message,
		params: {},
		errors: [],
		cause
	})
}

function mediaType(request: Request): string {
	return (request.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
}

function text(value: unknown): string | undefined {
	return typeof value === 'string' && value !== '' ? value : undefined
}

async function parse<T>(read: () => Promise<T>): Promise<T> {
	try {
		return await read()
	} catch (err) {
		throw badRequest('unreadable form body', err)
	}
}

async function readBody(request: Request): Promise<SubmissionBody> {
	const type = mediaType(request)
	if (type === 'application/json') {
		const body: unknown = await parse(() => request.json())
		if (!isRecord(body)) {
			throw badRequest('form body must be a JSON object')
		}
		return { data: body, captchaField: body[CAPTCHA_FIELD] }
	}
	if (FORM_TYPES.includes(type)) {
		const form = await parse(() => request.formData())
		return { data: form, captchaField: form.get(CAPTCHA_FIELD) }
	}
	throw badRequest(`unsupported content type "${type}"`)
}

async function readSubmission(request: Request): Promise<Submission> {
	const { data, captchaField } = await readBody(request)
	return {
		data,
		captchaToken: text(captchaField) ?? text(request.headers.get('x-captcha-token'))
	}
}

function clientAddress(context: FormContext): string | undefined {
	try {
		return context.clientAddress
	} catch {
		return undefined
	}
}

function submitOptions(
	context: FormContext,
	runtime: RushRuntime,
	captchaToken: string | undefined
): FormSubmitOptions {
	const source: VisitorIpSource = {
		forwardedFor: context.request.headers.get(FORWARDED_FOR_HEADER),
		clientAddress: clientAddress(context),
		trustedProxies: runtime.trustedProxies
	}
	const warning = visitorIpWarning(source)
	if (warning !== undefined) {
		runtime.warnOnce(context.logger, warning)
	}
	const ip = visitorIp(source)
	return {
		...(ip === undefined ? {} : { clientIp: ip }),
		...(captchaToken === undefined ? {} : { captchaToken })
	}
}

function wantsJson(request: Request): boolean {
	return (request.headers.get('accept') ?? '').toLowerCase().includes('application/json')
}

function errorStatus(err: RushError): number {
	return err.status >= 400 ? err.status : 502
}

function errorJson(err: RushError): Response {
	return Response.json(
		{ code: err.code, params: err.params, errors: err.errors },
		{ status: errorStatus(err) }
	)
}

function redirectTarget(context: FormContext, key: string, status: FormStatus): string {
	const target = sameOriginUrl(context.request.headers.get('referer'), context.url)
	if (target === undefined) {
		return '/'
	}
	target.searchParams.set('rush_form', key)
	target.searchParams.set('status', status)
	target.hash = ''
	return target.href
}

function redirect(context: FormContext, key: string, status: FormStatus): Response {
	return seeOther(redirectTarget(context, key, status))
}

export async function submitForm(context: FormContext): Promise<Response> {
	const key = context.params.key ?? ''
	const json = wantsJson(context.request)
	try {
		const submission = await readSubmission(context.request)
		const runtime = runtimeOf(context.locals)
		const result = await runtime
			.onDemandClient()
			.forms.submit(
				key,
				submission.data,
				submitOptions(context, runtime, submission.captchaToken)
			)
		return json
			? Response.json({ data: result }, { status: 201 })
			: redirect(context, key, 'sent')
	} catch (err) {
		if (!isRushError(err)) {
			throw err
		}
		return json ? errorJson(err) : redirect(context, key, 'error')
	}
}
