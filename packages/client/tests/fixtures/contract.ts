import { readFileSync } from 'node:fs'

type MediaExample = {
	example?: unknown
}

type ContractResponse = {
	content?: Record<string, MediaExample>
}

type ResponseRef = {
	$ref?: string
}

type ContractOperation = {
	requestBody?: ContractResponse
	responses?: Record<string, ResponseRef>
}

type ContractSchema = {
	enum?: string[]
}

type ContractParameter = {
	example?: unknown
}

type ContractComponents = {
	responses: Record<string, ContractResponse>
	schemas: Record<string, ContractSchema>
	parameters: Record<string, ContractParameter>
}

type ContractDocument = {
	paths: Record<string, Record<string, ContractOperation>>
	components: ContractComponents
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

function jsonExample(media: ContractResponse | undefined, what: string): unknown {
	return required(media?.content?.['application/json']?.example, `example for ${what}`)
}

export function responseExample(name: string): unknown {
	return jsonExample(contract.components.responses[name], `response ${name}`)
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

function statusesByResponse(): Map<string, number> {
	const statuses = new Map<string, number>()
	for (const item of Object.values(contract.paths)) {
		for (const operation of Object.values(item)) {
			for (const [status, ref] of Object.entries(operation.responses ?? {})) {
				const name = ref.$ref?.split('/').pop()
				if (name !== undefined && !statuses.has(name)) {
					statuses.set(name, Number(status))
				}
			}
		}
	}
	return statuses
}

function isErrorBody(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && 'code' in value && 'error' in value
}

export function errorExamples(): ErrorExample[] {
	const statuses = statusesByResponse()
	return Object.keys(contract.components.responses).flatMap((response) => {
		const body = contract.components.responses[response]?.content?.['application/json']?.example
		const status = statuses.get(response)
		return isErrorBody(body) && status !== undefined ? [{ response, status, body }] : []
	})
}
