declare module '*.astro' {
	type AstroComponent = (props: Record<string, unknown>) => unknown
	const component: AstroComponent
	export default component
}
