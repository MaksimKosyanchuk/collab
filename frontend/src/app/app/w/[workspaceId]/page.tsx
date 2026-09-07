import { DocumentTree } from '@/components/document-tree';
import { serverApi } from '@/lib/api';
import type { AuthUser, DocumentTreeItem, WorkspaceDetail } from '@/lib/types';

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function WorkspacePage({ params }: Props) {
  const { workspaceId } = await params;

  try {
    const [workspace, documents, me] = await Promise.all([
      serverApi<WorkspaceDetail>(`/workspaces/${workspaceId}`),
      serverApi<DocumentTreeItem[]>(`/workspaces/${workspaceId}/documents`),
      serverApi<AuthUser>('/auth/me'),
    ]);

    return (
      <DocumentTree
        workspace={workspace}
        documents={documents}
        currentUserId={me.id}
      />
    );
  } catch (error) {
    return (
      <div className="panel p-4">
        <p className="error">
          {error instanceof Error ? error.message : 'Workspace unavailable'}
        </p>
      </div>
    );
  }
}
