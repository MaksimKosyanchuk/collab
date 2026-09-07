import { createWorkspaceAction } from '@/lib/actions';
import type { SharedDocumentItem, Workspace } from '@/lib/types';
import Link from 'next/link';

export function WorkspaceList({
  workspaces,
  sharedDocuments,
}: {
  workspaces: Workspace[];
  sharedDocuments: SharedDocumentItem[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="space-y-8">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Workspaces</h1>
          <p className="mt-1 text-[13px] text-muted">
            Workspaces you belong to, plus pages shared with you.
          </p>

          {workspaces.length === 0 ? (
            <p className="empty mt-6">
              No workspaces yet. Create one, or open a shared page below.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-line rounded-md border border-line bg-bg-elevated">
              {workspaces.map((workspace) => (
                <li key={workspace.id}>
                  <Link
                    href={`/app/w/${workspace.id}`}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-neutral-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {workspace.name}
                      </p>
                      <p className="truncate text-[12px] text-muted">
                        /{workspace.slug}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted">
                      {workspace.plan}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="text-sm font-semibold">Shared with me</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            Pages shared to your email without workspace membership.
          </p>
          {sharedDocuments.length === 0 ? (
            <p className="empty mt-4">No shared pages yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line rounded-md border border-line bg-bg-elevated">
              {sharedDocuments.map((item) => (
                <li key={item.shareId}>
                  <Link
                    href={`/app/w/${item.workspaceId}/d/${item.documentId}`}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-neutral-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="truncate text-[12px] text-muted">
                        {item.workspaceName}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted">
                      {item.access}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <aside className="panel h-fit p-4">
        <h2 className="text-sm font-semibold">New workspace</h2>
        <p className="mt-1 text-[13px] text-muted">
          Starts on Free. Limits are enforced by the API.
        </p>
        <form action={createWorkspaceAction} className="mt-3 space-y-2">
          <input
            className="field"
            name="name"
            required
            minLength={2}
            maxLength={80}
            placeholder="Product handbook"
          />
          <button className="btn btn-primary w-full" type="submit">
            Create
          </button>
        </form>
      </aside>
    </div>
  );
}
