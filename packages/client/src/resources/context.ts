import type { DataOf, Envelope, OperationId, PageBody, PageOf } from '../contract'
import { clientError } from '../errors'
import { isRecord } from '../json'
import type { QueryParams, RequestHeaders, Transport } from '../transport'
import type { RushClientConfig } from '../types'

export type LocaleScope = 'localized' | 'unlocalized'

export type RequestDefaults = Pick<RushClientConfig, 'locale' | 'perspective'>

export type ResourceContext = {
	data<O extends OperationId>(
		segments: readonly string[],
		options: QueryParams | undefined,
		scope: LocaleScope
	): Promise<DataOf<O>>
	page<O extends OperationId>(
		segments: readonly string[],
		options: QueryParams | undefined,
		scope: LocaleScope
	): Promise<PageOf<O>>
	send<O extends OperationId>(
		segments: readonly string[],
		body: BodyInit,
		headers: RequestHeaders
	): Promise<DataOf<O>>
}

export function createContext(transport: Transport, defaults: RequestDefaults): ResourceContext {
	function resolve(options: QueryParams = {}, scope: LocaleScope): QueryParams {
		const perspective = options.perspective ?? defaults.perspective
		if (scope === 'unlocalized') {
			return { ...options, perspective }
		}
		return { ...options, locale: options.locale ?? defaults.locale, perspective }
	}

	function unwrap<D>(body: unknown): D {
		return (body as Envelope<D>).data
	}

	return {
		async data<O extends OperationId>(
			segments: readonly string[],
			options: QueryParams | undefined,
			scope: LocaleScope
		) {
			return unwrap<DataOf<O>>(await transport.get(segments, resolve(options, scope)))
		},
		async page<O extends OperationId>(
			segments: readonly string[],
			options: QueryParams | undefined,
			scope: LocaleScope
		) {
			const body = (await transport.get(
				segments,
				resolve(options, scope)
			)) as PageBody<unknown>
			if (!Array.isArray(body.data) || !isRecord(body.meta)) {
				throw clientError(200, 'invalid_response', 'response is not a paginated envelope')
			}
			return { items: body.data, meta: body.meta } as PageOf<O>
		},
		async send<O extends OperationId>(
			segments: readonly string[],
			body: BodyInit,
			headers: RequestHeaders
		) {
			return unwrap<DataOf<O>>(await transport.post(segments, body, headers))
		}
	}
}
