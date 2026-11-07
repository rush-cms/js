import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { httpStatus } from './http.ts'

export type Command = {
	cwd: string
	argv: string[]
	env: Record<string, string>
	unset?: string[]
}

export type Running = {
	pid: number
	output(): string
	finished(): Promise<number | null>
	untilOutput(pattern: RegExp): Promise<string>
	untilAnswering(url: string): Promise<void>
	stop(): Promise<void>
}

const READY_TIMEOUT_MS = 120_000
const POLL_MS = 250
const STOP_GRACE_MS = 10_000
const TAIL_CHARS = 3_000

function tailOf(text: string): string {
	return text.slice(-TAIL_CHARS)
}

function signalGroup(pid: number, signal: NodeJS.Signals): void {
	try {
		process.kill(-pid, signal)
	} catch (err) {
		if (!(err instanceof Error && 'code' in err && err.code === 'ESRCH')) {
			throw err
		}
	}
}

function environment(command: Command): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = { ...process.env }
	for (const name of command.unset ?? []) {
		delete env[name]
	}
	return { ...env, ...command.env }
}

function startedPid(pid: number | undefined, command: Command): number {
	if (pid === undefined) {
		throw new Error(`${command.argv.join(' ')} did not start`)
	}
	return pid
}

export function startProcess(command: Command): Running {
	const [file = '', ...args] = command.argv
	const child = spawn(file, args, {
		cwd: command.cwd,
		env: environment(command),
		detached: true,
		stdio: ['ignore', 'pipe', 'pipe']
	})
	const pid = startedPid(child.pid, command)
	let output = ''
	let done = false
	const listeners = new Set<() => void>()
	const notify = (): void => listeners.forEach((listener) => listener())
	const append = (chunk: Buffer): void => {
		output += chunk.toString('utf8')
		notify()
	}
	child.stdout.on('data', append)
	child.stderr.on('data', append)
	const exit = new Promise<number | null>((resolve) => {
		child.on('exit', (code) => {
			done = true
			notify()
			resolve(code)
		})
	})
	const label = command.argv.join(' ')

	function untilOutput(pattern: RegExp): Promise<string> {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				listeners.delete(check)
				reject(new Error(`${label}: ${pattern} never printed\n${tailOf(output)}`))
			}, READY_TIMEOUT_MS)
			function check(): void {
				if (pattern.test(output) || done) {
					clearTimeout(timer)
					listeners.delete(check)
					resolve(output)
				}
			}
			listeners.add(check)
			check()
		})
	}

	async function untilAnswering(url: string): Promise<void> {
		const deadline = Date.now() + READY_TIMEOUT_MS
		while (Date.now() < deadline) {
			if (done) {
				throw new Error(`${label} exited before answering ${url}\n${tailOf(output)}`)
			}
			const answered = await httpStatus(url).then(
				() => true,
				() => false
			)
			if (answered) {
				return
			}
			await delay(POLL_MS)
		}
		throw new Error(`${label} never answered ${url}\n${tailOf(output)}`)
	}

	async function stop(): Promise<void> {
		signalGroup(pid, 'SIGTERM')
		await Promise.race([exit, delay(STOP_GRACE_MS)])
		signalGroup(pid, 'SIGKILL')
		await exit
	}

	return {
		pid,
		output: () => output,
		finished: () => exit,
		untilOutput,
		untilAnswering,
		stop
	}
}
