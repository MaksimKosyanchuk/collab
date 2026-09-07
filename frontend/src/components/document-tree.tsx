import Link from 'next/link';
import { createDocumentAction } from '@/lib/actions';
import { DocumentTreeNav } from '@/components/document-tree-nav';
import { WorkspaceBillingPanel } from '@/components/workspace-billing-panel';
import { WorkspaceMembersPanel } from '@/components/workspace-members-panel';
import type { DocumentTreeItem, WorkspaceDetail } from '@/lib/types';

export function DocumentTree({
  workspace,
  documents,
  currentUserId,
}: {
  workspace: WorkspaceDetail;
  documents: DocumentTreeItem[];
  currentUserId: string;
}) {
  const create = createDocumentAction.bind(null, workspace.id);
  const canEditTree =
    workspace.myRole === 'OWNER' ||
    workspace.myRole === 'ADMIN' ||
    workspace.myRole === 'EDITOR';

  return (
    <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-6">
        <section className="panel rounded-[1.5rem] p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted">Workspace</p>
              <h1 className="text-2xl font-semibold">{workspace.name}</h1>
              <p className="mt-1 text-sm text-muted">
                Plan {workspace.plan}
                {workspace.myRole ? ` · you are ${workspace.myRole}` : ''}
              </p>
            </div>
            <Link href="/app" className="btn btn-ghost">
              All
            </Link>
          </div>

          <DocumentTreeNav
            workspaceId={workspace.id}
            documents={documents}
            canEdit={canEditTree}
          />

          <form action={create} className="mt-6 space-y-3 border-t border-line pt-5">
            <p className="text-sm font-medium">New page</p>
            <input
              className="field"
              name="title"
              placeholder="Untitled"
              maxLength={200}
            />
            <button className="btn btn-primary w-full" type="submit">
              Create document
            </button>
          </form>
        </section>

        <WorkspaceMembersPanel
          workspaceId={workspace.id}
          members={workspace.members}
          invitations={workspace.invitations ?? []}
          myRole={workspace.myRole}
          currentUserId={currentUserId}
        />

        <WorkspaceBillingPanel
          workspaceId={workspace.id}
          plan={workspace.plan}
          storageUsedBytes={workspace.storageUsedBytes}
          subscription={workspace.subscription}
          myRole={workspace.myRole}
        />
      </div>

      <section className="panel flex min-h-72 items-center justify-center rounded-[1.5rem] p-8 text-center">
        <div>
          <p className="brand text-3xl">Pick a page</p>
          <p className="mt-2 max-w-sm text-muted">
            Open a document to collaborate in real time.
          </p>
        </div>
      </section>
    </div>
  );
}
