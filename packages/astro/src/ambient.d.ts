declare module 'astro:env/server' {
	export const RUSH_API_URL: string | undefined
	export const RUSH_SITE_ID: string | undefined
	export const RUSH_API_TOKEN: string | undefined
}

declare module 'virtual:rush/config' {
	const config: import('./config').RushSiteConfig
	export default config
}
