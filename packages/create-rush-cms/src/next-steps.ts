import { devCommand, installCommand } from './package-manager'
import type { PackageManager } from './package-manager'

export type NextStepsInput = {
	dir: string
	packageManager: PackageManager
	installed: boolean
	ssg: boolean
}

function quoted(dir: string): string {
	return /\s/.test(dir) ? JSON.stringify(dir) : dir
}

export const USAGE = [
	'Usage: create-rush-cms <dir> [--ssg] [--no-install]',
	'',
	'Creates a Rush CMS website in <dir>.',
	'',
	'Options:',
	'  --ssg         Create a purely static site: no server, forms route or preview',
	'  --no-install  Skip installing dependencies',
	'  -h, --help    Show this help'
]

export function installFailure(input: NextStepsInput): string[] {
	return [
		'Dependency installation failed. The project files were kept.',
		`Install manually: cd ${quoted(input.dir)} && ${installCommand(input.packageManager)}`
	]
}

const SERVER_MODE = 'Mode: server site (Node adapter). Use --ssg for a purely static site.'

const STATIC_MODE =
	'Mode: static site (--ssg). No server, forms route or preview; see "404 pages" in README.md.'

export function nextSteps(input: NextStepsInput): string[] {
	const steps = [
		`cd ${quoted(input.dir)}`,
		...(input.installed ? [] : [installCommand(input.packageManager)]),
		'Fill .env with your Rush CMS API URL, site id and delivery token, and SITE_URL once you know your production URL',
		`${devCommand(input.packageManager)}, then paste the localePaths line the first-run error prints into astro.config.ts`,
		'Search the project for TODO markers and fill them in'
	]
	return [
		'',
		input.ssg ? STATIC_MODE : SERVER_MODE,
		'',
		'Next steps:',
		...steps.map((step, index) => `  ${index + 1}. ${step}`)
	]
}
