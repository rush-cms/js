import { isIP } from 'node:net'
import type { RushAstroOptions } from './config'

export type VisitorIpSource = {
	forwardedFor: string | null
	clientAddress: string | undefined
	trustedProxies: number
}

export const FORWARDED_FOR_HEADER = 'x-forwarded-for'

export const FORWARDED_WITHOUT_PROXIES_WARNING =
	'@rushcms/astro: a form post carried X-Forwarded-For while trustedProxies is 0. If reverse proxies sit in front of the server, set trustedProxies to their count; until then such posts reach the API with the address of the server or of a proxy instead of the visitor IP, and those visitors share one rate-limit bucket. This warning is shown once per process.'

export const SHORT_PROXY_CHAIN_WARNING =
	'@rushcms/astro: a form post carried fewer X-Forwarded-For entries than trustedProxies, so it reached the API without a visitor IP. Check that trustedProxies equals the number of reverse proxies in front of the server and that each of them appends to X-Forwarded-For. This warning is shown once per process.'

export function trustedProxyCount(options: RushAstroOptions): number {
	const count = options.trustedProxies
	if (!Number.isSafeInteger(count) || count < 0) {
		throw new Error(
			`@rushcms/astro: trustedProxies is required and must be a non-negative integer, got ${String(count)}. Use 0 when visitors reach the Astro Node server directly, or n when every request reaches it through n reverse proxies that each append to X-Forwarded-For.`
		)
	}
	return count
}

function forwardedEntries(header: string | null): string[] {
	return header === null ? [] : header.split(',').map((entry) => entry.trim())
}

function address(value: string | undefined): string | undefined {
	return value !== undefined && isIP(value) !== 0 ? value : undefined
}

function socketAddress(clientAddress: string | undefined, entries: string[]): string | undefined {
	return clientAddress === undefined || entries.includes(clientAddress)
		? undefined
		: address(clientAddress)
}

export function visitorIp(source: VisitorIpSource): string | undefined {
	const entries = forwardedEntries(source.forwardedFor)
	if (source.trustedProxies === 0) {
		return socketAddress(source.clientAddress, entries)
	}
	return address(entries[entries.length - source.trustedProxies])
}

export function visitorIpWarning(source: VisitorIpSource): string | undefined {
	if (source.trustedProxies === 0) {
		return source.forwardedFor === null ? undefined : FORWARDED_WITHOUT_PROXIES_WARNING
	}
	return forwardedEntries(source.forwardedFor).length < source.trustedProxies
		? SHORT_PROXY_CHAIN_WARNING
		: undefined
}
