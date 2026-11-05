import type { components, operations } from './generated/api'

export type Schemas = components['schemas']

export type OperationId = keyof operations

export type JsonResponse<B> = {
	content: {
		'application/json': B
	}
}

export type OkResponses<B> = {
	200: JsonResponse<B>
}

export type CreatedResponses<B> = {
	201: JsonResponse<B>
}

export type SuccessBody<O extends OperationId> =
	operations[O]['responses'] extends OkResponses<infer B>
		? B
		: operations[O]['responses'] extends CreatedResponses<infer B>
			? B
			: never

export type Envelope<D> = {
	data: D
}

export type PageBody<T> = {
	data: T[]
	meta: Schemas['PaginationMeta']
}

export type Paginated<T> = {
	items: T[]
	meta: Schemas['PaginationMeta']
}

export type DataOf<O extends OperationId> = SuccessBody<O> extends Envelope<infer D> ? D : never

export type PageOf<O extends OperationId> =
	SuccessBody<O> extends PageBody<infer T> ? Paginated<T> : never

export type QueryOf<O extends OperationId> = NonNullable<operations[O]['parameters']['query']>

export type HeadersOf<O extends OperationId> = NonNullable<operations[O]['parameters']['header']>
