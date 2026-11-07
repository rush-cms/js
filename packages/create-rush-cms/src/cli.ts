#!/usr/bin/env node
import { run } from './run'
import { spawnInstall } from './spawn-install'

process.exitCode = await run(
	process.argv.slice(2),
	{ userAgent: process.env.npm_config_user_agent, cwd: process.cwd() },
	{
		out: (line) => console.log(line),
		err: (line) => console.error(line),
		spawn: spawnInstall
	}
)
