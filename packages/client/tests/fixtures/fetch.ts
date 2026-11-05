import { createClient } from '../../src/index'
import type { RushClient, RushClientConfig, RushFetch } from '../../src/index'
import { parameterExample } from './contract'

export type FetchCall = {
	url: URL
	init: RequestInit
}

export type FetchHandler = (call: FetchCall) => Response | Promise<Response>

export type TestClient = {
	client: RushClient
	calls: FetchCall[]
}

export type Deferred<T> = {
	promise: Promise<T>
	resolve(value: T): void
}

export type TestClientOptions = Omit<RushClientConfig, 'url' | 'siteId' | 'token' | 'fetch'>

export const API_URL = 'https://cms.example.com'
export const TOKEN = 'delivery-token'
export const SITE_ID = parameterExample('SiteId')

export function jsonResponse(
	body: unknown,
	status = 200,
	headers: Record<string, string> = {}
): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', ...headers }
	})
}

export function deferred<T>(): Deferred<T> {
	let resolve: (value: T) => void = () => undefined
	const promise = new Promise<T>((settle) => {
		resolve = settle
	})
	return { promise, resolve }
}

export function testClient(handler: FetchHandler, options: TestClientOptions = {}): TestClient {
	const calls: FetchCall[] = []
	const fetch: RushFetch = async (input, init) => {
		const call = { url: new URL(input), init }
		calls.push(call)
		return handler(call)
	}
	return {
		client: createClient({ ...options, url: API_URL, siteId: SITE_ID, token: TOKEN, fetch }),
		calls
	}
}

export async function rejection(promise: Promise<unknown>): Promise<unknown> {
	try {
		await promise
	} catch (reason) {
		return reason
	}
	throw new Error('expected the promise to reject')
}

export function apiPath(call: FetchCall): string {
	return call.url.pathname.replace(`/api/v1/${SITE_ID}`, '')
}

export function header(call: FetchCall, name: string): string | null {
	return new Headers(call.init.headers).get(name)
}
