import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import openapiTS, { astToString, type OpenAPI3 } from 'openapi-typescript'
import ts from 'typescript'

const SOURCE = resolve(import.meta.dirname, '../openapi/public.json')
const TARGET = resolve(import.meta.dirname, '../packages/client/src/generated/api.ts')
const RECURSIVE_SCHEMAS = new Set(['#/components/schemas/JsonValue'])

const document = JSON.parse(await readFile(SOURCE, 'utf8')) as OpenAPI3

const ast = await openapiTS(document, {
	transform(_schema, options) {
		return RECURSIVE_SCHEMAS.has(options.path ?? '')
			? ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword)
			: undefined
	}
})

await writeFile(TARGET, astToString(ast))
console.log(`generated ${TARGET}`)
