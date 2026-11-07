import { writeFileSync } from 'node:fs'

export type CheckStatus = 'PASS' | 'FAIL' | 'BLOCKED'

export type CheckResult = {
	name: string
	status: CheckStatus
	evidence: string
}

export type CheckLog = {
	path: string
	results: CheckResult[]
}

export class Blocked extends Error {}

export async function runCheck(name: string, check: () => Promise<string>): Promise<CheckResult> {
	try {
		return { name, status: 'PASS', evidence: await check() }
	} catch (err) {
		const evidence = err instanceof Error ? err.message : String(err)
		return { name, status: err instanceof Blocked ? 'BLOCKED' : 'FAIL', evidence }
	}
}

export async function recordCheck(
	log: CheckLog,
	name: string,
	check: () => Promise<string>
): Promise<CheckResult> {
	const result = await runCheck(name, check)
	console.log(`${result.status} ${result.name}: ${result.evidence}`)
	log.results.push(result)
	writeFileSync(log.path, JSON.stringify(log.results, null, '\t'))
	return result
}

export function allPassed(log: CheckLog): boolean {
	return log.results.every((result) => result.status === 'PASS')
}
