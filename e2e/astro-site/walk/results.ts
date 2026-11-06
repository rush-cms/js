export type CheckStatus = 'PASS' | 'FAIL' | 'BLOCKED'

export type CheckResult = {
	name: string
	status: CheckStatus
	evidence: string
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
