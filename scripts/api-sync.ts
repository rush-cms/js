import { parseArgs } from 'node:util'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parse } from 'yaml'

const DEFAULT_SOURCE = '../rush-cms-v2/backend/api/public.yaml'
const TARGET = resolve(import.meta.dirname, '../openapi/public.json')

const { values } = parseArgs({ options: { from: { type: 'string', default: DEFAULT_SOURCE } } })

const source = resolve(process.cwd(), values.from ?? DEFAULT_SOURCE)
const document: unknown = parse(await readFile(source, 'utf8'))

await writeFile(TARGET, JSON.stringify(document, null, '\t') + '\n')
console.log(`synced ${source} -> ${TARGET}`)
