import { spawn } from 'node:child_process'
import { installCommand } from './package-manager'
import type { PackageManager } from './package-manager'

const FAILURE = 1

export function runCommand(command: string, args: string[], cwd: string): Promise<number> {
	return new Promise((resolve) => {
		const child = spawn(command, args, {
			cwd,
			stdio: 'inherit',
			shell: process.platform === 'win32'
		})
		child.on('error', () => resolve(FAILURE))
		child.on('close', (code) => resolve(code ?? FAILURE))
	})
}

export function spawnInstall(packageManager: PackageManager, cwd: string): Promise<number> {
	const [command = packageManager, ...args] = installCommand(packageManager).split(' ')
	return runCommand(command, args, cwd)
}
