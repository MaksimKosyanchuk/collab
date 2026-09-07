import { unstable_cache } from 'next/cache';
import { ApiError, apiFetch, getAccessToken } from './api';
import type { DocumentTreeItem } from './types';

/** Cache tag for workspace document tree — invalidate on create / move / delete / title flush. */
export function workspaceTreeTag(workspaceId: string): string {
  return `workspace-tree:${workspaceId}`;
}

/**
 * Cached read of the workspace document tree (TZ: cache reads + invalidate on change).
 * Same payload for all members; keyed by workspace only.
 */
export async function getCachedWorkspaceTree(
  workspaceId: string,
): Promise<DocumentTreeItem[]> {
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
