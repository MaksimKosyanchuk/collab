import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { RevalidateProcessor } from '../search/revalidate.processor';

describe('RevalidateProcessor', () => {
	const originalFetch = global.fetch;

	afterEach(() => {
		global.fetch = originalFetch;
		jest.restoreAllMocks();
	});

	it('POSTs on-demand revalidate with slug/tag/path after persist', async () => {
		const fetchMock = jest.fn().mockResolvedValue({
			ok: true,
			text: async () => '',
		});
		global.fetch = fetchMock as unknown as typeof fetch;

		const config = {
			get: (key: string) => {
				if (key === 'NEXT_REVALIDATE_URL') {
					return 'http://localhost:3000/api/revalidate';
				}
				if (key === 'REVALIDATE_SECRET') {
					return 'secret';
				}
				return undefined;
			},
		};

		const processor = new RevalidateProcessor(config as ConfigService);
		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

		await processor.process({
			data: {
				slug: 'hello',
				documentId: 'doc-1',
				tag: 'workspace-tree:ws-1',
				path: '/app/w/ws-1',
			},
		} as Job<{
			slug?: string;
			documentId?: string;
			tag?: string;
			path?: string;
		}>);

		expect(fetchMock).toHaveBeenCalledWith(
			'http://localhost:3000/api/revalidate',
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({
					'x-revalidate-secret': 'secret',
				}),
			}),
		);
		const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body) as Record<
			string,
			unknown
		>;
		expect(body.slug).toBe('hello');
		expect(body.tag).toBe('workspace-tree:ws-1');
		expect(body.path).toBe('/app/w/ws-1');
	});
});
