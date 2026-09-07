import { WorkspaceList } from '@/components/workspace-list';
import { serverApi } from '@/lib/api';
import type { SharedDocumentItem, Workspace } from '@/lib/types';

export default async function AppHomePage() {
  let workspaces: Workspace[] = [];
  let sharedDocuments: SharedDocumentItem[] = [];
  let error: string | null = null;

  try {
    const [ws, shared] = await Promise.all([
      serverApi<Workspace[]>('/workspaces'),
      serverApi<SharedDocumentItem[]>('/documents/shared'),
    ]);
    workspaces = ws;
    sharedDocuments = shared;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load workspaces';
  }

  if (error) {
    return (
      <div className="panel rounded-2xl p-6">
        <p className="error">{error}</p>
      </div>
    );
  }

  return (
    <WorkspaceList
      workspaces={workspaces}
      sharedDocuments={sharedDocuments}
    />
  );
}
