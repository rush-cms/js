export type ResponseHeaders = Record<string, string>

export function seeOther(location: string, headers: ResponseHeaders = {}): Response {
	return new Response(null, { status: 303, headers: { ...headers, Location: location } })
}
