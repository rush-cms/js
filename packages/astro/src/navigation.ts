import { navigationLinks } from '@rushcms/client'
import type { NavigationLink } from '@rushcms/client'
import { runtimeOf } from './runtime'
import type { RushContext } from './runtime'

export async function getNavigation(context: RushContext, key: string): Promise<NavigationLink[]> {
	const runtime = runtimeOf(context.locals)
	const locale = runtime.locale(context)
	const navigation = await runtime.clientIn(context, locale).navigations.get(key)
	return navigationLinks(navigation.items, runtime.urls, locale)
}
