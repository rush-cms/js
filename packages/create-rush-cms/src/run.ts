import { copyFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { copyTemplate } from './copy'
import { USAGE, installFailure, nextSteps } from './next-steps'
import type { NextStepsInput } from './next-steps'
import { updateManifest } from './manifest'
import { packageNameOf } from './package-name'
import { SSG_VARIANT } from './ssg'
import { applyVariant } from './variant'
import { detectPackageManager } from './package-manager'
import type { CliEnv, CliIo } from './types'

export const DEFAULT_TEMPLATE_DIR = resolve(import.meta.dirname, '..', 'template')

type Options = {
	dir: string
	install: boolean
	ssg: boolean
}

type HelpRequest = {
	kind: 'help'
}

type InvalidArguments = {
	kind: 'invalid'
	message: string
}

type ReadyArguments = {
	kind: 'ready'
	options: Options
}

type Parsed = HelpRequest | InvalidArguments | ReadyArguments

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

function emit(lines: string[], write: (line: string) => void): void {
	for (const line of lines) {
		write(line)
	}
}

function parse(argv: string[]): Parsed {
	try {
		const { values, positionals } = parseArgs({
			args: argv,
			allowPositionals: true,
			options: {
				help: { type: 'boolean', short: 'h' },
				'no-install': { type: 'boolean' },
				ssg: { type: 'boolean' }
			}
		})
		const [dir, ...extra] = positionals
		if (values.help === true) {
			return { kind: 'help' }
		}
		if (dir === undefined) {
			return { kind: 'invalid', message: 'Missing <dir>.' }
		}
		if (extra.length > 0) {
			return { kind: 'invalid', message: `Unexpected argument: ${extra.join(' ')}` }
		}
		return {
			kind: 'ready',
			options: { dir, install: values['no-install'] !== true, ssg: values.ssg === true }
		}
	} catch (error) {
		return { kind: 'invalid', message: messageOf(error) }
	}
}

function isNonEmpty(target: string): boolean {
	return existsSync(target) && (!statSync(target).isDirectory() || readdirSync(target).length > 0)
}

function setPackageName(target: string): void {
	updateManifest(join(target, 'package.json'), (manifest) => {
		manifest.name = packageNameOf(target)
	})
}

function scaffold(target: string, templateDir: string, ssg: boolean): void {
	copyTemplate(templateDir, target)
	if (ssg) {
		applyVariant(target, SSG_VARIANT)
	}
	setPackageName(target)
	copyFileSync(join(target, '.env.example'), join(target, '.env'))
}

export async function run(
	argv: string[],
	env: CliEnv,
	io: CliIo,
	templateDir: string = DEFAULT_TEMPLATE_DIR
): Promise<number> {
	const parsed = parse(argv)
	if (parsed.kind === 'help') {
		emit(USAGE, io.out)
		return 0
	}
	if (parsed.kind === 'invalid') {
		io.err(parsed.message)
		emit(USAGE, io.err)
		return 1
	}
	const { dir, install, ssg } = parsed.options
	const target = resolve(env.cwd, dir)
	if (isNonEmpty(target)) {
		io.err(`${dir} already exists and is not empty. Nothing was written.`)
		return 1
	}
	try {
		scaffold(target, templateDir, ssg)
	} catch (error) {
		io.err(`Could not create the project: ${messageOf(error)}`)
		return 1
	}
	const packageManager = detectPackageManager(env.userAgent)
	const input: NextStepsInput = { dir, packageManager, installed: install, ssg }
	io.out(`Created ${packageNameOf(target)} in ${dir}`)
	if (install && (await io.spawn(packageManager, target)) !== 0) {
		emit(installFailure(input), io.err)
		return 1
	}
	emit(nextSteps(input), io.out)
	return 0
}
