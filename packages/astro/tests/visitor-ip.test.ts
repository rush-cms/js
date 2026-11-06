import { IncomingMessage } from 'node:http'
import { Socket } from 'node:net'
import { createRequestFromNodeRequest } from 'astro/app/node'
import { describe, expect, it } from 'vitest'
import {
	FORWARDED_FOR_HEADER,
	FORWARDED_WITHOUT_PROXIES_WARNING,
	SHORT_PROXY_CHAIN_WARNING,
	visitorIp,
	visitorIpWarning
} from '../src/visitor-ip'
import type { VisitorIpSource } from '../src/visitor-ip'

type ForwardedCase = {
	name: string
	forwardedFor: string | null
	trustedProxies: number
	expected: string | undefined
}

type WarningCase = {
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

type NodeRequest = {
	socketAddress: string
	host: string
	forwardedFor: string | null
}

const SOCKET = '192.0.2.10'

const INNERMOST_PROXY = '10.0.0.9'

const TRUSTED_HOST = 'site.example'

const HOSTS = [TRUSTED_HOST, 'other.example']

const ASTRO_CLIENT_ADDRESS = Symbol.for('astro.clientAddress')

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

function incomingMessage(request: NodeRequest): IncomingMessage {
	const socket = new Socket()
	Object.defineProperty(socket, 'remoteAddress', { value: request.socketAddress })
	const message = new IncomingMessage(socket)
	message.method = 'POST'
	message.url = '/_rush/forms/contact'
	message.headers =
		request.forwardedFor === null
			? { host: request.host }
			: { host: request.host, [FORWARDED_FOR_HEADER]: request.forwardedFor }
	return message
}

function throughAstro(request: NodeRequest, trustedProxies: number): string | undefined {
	const astroRequest = createRequestFromNodeRequest(incomingMessage(request), {
		skipBody: true,
		allowedDomains: [{ protocol: 'http', hostname: TRUSTED_HOST }]
	})
	const clientAddress: unknown = Reflect.get(astroRequest, ASTRO_CLIENT_ADDRESS)
	return visitorIp({
		forwardedFor: astroRequest.headers.get(FORWARDED_FOR_HEADER),
		clientAddress: typeof clientAddress === 'string' ? clientAddress : undefined,
		trustedProxies
	})
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

const WARNING_CASES: WarningCase[] = [
	{ forwardedFor: null, trustedProxies: 0, expected: undefined },
	{ forwardedFor: '', trustedProxies: 0, expected: FORWARDED_WITHOUT_PROXIES_WARNING },
	{
		forwardedFor: '198.51.100.1',
		trustedProxies: 0,
		expected: FORWARDED_WITHOUT_PROXIES_WARNING
	},
	{ forwardedFor: null, trustedProxies: 1, expected: SHORT_PROXY_CHAIN_WARNING },
	{ forwardedFor: '203.0.113.7', trustedProxies: 1, expected: undefined },
	{ forwardedFor: '203.0.113.7', trustedProxies: 2, expected: SHORT_PROXY_CHAIN_WARNING },
	{ forwardedFor: '203.0.113.7, 10.0.0.1', trustedProxies: 2, expected: undefined },
	{ forwardedFor: 'a, b, c', trustedProxies: 2, expected: undefined }
]

describe('visitorIp through Astro createRequestFromNodeRequest', () => {
	it('never forwards a client-supplied X-Forwarded-For entry without trusted proxies', () => {
		let checked = 0
		for (const host of HOSTS) {
			for (const forged of FORGED_PREFIXES) {
				for (const separator of SEPARATORS) {
					const header = forwardedFor(forged, separator)
					const ip = throughAstro(
						{ socketAddress: SOCKET, host, forwardedFor: header },
						0
					)
					const label = `${String(header)} for host ${host}`
					expect([SOCKET, undefined], label).toContain(ip)
					if (host !== TRUSTED_HOST && !forged.includes(SOCKET)) {
						expect(ip, label).toBe(SOCKET)
					}
					checked += 1
				}
			}
		}
		expect(checked).toBe(80)
	})

	it('picks the address the outermost trusted proxy saw for every forged prefix and hop count', () => {
		let checked = 0
		for (const host of HOSTS) {
			for (const chain of chains()) {
				const header = chainHeader(chain)
				const request = { socketAddress: INNERMOST_PROXY, host, forwardedFor: header }
				expect(throughAstro(request, chain.hops), `${header} with ${chain.hops} hops`).toBe(
					chain.client
				)
				checked += 1
			}
		}
		expect(checked).toBe(720)
	})
})

describe('visitorIp behind trusted proxies', () => {
	it.each(FORWARDED_CASES)('$name', ({ forwardedFor, trustedProxies, expected }) => {
		expect(visitorIp({ forwardedFor, clientAddress: SOCKET, trustedProxies })).toBe(expected)
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
})

describe('visitorIpWarning', () => {
	it.each(WARNING_CASES)(
		'X-Forwarded-For $forwardedFor with trustedProxies $trustedProxies',
		({ forwardedFor, trustedProxies, expected }) => {
			const source: VisitorIpSource = { forwardedFor, clientAddress: SOCKET, trustedProxies }
			expect(visitorIpWarning(source)).toBe(expected)
		}
	)
})
