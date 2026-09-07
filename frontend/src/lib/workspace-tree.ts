import { unstable_cache } from 'next/cache';
import { ApiError, apiFetch } from './api';
import { workspaceTreeTag } from './cache-tags';
import { getAccessToken } from './server-api';
import type { DocumentTreeItem } from './types';
export { workspaceTreeTag } from './cache-tags';
export async function getCachedWorkspaceTree(workspaceId: string): Promise<DocumentTreeItem[]> {
	const token = await getAccessToken();
	if (!token) {
		throw new ApiError(401, { message: 'Unauthorized' });
	}
	return unstable_cache(
		async () =>
			apiFetch<DocumentTreeItem[]>(`/workspaces/${workspaceId}/documents`, {
				accessToken: token,
			}),
		['workspace-tree', workspaceId],
		{
			tags: [workspaceTreeTag(workspaceId)],
			revalidate: 60,
		},
	)();
}
