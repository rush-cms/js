import type { Schemas } from './contract'
import { isRecord } from './json'

export type ContractErrorCode = Schemas['ErrorCode']

export type ClientErrorCode = 'network_error' | 'invalid_response'

export type RushErrorCode = ContractErrorCode | ClientErrorCode

export type ErrorParams = Schemas['ErrorParams']

export type FieldError = Schemas['FieldError']

export type MovedParams = Required<
	Pick<ErrorParams, 'locale' | 'slug' | 'collection_id' | 'collection_slug'>
>

export type RushErrorParamsByCode = {
	locale_not_served: Required<Pick<ErrorParams, 'available'>>
	not_translated: Required<Pick<ErrorParams, 'available'>>
	not_found: Required<Pick<ErrorParams, 'resource'>>
	moved: MovedParams
	rate_limited: Required<Pick<ErrorParams, 'retry_after'>>
}

export type RushErrorParams<C extends RushErrorCode> = C extends keyof RushErrorParamsByCode
	? RushErrorParamsByCode[C]
	: Record<string, unknown>

export type RushErrorInit<C extends RushErrorCode> = {
	status: number
	code: C
	message: string
	params: RushErrorParams<C>
	errors: FieldError[]
	cause?: unknown
}

export class RushError<C extends RushErrorCode = RushErrorCode> extends Error {
	override readonly name = 'RushError'
	readonly status: number
	readonly code: C
	readonly params: RushErrorParams<C>
	readonly errors: FieldError[]

	constructor(init: RushErrorInit<C>) {
		super(init.message, { cause: init.cause })
		this.status = init.status
		this.code = init.code
		this.params = init.params
		this.errors = init.errors
	}
}

export function isRushError<C extends RushErrorCode>(err: unknown, code?: C): err is RushError<C> {
	return err instanceof RushError && (code === undefined || err.code === code)
}

export function clientError(
	status: number,
	code: ClientErrorCode,
	message: string,
	cause?: unknown
): RushError {
	return new RushError({ status, code, message, params: {}, errors: [], cause })
}

type ErrorBody = Schemas['Error']

function isErrorBody(value: unknown): value is ErrorBody {
	return isRecord(value) && typeof value.code === 'string' && typeof value.error === 'string'
}

export function errorFromBody(status: number, body: unknown): RushError {
	if (!isErrorBody(body)) {
		return clientError(status, 'invalid_response', `unexpected error response (HTTP ${status})`)
	}
	return new RushError({
		status,
		code: body.code,
		message: body.error,
		params: isRecord(body.params) ? body.params : {},
		errors: Array.isArray(body.errors) ? body.errors : []
	})
}
