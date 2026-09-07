import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api';
import { connectionStatusLabel, messageFromUnknown } from '@/lib/errors';
describe('errors helpers', () => {
	it('messageFromUnknown reads ApiError and Error', () => {
		expect(messageFromUnknown(new ApiError(400, { message: 'Nope' }))).toBe('Nope');
		expect(messageFromUnknown(new Error('x'))).toBe('x');
		expect(messageFromUnknown(null, 'fallback')).toBe('fallback');
	});
	it('connectionStatusLabel maps offline / reconnecting / live', () => {
		expect(connectionStatusLabel({ conn: 'online', browserOnline: true }).label).toBe('Live');
		expect(connectionStatusLabel({ conn: 'offline', browserOnline: true }).label).toBe(
			'Reconnecting…',
		);
		expect(connectionStatusLabel({ conn: 'offline', browserOnline: false }).label).toBe(
			'Offline',
		);
	});
});
