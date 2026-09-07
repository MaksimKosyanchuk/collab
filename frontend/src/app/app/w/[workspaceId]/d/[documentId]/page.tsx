import { CollabEditor } from '@/components/collab-editor';
import { serverApi } from '@/lib/server-api';
import type {
  DocumentDetail,
  WorkspaceDetail,
  WorkspaceMember,
} from '@/lib/types';
import Link from 'next/link';

type Props = {
  params: Promise<{ workspaceId: string; documentId: string }>;
};

export default async function DocumentPage({ params }: Props) {
  const { workspaceId, documentId } = await params;

  try {
    const document = await serverApi<DocumentDetail>(
      `/documents/${documentId}`,
    );

    if (document.workspaceId !== workspaceId) {
      return (
        <div className="panel rounded-2xl p-6">
          <p className="error">Document does not belong to this workspace.</p>
          <Link href="/app" className="btn btn-ghost mt-4">
            Back to app
          </Link>
        </div>
      );
    }

    let members: WorkspaceMember[] = [];
    let workspaceMember = false;
    try {
      const workspace = await serverApi<WorkspaceDetail>(
        `/workspaces/${workspaceId}`,
      );
      members = workspace.members ?? [];
      workspaceMember = true;
    } catch {
      // Document share-only users are not workspace members.
    }

    return (
      <CollabEditor
        workspaceId={workspaceId}
        documentId={documentId}
        accessMeta={document}
        members={members}
        showAccessPanel={workspaceMember && document.access >= 3}
      />
    );
  } catch {
    return (
      <div className="panel rounded-2xl p-6">
        <p className="error">Document not found or access denied.</p>
        <Link href="/app" className="btn btn-ghost mt-4">
          Back to app
        </Link>
      </div>
    );
  }
}
