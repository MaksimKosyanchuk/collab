import { DocumentTree } from '@/components/document-tree';
import { serverApi } from '@/lib/api';
import type { DocumentTreeItem, WorkspaceDetail } from '@/lib/types';

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function WorkspacePage({ params }: Props) {
  const { workspaceId } = await params;

  try {
    const [workspace, documents] = await Promise.all([
      serverApi<WorkspaceDetail>(`/workspaces/${workspaceId}`),
      serverApi<DocumentTreeItem[]>(`/workspaces/${workspaceId}/documents`),
    ]);

    return <DocumentTree workspace={workspace} documents={documents} />;
  } catch (error) {
    return (
      <div className="panel rounded-2xl p-6">
        <p className="error">
          {error instanceof Error ? error.message : 'Workspace unavailable'}
        </p>
      </div>
    );
  }
}
