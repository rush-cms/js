import { resolve } from 'node:path'
import { PORTS } from '../walk/env.ts'
import type { Instance } from '../walk/env.ts'

const ENTRIES: Record<Instance, string> = {
	site: 'dist',
	preview: 'dist-preview',
	captcha: 'dist-captcha'
}

function isInstance(value: string | undefined): value is Instance {
	return value !== undefined && Object.hasOwn(PORTS, value)
}

const instance = process.argv[2]
if (!isInstance(instance)) {
	console.error(`usage: serve <${Object.keys(PORTS).join('|')}>`)
	process.exit(2)
}
process.env['PORT'] = String(PORTS[instance])
await import(resolve(import.meta.dirname, '..', ENTRIES[instance], 'server/entry.mjs'))
