import type { PackageManager } from './package-manager'

export type CliEnv = {
	userAgent: string | undefined
	cwd: string
}

export type SpawnInstall = (packageManager: PackageManager, cwd: string) => Promise<number>

export type CliIo = {
	out: (line: string) => void
	err: (line: string) => void
	spawn: SpawnInstall
}
