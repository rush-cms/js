import { basename, resolve } from 'node:path'

const FALLBACK = 'rush-site'
const MAX_LENGTH = 214
const RESERVED = new Set(['node_modules', 'favicon.ico'])

export function packageNameOf(dir: string): string {
	const name = basename(resolve(dir))
		.toLowerCase()
		.normalize('NFD')
		.replaceAll(/\p{M}/gu, '')
		.replaceAll(/[^a-z0-9._~-]+/g, '-')
		.replace(/^[._-]+/, '')
		.slice(0, MAX_LENGTH)
		.replace(/-+$/, '')
	return name === '' || RESERVED.has(name) ? FALLBACK : name
}
