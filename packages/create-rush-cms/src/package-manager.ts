export type PackageManager = 'npm' | 'pnpm' | 'bun' | 'yarn'

const KNOWN: readonly PackageManager[] = ['pnpm', 'bun', 'yarn']

export function detectPackageManager(userAgent: string | undefined): PackageManager {
	const launcher = userAgent?.split(' ')[0]?.split('/')[0]
	return KNOWN.find((name) => name === launcher) ?? 'npm'
}

export function installCommand(packageManager: PackageManager): string {
	return `${packageManager} install`
}

export function devCommand(packageManager: PackageManager): string {
	return `${packageManager} run dev`
}
