import type { ApiErrorBody } from './types';
export const ACCESS_COOKIE = 'collab_access';
export const REFRESH_COOKIE = 'collab_refresh';
export function apiBase(): string {
	if (typeof window === 'undefined') {
		return (
			process.env.INTERNAL_API_URL ??
			process.env.NEXT_PUBLIC_API_URL ??
			'http://localhost:3001'
		);
	}
	return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}
export class ApiError extends Error {
	status: number;
	body: ApiErrorBody;
	constructor(status: number, body: ApiErrorBody) {
		const message = Array.isArray(body.message)
			? body.message.join(', ')
			: body.message || `Request failed (${status})`;
		super(message);
		this.status = status;
		this.body = body;
	}
}
export async function apiFetch<T>(
	path: string,
	init: RequestInit & {
		accessToken?: string | null;
	} = {},
): Promise<T> {
	const { accessToken, headers, ...rest } = init;
	const res = await fetch(`${apiBase()}${path}`, {
		...rest,
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json',
			...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
			...headers,
		},
		cache: 'no-store',
	});
	if (res.status === 204) {
		return undefined as T;
	}
	const text = await res.text();
	const body = text ? (JSON.parse(text) as ApiErrorBody & T) : ({} as T);
	if (!res.ok) {
		throw new ApiError(res.status, body as ApiErrorBody);
	}
	return body as T;
}
export function safeNextPath(next: string | null | undefined): string | null {
	if (!next || !next.startsWith('/') || next.startsWith('//')) {
		return null;
	}
	return next;
}
