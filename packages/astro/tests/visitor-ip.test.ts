import { describe, expect, it } from 'vitest'
import type { RushAstroOptions } from '../src/config'
import { trustedProxyCount, visitorIp } from '../src/visitor-ip'

type ForwardedCase = {
	name: string
	forwardedFor: string | null
	trustedProxies: number
	expected: string | undefined
}

type ProxyChain = {
	forged: string[]
	client: string
	hops: number
	separator: string
}

type DirectRequest = {
	forged: string[]
	hostTrusted: boolean
	separator: string
}

const SOCKET = '192.0.2.10'

const CLIENTS = ['203.0.113.7', '2001:db8::7', '::ffff:203.0.113.7']

const PROXY_ADDRESSES = ['10.0.0.1', 'fd00::2', '10.0.0.3']

const FORGED_PREFIXES: string[][] = [
	[],
	['198.51.100.1'],
	['198.51.100.1', '198.51.100.2', '198.51.100.3'],
	['2001:db8::bad'],
	['garbage'],
	[''],
	['unknown', '::1'],
	['198.51.100.4:8080'],
	[SOCKET],
	['203.0.113.7']
]

const SEPARATORS = [',', ', ', ' , ', ',   ']

const LOCALE_PATHS = { pt_BR: '' }

function forwardedFor(entries: string[], separator: string): string | null {
	return entries.length === 0 ? null : entries.join(separator)
}

function chainHeader(chain: ProxyChain): string {
	const appended = [chain.client, ...PROXY_ADDRESSES.slice(0, chain.hops - 1)]
	return [...chain.forged, ...appended].join(chain.separator)
}

function chains(): ProxyChain[] {
	return [1, 2, 3].flatMap((hops) =>
		FORGED_PREFIXES.flatMap((forged) =>
			CLIENTS.flatMap((client) =>
				SEPARATORS.map((separator) => ({ forged, client, hops, separator }))
			)
		)
	)
}

function directRequests(): DirectRequest[] {
	return FORGED_PREFIXES.flatMap((forged) =>
		[true, false].flatMap((hostTrusted) =>
			SEPARATORS.map((separator) => ({ forged, hostTrusted, separator }))
		)
	)
}

function astroClientAddress(request: DirectRequest): string {
	const leftmost = request.forged[0]?.trim()
	return request.hostTrusted && leftmost !== undefined && leftmost !== '' ? leftmost : SOCKET
}

function withProxies(trustedProxies: number | undefined): RushAstroOptions {
	return trustedProxies === undefined
		? { localePaths: LOCALE_PATHS }
		: { localePaths: LOCALE_PATHS, trustedProxies }
}

const FORWARDED_CASES: ForwardedCase[] = [
	{ name: 'absent', forwardedFor: null, trustedProxies: 1, expected: undefined },
	{ name: 'empty', forwardedFor: '', trustedProxies: 1, expected: undefined },
	{ name: 'one entry', forwardedFor: '203.0.113.7', trustedProxies: 1, expected: '203.0.113.7' },
	{
		name: 'many entries, one hop',
		forwardedFor: '198.51.100.1, 198.51.100.2, 203.0.113.7',
		trustedProxies: 1,
		expected: '203.0.113.7'
	},
	{
		name: 'many entries, two hops',
		forwardedFor: '198.51.100.1, 203.0.113.7, 10.0.0.1',
		trustedProxies: 2,
		expected: '203.0.113.7'
	},
	{
		name: 'spaces around entries',
		forwardedFor: '  198.51.100.1 ,   203.0.113.7  ',
		trustedProxies: 1,
		expected: '203.0.113.7'
	},
	{
		name: 'IPv6 entry',
		forwardedFor: '198.51.100.1, 2001:db8::7',
		trustedProxies: 1,
		expected: '2001:db8::7'
	},
	{
		name: 'garbage at the trusted position',
		forwardedFor: '203.0.113.7, unknown',
		trustedProxies: 1,
		expected: undefined
	},
	{
		name: 'address with a port',
		forwardedFor: '203.0.113.7:4711',
		trustedProxies: 1,
		expected: undefined
	},
	{
		name: 'empty entry at the trusted position',
		forwardedFor: '203.0.113.7,',
		trustedProxies: 1,
		expected: undefined
	},
	{
		name: 'fewer entries than hops',
		forwardedFor: '203.0.113.7',
		trustedProxies: 2,
		expected: undefined
	},
	{
		name: 'fewer entries than hops with garbage only',
		forwardedFor: 'garbage',
		trustedProxies: 3,
		expected: undefined
	}
]

describe('visitorIp behind trusted proxies', () => {
	it.each(FORWARDED_CASES)('$name', ({ forwardedFor, trustedProxies, expected }) => {
		expect(visitorIp({ forwardedFor, clientAddress: SOCKET, trustedProxies })).toBe(expected)
	})

	it('picks the address the outermost trusted proxy saw for every forged prefix and hop count', () => {
		const all = chains()
		for (const chain of all) {
			const header = chainHeader(chain)
			for (const clientAddress of [SOCKET, header.split(',')[0]?.trim(), undefined]) {
				const ip = visitorIp({
					forwardedFor: header,
					clientAddress,
					trustedProxies: chain.hops
				})
				expect(ip, `${header} with ${chain.hops} hops`).toBe(chain.client)
			}
		}
		expect(all.length).toBe(360)
	})

	it('never returns an address when the chain is shorter than the hop count', () => {
		for (const chain of chains()) {
			const header = chainHeader({ ...chain, forged: [] })
			const ip = visitorIp({
				forwardedFor: header,
				clientAddress: SOCKET,
				trustedProxies: chain.hops + 1
			})
			expect(ip, `${header} with ${chain.hops + 1} hops`).toBeUndefined()
		}
	})
})

describe('visitorIp without trusted proxies', () => {
	it('uses the socket address when no X-Forwarded-For arrives', () => {
		expect(visitorIp({ forwardedFor: null, clientAddress: SOCKET, trustedProxies: 0 })).toBe(
			SOCKET
		)
		expect(
			visitorIp({ forwardedFor: null, clientAddress: '2001:db8::7', trustedProxies: 0 })
		).toBe('2001:db8::7')
	})

	it.each([undefined, '', 'unknown', '203.0.113.7:4711'])(
		'sends nothing for the client address %j',
		(clientAddress) => {
			expect(
				visitorIp({ forwardedFor: null, clientAddress, trustedProxies: 0 })
			).toBeUndefined()
		}
	)

	it('never forwards a client-supplied X-Forwarded-For value, whatever Astro resolved', () => {
		const all = directRequests()
		for (const request of all) {
			const header = forwardedFor(request.forged, request.separator)
			const clientAddress = astroClientAddress(request)
			const ip = visitorIp({ forwardedFor: header, clientAddress, trustedProxies: 0 })
			const forged = request.forged.map((entry) => entry.trim())
			const fromSocket = clientAddress === SOCKET && !forged.includes(SOCKET)
			const label = `${String(header)} trusted host ${request.hostTrusted}`
			expect(ip, label).toBe(fromSocket ? SOCKET : undefined)
			expect(
				forged.filter((entry) => entry !== SOCKET),
				label
			).not.toContain(ip)
		}
		expect(all.length).toBe(80)
	})
})

describe('trustedProxyCount', () => {
	it.each([
		[undefined, 0],
		[0, 0],
		[1, 1],
		[3, 3]
	])('accepts %j as %i', (trustedProxies, count) => {
		expect(trustedProxyCount(withProxies(trustedProxies))).toBe(count)
	})

	it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects %j', (trustedProxies) => {
		expect(() => trustedProxyCount(withProxies(trustedProxies))).toThrow(
			'trustedProxies must be a non-negative integer'
		)
	})
})
