import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { basename } from 'node:path'

export type Registry = {
	url: string
	close(): Promise<void>
}

type LocalPackage = {
	name: string
	version: string
	manifest: unknown
	tarball: Buffer
	file: string
}

const UPSTREAM = 'https://registry.npmjs.org'

const TARBALL_SEGMENT = '/-/'

function manifestOf(file: string): unknown {
	return JSON.parse(
		execFileSync('tar', ['-xzOf', file, 'package/package.json'], { encoding: 'utf8' })
	)
}

function stringField(value: unknown, field: string, file: string): string {
	const found: unknown =
		typeof value === 'object' && value !== null ? Reflect.get(value, field) : undefined
	if (typeof found !== 'string') {
		throw new Error(`${file} has no ${field} in package/package.json`)
	}
	return found
}

function localPackage(file: string): LocalPackage {
	const manifest = manifestOf(file)
	return {
		name: stringField(manifest, 'name', file),
		version: stringField(manifest, 'version', file),
		manifest,
		tarball: readFileSync(file),
		file: basename(file)
	}
}

function packument(pkg: LocalPackage, url: string): unknown {
	const tarball = `${url}/${pkg.name}${TARBALL_SEGMENT}${pkg.file}`
	const integrity = `sha512-${createHash('sha512').update(pkg.tarball).digest('base64')}`
	const shasum = createHash('sha1').update(pkg.tarball).digest('hex')
	return {
		name: pkg.name,
		'dist-tags': { latest: pkg.version },
		versions: {
			[pkg.version]: Object.assign({}, pkg.manifest, { dist: { tarball, integrity, shasum } })
		}
	}
}

async function proxied(incoming: IncomingMessage, outgoing: ServerResponse): Promise<void> {
	const answer = await fetch(`${UPSTREAM}${incoming.url ?? '/'}`, {
		headers: { accept: incoming.headers.accept ?? '*/*' }
	})
	const body = Buffer.from(await answer.arrayBuffer())
	outgoing.writeHead(answer.status, {
		'content-type': answer.headers.get('content-type') ?? 'application/octet-stream'
	})
	outgoing.end(body)
}

function served(
	packages: Map<string, LocalPackage>,
	url: string,
	incoming: IncomingMessage,
	outgoing: ServerResponse
): Promise<void> {
	const path = decodeURIComponent(new URL(incoming.url ?? '/', url).pathname).slice(1)
	const [name = '', file] = path.split(TARBALL_SEGMENT)
	const local = packages.get(name)
	if (local === undefined) {
		return proxied(incoming, outgoing)
	}
	if (file === undefined) {
		outgoing.writeHead(200, { 'content-type': 'application/json' })
		outgoing.end(JSON.stringify(packument(local, url)))
	} else {
		outgoing.writeHead(200, { 'content-type': 'application/octet-stream' })
		outgoing.end(local.tarball)
	}
	return Promise.resolve()
}

export function startRegistry(port: number, tarballs: string[]): Promise<Registry> {
	const packages = new Map(
		tarballs.map((file) => localPackage(file)).map((pkg) => [pkg.name, pkg])
	)
	const url = `http://127.0.0.1:${port}`
	const server = createServer((incoming, outgoing) => {
		served(packages, url, incoming, outgoing).catch((err: unknown) => {
			outgoing.writeHead(502)
			outgoing.end(err instanceof Error ? err.message : String(err))
		})
	})
	return new Promise((resolve) => {
		server.listen(port, '127.0.0.1', () => {
			resolve({
				url,
				close: () =>
					new Promise((done) => {
						server.close(() => done())
						server.closeAllConnections()
					})
			})
		})
	})
}
