import { CollabEditor } from '@/components/collab-editor';
import { serverApi } from '@/lib/api';
import type { DocumentDetail, Workspace, WorkspaceMember } from '@/lib/types';
import Link from 'next/link';

type Props = {
  params: Promise<{ workspaceId: string; documentId: string }>;
};

export default async function DocumentPage({ params }: Props) {
  const { workspaceId, documentId } = await params;

  try {
    const [document, workspace] = await Promise.all([
      serverApi<DocumentDetail>(`/documents/${documentId}`),
      serverApi<Workspace & { members: WorkspaceMember[] }>(
        `/workspaces/${workspaceId}`,
      ),
    ]);

    return (
      <CollabEditor
        workspaceId={workspaceId}
        documentId={documentId}
        accessMeta={document}
        members={workspace.members ?? []}
      />
    );
  } catch {
    return (
      <div className="panel rounded-2xl p-6">
        <p className="error">Document not found or access denied.</p>
        <Link href={`/app/w/${workspaceId}`} className="btn btn-ghost mt-4">
          Back to tree
        </Link>
      </div>
    );
  }
}
