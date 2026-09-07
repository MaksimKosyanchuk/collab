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
    <div className="mx-auto grid max-w-5xl gap-3 lg:grid-cols-[1fr_320px]">
      <section className="panel p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted">
              Workspace
            </p>
            <h1 className="truncate text-sm font-semibold">{workspace.name}</h1>
            <p className="mt-0.5 text-[12px] text-muted">
              {workspace.plan}
              {workspace.myRole ? ` · ${workspace.myRole}` : ''}
            </p>
          </div>
          <Link href="/app" className="btn btn-ghost shrink-0">
            All
          </Link>
        </div>

        <DocumentTreeNav
          workspaceId={workspace.id}
          documents={documents}
          canEdit={canEditTree}
        />

        {canEditTree ? (
          <form
            action={create}
            className="mt-3 space-y-2 border-t border-line pt-3"
          >
            <p className="text-[13px] font-medium">New page</p>
            <input
              className="field"
              name="title"
              placeholder="Untitled"
              maxLength={200}
            />
            <select className="field" name="parentId" defaultValue="">
              <option value="">Top level</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  Nest under: {doc.title}
                </option>
              ))}
            </select>
            <button className="btn btn-primary w-full" type="submit">
              Create
            </button>
          </form>
        ) : null}
      </section>

      <div className="space-y-3">
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
    </div>
  );
}
