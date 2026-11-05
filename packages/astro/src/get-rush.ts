import type { RushClient } from '@rushcms/client'
import { runtimeOf } from './runtime'
import type { RushContext } from './runtime'

export function getRush(context: RushContext): RushClient {
	return runtimeOf(context.locals).client(context)
}
