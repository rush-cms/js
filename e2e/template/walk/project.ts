import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PROXY_HOST } from '../../walk-kit/env.ts'
import { startProcess } from './processes.ts'
import type { Running } from './processes.ts'
import type { ProjectSpec } from './projects.ts'

export type Project = ProjectSpec & {
	path: string
}

export type Delivery = {
	apiUrl: string
	siteId: string
	token: string
}

export type BuildResult = {
	code: number | null
	output: string
}

const CONFIG = 'astro.config.ts'
const EMPTY_LOCALE_PATHS = 'localePaths: {},'
const SUGGESTED_LINE = /^\s*(localePaths: \{[^\n]*\})\s*$/m
const TEMPLATE_DOMAINS = "allowedDomains: [{ protocol: 'https', hostname: 'www.example.com' }]"
const WALKER_DOMAINS = `allowedDomains: [{ protocol: 'http', hostname: 'localhost' }, { protocol: 'http', hostname: '${PROXY_HOST}' }]`
export const PREVIEW_OUT_DIR = 'dist-preview'
const INHERITED = [
	'AGENT',
	'AI_AGENT',
	'CLAUDECODE',
	'RUSH_API_URL',
	'RUSH_SITE_ID',
	'RUSH_API_TOKEN',
	'RUSH_MEDIA_URL',
	'RUSH_PREVIEW'
]

export function projectAt(workDir: string, spec: ProjectSpec): Project {
	return { ...spec, path: join(workDir, spec.dir) }
}

function replaceOnce(file: string, from: string, to: string): void {
	const text = readFileSync(file, 'utf8')
	assert.equal(text.split(from).length, 2, `${file} holds "${from}" exactly once`)
	writeFileSync(file, text.replace(from, to))
}

export function writeDelivery(project: Project, delivery: Delivery): void {
	const file = join(project.path, '.env')
	const values: Record<string, string> = {
		RUSH_API_URL: delivery.apiUrl,
		RUSH_SITE_ID: delivery.siteId,
		RUSH_API_TOKEN: delivery.token
	}
	for (const [name, value] of Object.entries(values)) {
		replaceOnce(file, `${name}=\n`, `${name}=${value}\n`)
	}
}

function projectProcess(project: Project, argv: string[], env: Record<string, string>): Running {
	return startProcess({ cwd: project.path, argv, env, unset: INHERITED })
}

export function runScript(project: Project, script: string, env: Record<string, string>): Running {
	return projectProcess(project, [project.manager, 'run', script], env)
}

export async function localePathsError(project: Project): Promise<string> {
	const dev = runScript(project, 'dev', {})
	try {
		return await dev.untilOutput(SUGGESTED_LINE)
	} finally {
		await dev.stop()
	}
}

export function suggestedLine(output: string): string {
	const line = SUGGESTED_LINE.exec(output)?.[1]
	assert.ok(line, `no localePaths line in\n${output}`)
	return line
}

export function pasteLocalePaths(project: Project, line: string): void {
	replaceOnce(join(project.path, CONFIG), EMPTY_LOCALE_PATHS, `${line},`)
}

export function allowWalkerDomains(project: Project): void {
	replaceOnce(join(project.path, CONFIG), TEMPLATE_DOMAINS, WALKER_DOMAINS)
}

export async function build(project: Project, preview: boolean): Promise<BuildResult> {
	const outDir = preview ? ['--outDir', PREVIEW_OUT_DIR] : []
	const separator = project.manager === 'npm' && preview ? ['--'] : []
	const running = projectProcess(
		project,
		[project.manager, 'run', 'build', ...separator, ...outDir],
		preview ? { RUSH_PREVIEW: 'true' } : {}
	)
	const code = await running.finished()
	return { code, output: running.output() }
}

export function servePreviewBuild(project: Project, port: number): Running {
	return projectProcess(
		project,
		['node', '--env-file-if-exists=.env', `./${PREVIEW_OUT_DIR}/server/entry.mjs`],
		{ PORT: String(port), RUSH_PREVIEW: 'true' }
	)
}

export function filesUnder(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name)
		return statSync(path).isDirectory() ? filesUnder(path) : [path]
	})
}

export function filesContaining(dir: string, needle: string): string[] {
	return filesUnder(dir).filter((file) => readFileSync(file).includes(needle))
}

export function fileCount(dir: string): number {
	return filesUnder(dir).length
}
