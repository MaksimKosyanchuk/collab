import { describe, expect, it, vi, beforeEach } from 'vitest';

const revalidatePath = vi.fn();
const revalidateTag = vi.fn();

vi.mock('next/cache', () => ({
	revalidatePath: (...args: unknown[]) => revalidatePath(...args),
	revalidateTag: (...args: unknown[]) => revalidateTag(...args),
}));

describe('POST /api/revalidate', () => {
	beforeEach(() => {
		vi.resetModules();
		revalidatePath.mockClear();
		revalidateTag.mockClear();
		process.env.REVALIDATE_SECRET = 'test-secret';
	});

	it('rejects missing secret', async () => {
		const { POST } = await import('@/app/api/revalidate/route');
		const res = await POST(
			new Request('http://localhost/api/revalidate', {
				method: 'POST',
				body: JSON.stringify({ slug: 'x' }),
			}),
		);
		expect(res.status).toBe(401);
	});

	it('revalidates slug tag and path (on-demand ISR)', async () => {
		const { POST } = await import('@/app/api/revalidate/route');
		const res = await POST(
			new Request('http://localhost/api/revalidate', {
				method: 'POST',
				headers: { 'x-revalidate-secret': 'test-secret' },
				body: JSON.stringify({
					slug: 'hello',
					documentId: 'doc-1',
					tag: 'workspace-tree:ws',
					path: '/app/w/ws',
				}),
			}),
		);
		expect(res.status).toBe(200);
		expect(revalidateTag).toHaveBeenCalledWith('public-doc:hello');
		expect(revalidatePath).toHaveBeenCalledWith('/p/hello');
		expect(revalidateTag).toHaveBeenCalledWith('workspace-tree:ws');
		expect(revalidatePath).toHaveBeenCalledWith('/app/w/ws');
		const json = (await res.json()) as { revalidated: boolean };
		expect(json.revalidated).toBe(true);
	});
});
