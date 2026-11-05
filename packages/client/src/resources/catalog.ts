import type { OperationId } from '../contract'
import type { CatalogResource } from '../types'
import type { LocaleScopeOf, ResourceContext } from './context'

export function createCatalog<L extends OperationId, G extends OperationId>(
	context: ResourceContext,
	segment: string,
	scope: LocaleScopeOf<L> & LocaleScopeOf<G>
): CatalogResource<L, G> {
	return {
		list: (options) => context.data<L>([segment], options, scope),
		get: (key, options) => context.data<G>([segment, key], options, scope)
	}
}
