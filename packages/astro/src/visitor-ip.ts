import { isIP } from 'node:net'
import type { RushAstroOptions } from './config'

export type VisitorIpSource = {
	forwardedFor: string | null
	clientAddress: string | undefined
	trustedProxies: number
}

export const FORWARDED_FOR_HEADER = 'x-forwarded-for'

export function trustedProxyCount(options: RushAstroOptions): number {
	const count = options.trustedProxies ?? 0
	if (!Number.isSafeInteger(count) || count < 0) {
		throw new Error(
			`@rushcms/astro: trustedProxies must be a non-negative integer, got ${String(count)}`
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
