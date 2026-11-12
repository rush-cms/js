import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { run } from '../src/run'
import { SSG_VARIANT } from '../src/ssg'
import { patchText } from '../src/variant'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { bundledTemplate, filesOf, makeTempDir, recordIo, removeTempDirs, textOf } from './support'

let template = ''
const CONTACT_PAGE = 'src/pages/[...locale]/contact.astro'
const ADAPTER = '@astrojs/node'

type Scaffolds = {
	server: string
	ssg: string
}

type Manifest = {
	dependencies: Record<string, string>
	scripts: Record<string, string>
}

beforeEach(() => {
	template = bundledTemplate()
})

afterEach(removeTempDirs)

async function scaffold(argv: string[]): Promise<string> {
	const cwd = makeTempDir()
	const code = await run(
		[...argv, '--no-install'],
		{ userAgent: undefined, cwd },
		recordIo().io,
		template
	)
	expect(code).toBe(0)
	return join(cwd, 'site')
}

async function bothScaffolds(): Promise<Scaffolds> {
	return { server: await scaffold(['site']), ssg: await scaffold(['site', '--ssg']) }
}

function manifestOf(root: string): Manifest {
	return JSON.parse(textOf(root, 'package.json')) as Manifest
}

function changedFiles({ server, ssg }: Scaffolds): string[] {
	return filesOf(ssg).filter((file) => textOf(ssg, file) !== textOf(server, file))
}

describe('default scaffold', () => {
	it('has the files of the template, with the contact page, adapter and server 404', async () => {
		const root = await scaffold(['site'])
		const expected = filesOf(template).map((file) =>
			file === '_gitignore' ? '.gitignore' : file
		)
		expect(filesOf(root)).toEqual([...expected, '.env'].toSorted())
		expect(manifestOf(root).dependencies).toHaveProperty(ADAPTER)
		expect(manifestOf(root).scripts).toHaveProperty('preview')
		expect(textOf(root, 'astro.config.ts')).toContain('adapter: node(')
		expect(textOf(root, 'src/pages/404.astro')).toContain('export const prerender = false')
		expect(textOf(root, 'src/pages/404.astro')).toContain('routePage')
	})
})

describe('--ssg scaffold', () => {
	it('drops only the contact page', async () => {
		const scaffolds = await bothScaffolds()
		const kept = filesOf(scaffolds.server).filter((file) => file !== CONTACT_PAGE)
		expect(filesOf(scaffolds.ssg)).toEqual(kept)
	})

	it('leaves no empty directory where the contact page was', async () => {
		const { ssg } = await bothScaffolds()
		expect(existsSync(join(ssg, 'src/pages/[...locale]'))).toBe(false)
		expect(existsSync(join(ssg, 'src/pages'))).toBe(true)
	})

	it('removes the adapter dependency and the preview script, keeping the rest of the manifest', async () => {
		const { server, ssg } = await bothScaffolds()
		const expected = manifestOf(server)
		delete expected.dependencies[ADAPTER]
		delete expected.scripts.preview
		expect(manifestOf(ssg)).toEqual(expected)
	})

	it('builds static without the adapter or the forms route', async () => {
		const { ssg } = await bothScaffolds()
		const config = textOf(ssg, 'astro.config.ts')
		expect(config).toContain("output: 'static'")
		expect(config).toContain('forms: false')
		expect(config).not.toContain('node')
		expect(config).not.toContain('adapter')
		expect(config).not.toContain('security')
	})

	it('prerenders one 404 page that renders without a request', async () => {
		const { ssg } = await bothScaffolds()
		const page = textOf(ssg, 'src/pages/404.astro')
		expect(page).not.toContain('prerender')
		expect(page).not.toContain('routePage')
		expect(page).toContain('<NotFound />')
	})

	it('leaves no reference to the contact page, the forms route or the preview', async () => {
		const { ssg } = await bothScaffolds()
		const text = filesOf(ssg)
			.filter((file) => file !== 'src/styles/global.css')
			.map((file) => textOf(ssg, file))
			.join('\n')
		expect(text).not.toMatch(/contact|_rush\/forms|preview-deployment|allowedDomains/i)
	})

	it('changes only the declared files', async () => {
		const scaffolds = await bothScaffolds()
		const declared = [...SSG_VARIANT.files.map((patch) => patch.file), 'package.json', '.env']
		expect(changedFiles(scaffolds).toSorted()).toEqual(declared.toSorted())
	})

	it('documents the per-locale 404 pages and the nginx error_page', async () => {
		const { ssg } = await bothScaffolds()
		const readme = textOf(ssg, 'README.md')
		expect(readme).toContain('## 404 pages')
		expect(readme).toContain('error_page 404 /pt/404/index.html')
	})

	it('keeps site from SITE_URL and drops allowedDomains', async () => {
		const { ssg } = await bothScaffolds()
		expect(textOf(ssg, 'astro.config.ts')).toContain('site: siteUrl.href')
		expect(textOf(ssg, '.env.example')).toContain('SITE_URL=')
		expect(textOf(ssg, 'README.md')).toContain('Set `SITE_URL` to your production URL')
		expect(textOf(ssg, 'src/views/home.astro')).toContain(
			'Set SITE_URL to your domain, then build'
		)
	})

	it('names SITE_URL in the next steps of both modes', async () => {
		const cwd = makeTempDir()
		const recorded = recordIo()
		await run(['a', '--no-install'], { userAgent: undefined, cwd }, recorded.io, template)
		expect(recorded.out.join('\n')).toContain('SITE_URL')
	})

	it('names the generated mode in the next steps', async () => {
		const cwd = makeTempDir()
		const server = recordIo()
		const ssg = recordIo()
		await run(['a', '--no-install'], { userAgent: undefined, cwd }, server.io, template)
		await run(['b', '--ssg', '--no-install'], { userAgent: undefined, cwd }, ssg.io, template)
		expect(server.out.join('\n')).toContain('Mode: server site')
		expect(ssg.out.join('\n')).toContain('Mode: static site')
	})

	it('lists --ssg in the usage', async () => {
		const recorded = recordIo()
		await run(['--help'], { userAgent: undefined, cwd: makeTempDir() }, recorded.io)
		expect(recorded.out.join('\n')).toContain('--ssg')
	})
})

describe('patchText', () => {
	it('throws when the pattern does not match exactly once', () => {
		expect(() => patchText('f', 'abc', { find: 'x', replace: '' })).toThrow('exactly one match')
		expect(() => patchText('f', 'aa', { find: 'a', replace: '' })).toThrow('exactly one match')
		expect(() => patchText('f', 'aa', { find: /a/, replace: '' })).toThrow('exactly one match')
	})

	it('replaces the single match literally', () => {
		expect(patchText('f', 'a-b', { find: 'a', replace: '$&' })).toBe('$&-b')
	})
})
