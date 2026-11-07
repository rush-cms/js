import { devCommand, installCommand } from './package-manager'
import type { PackageManager } from './package-manager'

export type NextStepsInput = {
	dir: string
	packageManager: PackageManager
	installed: boolean
}

function quoted(dir: string): string {
	return /\s/.test(dir) ? JSON.stringify(dir) : dir
}

export const USAGE = [
	'Usage: create-rush-cms <dir> [--no-install]',
	'',
	'Creates a Rush CMS website in <dir>.',
	'',
	'Options:',
	'  --no-install  Skip installing dependencies',
	'  -h, --help    Show this help'
]

export function installFailure(input: NextStepsInput): string[] {
	return [
		'Dependency installation failed. The project files were kept.',
		`Install manually: cd ${quoted(input.dir)} && ${installCommand(input.packageManager)}`
	]
}

export function nextSteps(input: NextStepsInput): string[] {
	const steps = [
		`cd ${quoted(input.dir)}`,
		...(input.installed ? [] : [installCommand(input.packageManager)]),
		'Fill .env with your Rush CMS API URL, site id and delivery token',
		`${devCommand(input.packageManager)}, then paste the localePaths line the first-run error prints into astro.config.ts`,
		'Search the project for TODO markers and fill them in'
	]
	return ['', 'Next steps:', ...steps.map((step, index) => `  ${index + 1}. ${step}`)]
}
