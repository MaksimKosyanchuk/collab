import { ApiError } from './api';
import type { ConnState } from './blocks';

/** Connection UI states shown in the editor status area. */
export type CollabConnectionState =
	'connecting' | 'online' | 'offline' | 'reconnecting' | 'deleted' | 'revoked';

export function messageFromUnknown(error: unknown, fallback = 'Something went wrong'): string {
	if (error instanceof ApiError) {
		return error.message || fallback;
	}
	if (error instanceof Error && error.message) {
		return error.message;
	}
	if (typeof error === 'string' && error.trim()) {
		return error;
	}
	return fallback;
}

export function actionFailMessage(
	result: { ok: false; error: string } | { ok: true; data: unknown },
	fallback = 'Action failed',
): string | null {
	if (result.ok) return null;
	return result.error || fallback;
}

export function connectionStatusLabel(input: { conn: ConnState; browserOnline: boolean }): {
	label: string;
	tone: 'default' | 'muted' | 'warn' | 'danger';
} {
	if (!input.browserOnline) {
		return { label: 'Offline', tone: 'muted' };
	}
	if (input.conn === 'online') {
		return { label: 'Live', tone: 'default' };
	}
	if (input.conn === 'connecting') {
		return { label: 'Connecting…', tone: 'muted' };
	}
	// WS dropped while the browser is still online — surface as reconnecting.
	return { label: 'Reconnecting…', tone: 'warn' };
}
