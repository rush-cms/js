import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { updateManifest } from './manifest'
import type { Manifest } from './manifest'

export type TextPatch = {
	find: string | RegExp
	replace: string
}

export type FilePatch = {
	file: string
	patches: TextPatch[]
}

export type ManifestPatch = (manifest: Manifest) => void

export type Variant = {
	name: string
	drop: string[]
	files: FilePatch[]
	manifest: ManifestPatch
}

function occurrences(text: string, find: string | RegExp): number {
	if (typeof find === 'string') {
		return text.split(find).length - 1
	}
	return [...text.matchAll(new RegExp(find.source, `${find.flags.replace('g', '')}g`))].length
}

export function patchText(file: string, text: string, patch: TextPatch): string {
	if (occurrences(text, patch.find) !== 1) {
		throw new Error(`${file}: expected exactly one match for ${String(patch.find)}`)
	}
	return text.replace(patch.find, () => patch.replace)
}

function patchFile(root: string, { file, patches }: FilePatch): void {
	const path = join(root, file)
	const text = patches.reduce(
		(current, patch) => patchText(file, current, patch),
		readFileSync(path, 'utf8')
	)
	writeFileSync(path, text)
}

export function applyVariant(root: string, variant: Variant): void {
	for (const file of variant.drop) {
		rmSync(join(root, file))
	}
	for (const patch of variant.files) {
		patchFile(root, patch)
	}
	updateManifest(join(root, 'package.json'), variant.manifest)
}
