import { createServer, request } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'

export type Proxy = {
	close(): Promise<void>
}

export type ProxyTarget = {
	host: string
	port: number
}

function forward(
	target: ProxyTarget,
	forwardedFor: string | undefined,
	incoming: IncomingMessage,
	outgoing: ServerResponse
): void {
	const upstream = request(
		{
			host: target.host,
			port: target.port,
			method: incoming.method,
			path: incoming.url,
			headers: {
				...incoming.headers,
				'x-forwarded-for': forwardedFor ?? incoming.socket.remoteAddress ?? '',
				'x-forwarded-proto': 'http'
			}
		},
		(answer) => {
			outgoing.writeHead(answer.statusCode ?? 502, answer.headers)
			answer.pipe(outgoing)
		}
	)
	upstream.on('error', () => {
		outgoing.writeHead(502)
		outgoing.end()
	})
	incoming.pipe(upstream)
}

export function startProxy(
	listenPort: number,
	target: ProxyTarget,
	forwardedFor?: string
): Promise<Proxy> {
	const server = createServer((incoming, outgoing) =>
		forward(target, forwardedFor, incoming, outgoing)
	)
	return new Promise((resolve) => {
		server.listen(listenPort, '0.0.0.0', () => {
			resolve({
				close: () =>
					new Promise((done) => {
						server.close(() => done())
						server.closeAllConnections()
					})
			})
		})
	})
}
