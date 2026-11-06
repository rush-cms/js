import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import type { Browser, HTTPResponse, Page } from 'puppeteer-core'
import { PROXY_HOST } from './env.ts'

export type Walker = {
	browser: Browser
	visitorIp: string | undefined
	withPage<T>(use: (page: Page) => Promise<T>): Promise<T>
	shot(page: Page, name: string): Promise<string>
	close(): Promise<void>
}

export type Hop = {
	status: number
	path: string
}

export type Redirect = {
	from: string
	to: string
}

function externalIpv4(): string | undefined {
	return Object.values(networkInterfaces())
		.flatMap((addresses) => addresses ?? [])
		.find((address) => address.family === 'IPv4' && !address.internal)?.address
}

export async function launchWalker(chromePath: string, shotsDir: string): Promise<Walker> {
	const visitorIp = externalIpv4()
	const rules =
		visitorIp === undefined ? [] : [`--host-resolver-rules=MAP ${PROXY_HOST} ${visitorIp}`]
	const browser = await puppeteer.launch({
		executablePath: chromePath,
		headless: true,
		args: ['--no-first-run', '--no-default-browser-check', ...rules]
	})
	mkdirSync(shotsDir, { recursive: true })
	async function openPage(): Promise<Page> {
		const page = await browser.newPage()
		await page.setViewport({ width: 1100, height: 800 })
		await page.setCacheEnabled(false)
		return page
	}
	return {
		browser,
		visitorIp,
		withPage: async (use) => {
			const page = await openPage()
			try {
				return await use(page)
			} finally {
				await page.close().catch(() => undefined)
			}
		},
		shot: async (page, name) => {
			const path = join(shotsDir, `${name}.png`)
			await page.screenshot({ path, fullPage: true })
			return `${name}.png`
		},
		close: () => browser.close()
	}
}

export function hopsOf(response: HTTPResponse): Hop[] {
	return [...response.request().redirectChain(), response.request()].map((request) => ({
		status: request.response()?.status() ?? 0,
		path: new URL(request.url()).pathname + new URL(request.url()).search
	}))
}

export async function redirectedOnce(
	page: Page,
	base: string,
	redirect: Redirect,
	status: number
): Promise<string> {
	const response = await page.goto(`${base}${redirect.from}`)
	assert.ok(response, `no response for ${redirect.from}`)
	assert.deepEqual(hopsOf(response), [
		{ status, path: redirect.from },
		{ status: 200, path: redirect.to }
	])
	return `${redirect.from} -${status}-> ${redirect.to}`
}

export async function openOk(page: Page, url: string): Promise<HTTPResponse> {
	const response = await page.goto(url, { waitUntil: 'load' })
	assert.ok(response, `no response for ${url}`)
	assert.equal(response.status(), 200, `GET ${url}`)
	return response
}
