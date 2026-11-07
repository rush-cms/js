import { describe, expect, it } from 'vitest'
import { runCommand } from '../src/spawn-install'

describe('runCommand', () => {
	it('resolves the exit code of the command', async () => {
		const code = await runCommand(process.execPath, ['-e', 'process.exit(3)'], process.cwd())
		expect(code).toBe(3)
	})

	it('resolves 0 when the command succeeds', async () => {
		const code = await runCommand(process.execPath, ['-e', ''], process.cwd())
		expect(code).toBe(0)
	})

	it('resolves 1 when the command cannot start', async () => {
		const code = await runCommand('rush-cms-no-such-command', [], process.cwd())
		expect(code).toBe(1)
	})
})
