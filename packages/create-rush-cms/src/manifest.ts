import { readFileSync, writeFileSync } from 'node:fs'

export type Manifest = Record<string, unknown>

const DEFAULT_INDENT = '\t'

export function updateManifest(file: string, update: (manifest: Manifest) => void): void {
	const text = readFileSync(file, 'utf8')
	const indent = /\n([ \t]+)"/.exec(text)?.[1] ?? DEFAULT_INDENT
	const manifest = JSON.parse(text) as Manifest
	update(manifest)
	writeFileSync(file, `${JSON.stringify(manifest, null, indent)}\n`)
}
