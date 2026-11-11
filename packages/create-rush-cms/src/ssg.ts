import type { FilePatch, ManifestPatch, TextPatch, Variant } from './variant'

const CONTACT_PAGE = 'src/pages/[...locale]/contact.astro'

const NODE_ADAPTER = '@astrojs/node'

const STATIC_DEPLOYMENT = `## Navigation

Site content is fetched by stable keys that you create in Rush CMS:

| Key      | Kind       | Used by                                                |
| -------- | ---------- | ------------------------------------------------------ |
| \`main\`   | Navigation | The header menu (nested items open on hover and focus) |
| \`footer\` | Navigation | The footer menu                                        |

Missing content renders nothing: no menu without the navigation. Change a key where the \`TODO\` points to it.

## Deployment

This is a purely static site: no adapter, no server entry, no forms route and no preview deployment (the preview
needs a server: scaffold without \`--ssg\` for it).

- \`npm run build\` fetches every page from the API and writes \`dist/\`. Upload that folder to any static host. Pages
  change only when you build again, so rebuild after publishing content.
- Set \`site\` to your production URL: canonical links, \`hreflang\` links and the sitemap use it.
- Retired slugs are not redirected: with no server, a URL that no longer exists gets your 404 page.

## 404 pages

\`src/pages/404.astro\` is prerendered into \`dist/404.html\` and renders with the default locale. A static host serves it
for every unknown URL. The template never guesses your locales: to give a locale its own 404 page, add a page under
that locale's prefix from \`localePaths\` (the prefix \`pt\` is an example): copy \`src/pages/404.astro\` to
\`src/pages/pt/404.astro\` and add one \`../\` to the path of its \`NotFound\` import. It renders with that locale,
because the locale comes from the first path segment. Only the root page builds to \`dist/404.html\`: with Astro's
default \`build.format: 'directory'\` this one builds to \`dist/pt/404/index.html\`.

Then make the host serve it. Hosts that look for a nested \`404.html\` do not find that file, so point the host at it.
With nginx, name one \`error_page\` per locale prefix:

\`\`\`nginx
server {
	root /var/www/example-site;
	error_page 404 /404.html;

	location /pt/ {
		error_page 404 /pt/404/index.html;
	}

	location /es/ {
		error_page 404 /es/404/index.html;
	}
}
\`\`\`

`

const ASTRO_CONFIG: FilePatch = {
	file: 'astro.config.ts',
	patches: [
		{ find: `import node from '${NODE_ADAPTER}'\n`, replace: '' },
		{ find: "\tadapter: node({ mode: 'standalone' }),\n", replace: '' },
		{ find: /\tsecurity: \{[\s\S]*?\n\t\},\n/, replace: '' },
		{ find: 'rush({\n', replace: 'rush({\n\t\t\tforms: false,\n' },
		{
			find: /\t\t\t\/\/ TODO: set how many reverse proxies[^\n]*\n\t\t\ttrustedProxies: 1\n/,
			replace: '\t\t\ttrustedProxies: 0\n'
		}
	]
}

const NOT_FOUND: FilePatch = {
	file: 'src/pages/404.astro',
	patches: [
		{
			find: /import type \{ SitePageProps \}[^\n]*\nimport \{ routePage \}[^\n]*\n/,
			replace: ''
		},
		{
			find: /\nexport const prerender = false[\s\S]*?Astro\.response\.status = 404\n/,
			replace: ''
		}
	]
}

const HOME: FilePatch = {
	file: 'src/views/home.astro',
	patches: [
		{ find: /\t\{\n\t\ttitle: 'Add a contact form',[\s\S]*?\n\t\},\n/, replace: '' },
		{
			find: 'Set your domain in site and security.allowedDomains, count the proxies in front of the server, then build.',
			replace:
				'Set your domain in site, then build and upload the dist folder to any static host.'
		}
	]
}

const ENV_EXAMPLE: FilePatch = {
	file: '.env.example',
	patches: [{ find: 'RUSH_PREVIEW=\n', replace: '' }]
}

const README_PATCHES: TextPatch[] = [
	{ find: 'locale, navigation and form comes', replace: 'locale and navigation comes' },
	{
		find: /\| `RUSH_PREVIEW`[^\n]*\n/,
		replace: ''
	},
	{ find: /\| `npm run preview`[^\n]*\n/, replace: '' },
	{
		find: /\| `src\/pages\/404.astro`[^\n]*\n/,
		replace:
			'| `src/pages/404.astro`                 | Every other path: the prerendered not-found page (`dist/404.html`)               |\n'
	},
	{ find: /\| `src\/pages\/\[\.\.\.locale\]\/contact.astro`[^\n]*\n/, replace: '' },
	{ find: /## Navigation and forms[\s\S]*?(?=## Styling)/, replace: STATIC_DEPLOYMENT }
]

const README: FilePatch = { file: 'README.md', patches: README_PATCHES }

const withoutNodeAdapter: ManifestPatch = (manifest) => {
	const dependencies = manifest.dependencies as Record<string, string>
	delete dependencies[NODE_ADAPTER]
	const scripts = manifest.scripts as Record<string, string>
	delete scripts.preview
}

export const SSG_VARIANT: Variant = {
	name: 'static',
	drop: [CONTACT_PAGE],
	files: [ASTRO_CONFIG, NOT_FOUND, HOME, ENV_EXAMPLE, README],
	manifest: withoutNodeAdapter
}
