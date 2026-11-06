import { posix } from 'node:path'

export type ExportTarget = string | { [condition: string]: ExportTarget } | null

export type PackageManifest = {
	name: string
	private?: boolean
	exports?: Record<string, ExportTarget>
}

export function targetsOf(target: ExportTarget, wildcard: string): string[] {
	if (target === null) {
		return []
	}
	if (typeof target === 'string') {
		return [posix.normalize(target.replace('*', wildcard))]
	}
	return Object.values(target).flatMap((nested) => targetsOf(nested, wildcard))
}

export function literalTargets(manifest: PackageManifest): string[] {
	return Object.entries(manifest.exports ?? {})
		.filter(([key]) => !key.includes('*'))
		.flatMap(([, target]) => targetsOf(target, ''))
}
