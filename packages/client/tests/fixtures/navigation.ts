import type { NavigationItem } from '../../src/index'

export type EntrySummary = NonNullable<NonNullable<NavigationItem['target']>['entry']>

export function navigationItem(target?: NavigationItem['target']): NavigationItem {
	return { label: 'x', type: 'entry', ...(target === undefined ? {} : { target }), children: [] }
}
