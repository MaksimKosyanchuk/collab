import { WorkspaceList } from '@/components/workspace-list';
import { serverApi } from '@/lib/api';
import type { Workspace } from '@/lib/types';

export default async function AppHomePage() {
  let workspaces: Workspace[] = [];
  let error: string | null = null;

  try {
    workspaces = await serverApi<Workspace[]>('/workspaces');
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

  return <WorkspaceList workspaces={workspaces} />;
}
