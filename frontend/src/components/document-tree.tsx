import Link from 'next/link';
import { createDocumentAction } from '@/lib/actions';
import type { DocumentTreeItem } from '@/lib/types';

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
  workspaceId,
  workspaceName,
  documents,
}: {
  workspaceId: string;
  workspaceName: string;
  documents: DocumentTreeItem[];
}) {
  const byParent = buildForest(documents);
  const create = createDocumentAction.bind(null, workspaceId);

  return (
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="panel rounded-[1.5rem] p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Workspace</p>
            <h1 className="text-2xl font-semibold">{workspaceName}</h1>
          </div>
          <Link href="/app" className="btn btn-ghost">
            All
          </Link>
        </div>

        <div className="mt-6">
          <TreeNodes
            workspaceId={workspaceId}
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

      <section className="panel flex min-h-72 items-center justify-center rounded-[1.5rem] p-8 text-center">
        <div>
          <p className="brand text-3xl">Pick a page</p>
          <p className="mt-2 max-w-sm text-muted">
            The CRDT editor and presence will mount here as a Client Component
            connected to <code className="text-ink">/collab</code>.
          </p>
        </div>
      </section>
    </div>
  );
}
