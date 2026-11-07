import type { LocaleCode, NavigationItem } from './types'
import type { RushUrls } from './urls'

export type NavigationLinkAttributes = Record<string, string>

export type NavigationLink = {
	label: string
	href?: string
	target?: string
	rel?: string
	className?: string
	attributes: NavigationLinkAttributes
	children: NavigationLink[]
}

type NavigationAttribute = NonNullable<NavigationItem['attributes']>[number]

type StringifiedAttribute = {
	name: string
	value: string
}

const REL = 'rel'

const BLANK = '_blank'

function stringified(value: NavigationAttribute['value']): string | undefined {
	if (typeof value === 'string') {
		return value
	}
	if (typeof value === 'number') {
		return String(value)
	}
	return value === true ? '' : undefined
}

function attributesOf(item: NavigationItem): StringifiedAttribute[] {
	return (item.attributes ?? []).flatMap(({ name, value }) => {
		const text = stringified(value)
		return text === undefined ? [] : [{ name, value: text }]
	})
}

function relOf(item: NavigationItem, attributes: StringifiedAttribute[]): string | undefined {
	const tokens = [
		...attributes.filter(({ name }) => name === REL).flatMap(({ value }) => value.split(/\s+/)),
		item.nofollow === true ? 'nofollow' : '',
		item.noreferrer === true ? 'noreferrer' : '',
		item.link_target === BLANK ? 'noopener' : ''
	].filter((token) => token !== '')
	return tokens.length === 0 ? undefined : [...new Set(tokens)].join(' ')
}

function linkOf(item: NavigationItem, urls: RushUrls, locale: LocaleCode): NavigationLink[] {
	const href = urls.navigationItem(item, locale) || undefined
	const children = navigationLinks(item.children, urls, locale)
	if (href === undefined && children.length === 0) {
		return []
	}
	const attributes = attributesOf(item)
	const rel = relOf(item, attributes)
	return [
		{
			label: item.label,
			...(href === undefined ? {} : { href }),
			...(item.link_target === undefined ? {} : { target: item.link_target }),
			...(rel === undefined ? {} : { rel }),
			...(item.class === undefined ? {} : { className: item.class }),
			attributes: Object.fromEntries(
				attributes
					.filter(({ name }) => name !== REL)
					.map(({ name, value }) => [name, value])
			),
			children
		}
	]
}

export function navigationLinks(
	items: NavigationItem[],
	urls: RushUrls,
	locale: LocaleCode
): NavigationLink[] {
	return items.flatMap((item) => linkOf(item, urls, locale))
}
