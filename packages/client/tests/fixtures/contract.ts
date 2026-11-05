import { readFileSync } from 'node:fs'
import type { components } from '../../src/generated/api'
import { isRecord } from '../../src/json'
import type { Entry } from '../../src/types'

type EntryEnvelope = components['schemas']['EntryEnvelope']

type MediaExample = {
	example?: unknown
}

type ContractContent = {
	content?: Record<string, MediaExample>
}

type ResponseRef = {
	$ref?: string
}

type ParameterRef = {
	$ref?: string
	name?: string
}

type ContractOperation = {
	operationId?: string
	parameters?: ParameterRef[]
	requestBody?: ContractContent
	responses?: Record<string, ResponseRef>
}

type ContractSchema = {
	enum?: string[]
}

type ContractParameter = {
	name?: string
	example?: unknown
}

type ContractComponents = {
	responses: Record<string, ContractContent>
	schemas: Record<string, ContractSchema>
	parameters: Record<string, ContractParameter>
}

type ContractDocument = {
	paths: Record<string, Record<string, ContractOperation>>
	components: ContractComponents
}

export type OperationFixture = {
	path: string
	parameters: string[]
	okExample: unknown
}

export type ErrorExample = {
	response: string
	status: number
	body: Record<string, unknown>
}

const contract = JSON.parse(
	readFileSync(new URL('../../../../openapi/public.json', import.meta.url), 'utf8')
) as ContractDocument

function required<T>(value: T | undefined, what: string): T {
	if (value === undefined) {
		throw new Error(`contract has no ${what}`)
	}
	return value
}

function jsonExample(media: ContractContent | undefined, what: string): unknown {
	return required(media?.content?.['application/json']?.example, `example for ${what}`)
}

export function responseExample(name: string): unknown {
	return jsonExample(contract.components.responses[name], `response ${name}`)
}

function isEntryEnvelope(value: unknown): value is EntryEnvelope {
	return isRecord(value) && isRecord(value.data) && typeof value.data.id === 'string'
}

export function entryExample(): Entry {
	const example = responseExample('EntryOk')
	if (!isEntryEnvelope(example)) {
		throw new Error('EntryOk example is not an entry envelope')
	}
	return example.data
}

export function requestExample(path: string, method: string): unknown {
	const operation = required(contract.paths[path]?.[method], `operation ${method} ${path}`)
	return jsonExample(operation.requestBody, `request body of ${method} ${path}`)
}

export function errorCodes(): string[] {
	return required(contract.components.schemas.ErrorCode?.enum, 'ErrorCode enum')
}

export function parameterExample(name: string): string {
	return String(required(contract.components.parameters[name]?.example, `parameter ${name}`))
}

function refName(ref: string | undefined): string | undefined {
	return ref?.split('/').pop()
}

function parameterName(parameter: ParameterRef): string {
	const name =
		parameter.name ?? contract.components.parameters[refName(parameter.$ref) ?? '']?.name
	return required(name, `name of parameter ${parameter.$ref ?? ''}`)
}

type OperationEntry = {
	path: string
	operation: ContractOperation
}

function operationEntries(): OperationEntry[] {
	return Object.entries(contract.paths).flatMap(([path, item]) =>
		Object.values(item).map((operation) => ({ path, operation }))
	)
}

export function operationFixture(operationId: string): OperationFixture {
	const { path, operation } = required(
		operationEntries().find((entry) => entry.operation.operationId === operationId),
		`operation ${operationId}`
	)
	const ok = required(refName(operation.responses?.['200']?.$ref), `200 of ${operationId}`)
	return {
		path,
		parameters: (operation.parameters ?? []).map(parameterName),
		okExample: responseExample(ok)
	}
}

function statusesByResponse(): Map<string, number> {
	const statuses = new Map<string, number>()
	for (const { operation } of operationEntries()) {
		for (const [status, ref] of Object.entries(operation.responses ?? {})) {
			const name = refName(ref.$ref)
			if (name !== undefined && !statuses.has(name)) {
				statuses.set(name, Number(status))
			}
		}
	}
	return statuses
}

function isErrorBody(value: unknown): value is Record<string, unknown> {
	return isRecord(value) && 'code' in value && 'error' in value
}

export function errorExamples(): ErrorExample[] {
	const statuses = statusesByResponse()
	return Object.keys(contract.components.responses).flatMap((response) => {
		const body = contract.components.responses[response]?.content?.['application/json']?.example
		const status = statuses.get(response)
		return isErrorBody(body) && status !== undefined ? [{ response, status, body }] : []
	})
}
