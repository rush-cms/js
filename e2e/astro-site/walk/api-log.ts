import { randomUUID } from 'node:crypto'
import { readFileSync, watch } from 'node:fs'
import type { WalkEnv } from './env.ts'
import { Blocked } from '../../walk-kit/results.ts'

export type LoggedRequest = {
	path: string
	status: number
}

const REQUEST_LINE = /msg=http_request method=\S+ path=(\S+) status=(\d+)/
const ENTRY_PATH = /\/collections\/[^/]+\/entries\/[^/]+$/
const LOG_WAIT_MS = 10_000

function logPathOf(env: WalkEnv): string {
	if (env.apiLog === undefined) {
		throw new Blocked('API_LOG is not set: the API request log is needed to count requests')
	}
	return env.apiLog
}

function requestsIn(text: string): LoggedRequest[] {
	return text.split('\n').flatMap((line) => {
		const match = REQUEST_LINE.exec(line)
		return match?.[1] === undefined ? [] : [{ path: match[1], status: Number(match[2]) }]
	})
}

function untilLogged(file: string, path: string): Promise<LoggedRequest[]> {
	return new Promise((resolve, reject) => {
		const watcher = watch(file)
		const timer = setTimeout(() => {
			watcher.close()
			reject(new Error(`${path} never reached ${file}`))
		}, LOG_WAIT_MS)
		const check = (): void => {
			const requests = requestsIn(readFileSync(file, 'utf8'))
			if (requests.some((request) => request.path === path)) {
				clearTimeout(timer)
				watcher.close()
				resolve(requests)
			}
		}
		watcher.on('change', check)
		check()
	})
}

async function sentinel(env: WalkEnv): Promise<string> {
	const path = `/api/v1/${env.siteId}/collections/e2e-sentinel-${randomUUID()}/entries`
	const response = await fetch(`${env.apiUrl}${path}`, {
		headers: { Authorization: `Bearer ${env.apiToken}` }
	})
	await response.body?.cancel()
	return path
}

function indexOf(requests: LoggedRequest[], path: string): number {
	return requests.findIndex((request) => request.path === path)
}

export async function entryRequestsDuring(
	env: WalkEnv,
	action: () => Promise<void>
): Promise<LoggedRequest[]> {
	const file = logPathOf(env)
	const start = await sentinel(env)
	await untilLogged(file, start)
	await action()
	const end = await sentinel(env)
	const requests = await untilLogged(file, end)
	return requests
		.slice(indexOf(requests, start) + 1, indexOf(requests, end))
		.filter((request) => ENTRY_PATH.test(request.path))
}
