import Link from 'next/link';
import { createDocumentAction } from '@/lib/actions';
import { WorkspaceMembersPanel } from '@/components/workspace-members-panel';
import type { DocumentTreeItem, WorkspaceDetail } from '@/lib/types';

function buildForest(items: DocumentTreeItem[]) {
  const byParent = new Map<string | null, DocumentTreeItem[]>();
  for (const item of items) {
    const key = item.parentId;
    const list = byParent.get(key) ?? [];
    list.push(item);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.rank.localeCompare(b.rank));
  }
  return byParent;
}

function TreeNodes({
  workspaceId,
  parentId,
  byParent,
  depth,
}: {
  workspaceId: string;
  parentId: string | null;
  byParent: Map<string | null, DocumentTreeItem[]>;
  depth: number;
}) {
  const nodes = byParent.get(parentId) ?? [];
  if (nodes.length === 0 && depth === 0) {
    return <p className="empty">No documents yet.</p>;
  }

  return (
    <ul className={depth === 0 ? 'space-y-1' : 'ml-4 space-y-1 border-l border-line pl-3'}>
      {nodes.map((node) => (
        <li key={node.id}>
          <Link
            href={`/app/w/${workspaceId}/d/${node.id}`}
            className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-white/70"
          >
            <span className="font-medium">{node.title}</span>
            {node.publicationStatus === 'PUBLISHED' ? (
              <span className="text-xs uppercase tracking-wide text-accent">
                live
              </span>
            ) : null}
          </Link>
          <TreeNodes
            workspaceId={workspaceId}
            parentId={node.id}
            byParent={byParent}
            depth={depth + 1}
          />
        </li>
      ))}
    </ul>
  );
}

export function DocumentTree({
  workspace,
  documents,
}: {
  workspace: WorkspaceDetail;
  documents: DocumentTreeItem[];
}) {
  const byParent = buildForest(documents);
  const create = createDocumentAction.bind(null, workspace.id);

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

          <div className="mt-6">
            <TreeNodes
              workspaceId={workspace.id}
              parentId={null}
              byParent={byParent}
              depth={0}
            />
          </div>

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
