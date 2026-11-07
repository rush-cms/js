import assert from 'node:assert/strict'
import { SITE_URL } from './env.ts'
import { runScript } from './project.ts'
import type { Project } from './project.ts'
import { gluedText } from './text-spacing.ts'

export type DevPage = {
	path: string
	status: number
	includes: string[]
	excludes: string[]
}

export async function devPages(project: Project, pages: DevPage[]): Promise<string> {
	const dev = runScript(project, 'dev', {})
	try {
		await dev.untilAnswering(SITE_URL)
		const seen: string[] = []
		for (const page of pages) {
			const response = await fetch(`${SITE_URL}${page.path}`)
			const html = await response.text()
			assert.equal(response.status, page.status, `astro dev GET ${page.path}`)
			for (const text of page.includes) {
				assert.ok(html.includes(text), `${page.path} shows ${text}`)
			}
			for (const text of page.excludes) {
				assert.ok(!html.includes(text), `${page.path} hides ${text}`)
			}
			assert.deepEqual(
				gluedText(html),
				[],
				`${page.path} keeps the spaces before inline elements`
			)
			seen.push(
				`${page.path} ${response.status} (${page.includes.map((text) => `"${text}"`).join(', ')})`
			)
		}
		return `${project.manager} run dev (pid ${dev.pid}): ${seen.join('; ')}`
	} finally {
		await dev.stop()
	}
}
