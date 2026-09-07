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
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="space-y-10">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Workspaces</h1>
          <p className="mt-2 max-w-xl text-muted">
            Workspaces you belong to, plus pages shared with you directly.
          </p>

          {workspaces.length === 0 ? (
            <p className="empty mt-10">
              No workspaces yet. Create one, or open a page shared with you
              below.
            </p>
          ) : (
            <ul className="mt-8 space-y-3">
              {workspaces.map((workspace) => (
                <li key={workspace.id}>
                  <Link
                    href={`/app/w/${workspace.id}`}
                    className="panel block rounded-2xl px-5 py-4 transition hover:-translate-y-0.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold">{workspace.name}</p>
                        <p className="text-sm text-muted">/{workspace.slug}</p>
                      </div>
                      <span className="rounded-full border border-line px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
                        {workspace.plan}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Shared with me
          </h2>
          <p className="mt-1 text-sm text-muted">
            Pages others shared to your email without adding you to the
            workspace.
          </p>
          {sharedDocuments.length === 0 ? (
            <p className="empty mt-6">No shared pages yet.</p>
          ) : (
            <ul className="mt-5 space-y-3">
              {sharedDocuments.map((item) => (
                <li key={item.shareId}>
                  <Link
                    href={`/app/w/${item.workspaceId}/d/${item.documentId}`}
                    className="panel block rounded-2xl px-5 py-4 transition hover:-translate-y-0.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold">{item.title}</p>
                        <p className="text-sm text-muted">
                          {item.workspaceName} · {item.access.toLowerCase()}
                        </p>
                      </div>
                      <span className="rounded-full border border-line px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
                        {item.access}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <aside className="panel h-fit rounded-[1.5rem] p-6">
        <h2 className="text-lg font-semibold">New workspace</h2>
        <p className="mt-1 text-sm text-muted">
          Starts on the Free plan. Limits are enforced by the API.
        </p>
        <form action={createWorkspaceAction} className="mt-5 space-y-3">
          <input
            className="field"
            name="name"
            required
            minLength={2}
            maxLength={80}
            placeholder="Product handbook"
          />
          <button className="btn btn-primary w-full" type="submit">
            Create workspace
          </button>
        </form>
      </aside>
    </div>
  );
}
