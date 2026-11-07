import type { LocaleCode, RushClient, RushUrls } from '@rushcms/client'
import { runtimeOf } from './runtime'
import type { RushContext } from './runtime'

export function getRush(context: RushContext): RushClient {
	return runtimeOf(context.locals).client(context)
}

export function getLocale(context: RushContext): LocaleCode {
	return runtimeOf(context.locals).locale(context)
}

export function getUrls(context: Pick<RushContext, 'locals'>): RushUrls {
	return runtimeOf(context.locals).urls
}
