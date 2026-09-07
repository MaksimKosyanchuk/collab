'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { moveDocumentAction } from '@/lib/actions';
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
  canEdit,
  onMoved,
}: {
  workspaceId: string;
  parentId: string | null;
  byParent: Map<string | null, DocumentTreeItem[]>;
  depth: number;
  canEdit: boolean;
  onMoved: () => void;
}) {
  const nodes = byParent.get(parentId) ?? [];
  const [pending, startTransition] = useTransition();
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  if (nodes.length === 0 && depth === 0) {
    return <p className="empty">No documents yet.</p>;
  }

  function runMove(
    documentId: string,
    input: { parentId: string | null; rank?: string },
  ) {
    startTransition(async () => {
      const result = await moveDocumentAction(workspaceId, documentId, input);
      if (result.ok) {
        onMoved();
      }
    });
  }

  return (
    <ul
      className={
        depth === 0
          ? 'space-y-1'
          : 'ml-4 space-y-1 border-l border-line pl-3'
      }
    >
      {nodes.map((node, index) => (
        <li key={node.id}>
          <div
            draggable={canEdit && !pending}
            onDragStart={(event) => {
              event.dataTransfer.setData('text/document-id', node.id);
              event.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(event) => {
              if (!canEdit) return;
              event.preventDefault();
              setDragOverId(node.id);
            }}
            onDragLeave={() =>
              setDragOverId((id) => (id === node.id ? null : id))
            }
            onDrop={(event) => {
              if (!canEdit) return;
              event.preventDefault();
              setDragOverId(null);
              const documentId = event.dataTransfer.getData('text/document-id');
              if (!documentId || documentId === node.id) return;
              const children = byParent.get(node.id) ?? [];
              const lastChild = children[children.length - 1];
              runMove(documentId, {
                parentId: node.id,
                rank: lastChild ? `${lastChild.rank}z` : 'a0',
              });
            }}
            className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 hover:bg-white/70 ${
              dragOverId === node.id ? 'bg-accent/10 ring-1 ring-accent/40' : ''
            }`}
          >
            <Link
              href={`/app/w/${workspaceId}/d/${node.id}`}
              className="min-w-0 flex-1 font-medium"
            >
              {node.title}
            </Link>
            <div className="flex shrink-0 items-center gap-1">
              {canEdit ? (
                <>
                  <button
                    type="button"
                    className="rounded px-1.5 text-xs text-muted hover:bg-white"
                    title="Move up"
                    disabled={pending || index === 0}
                    onClick={() => {
                      const prev = nodes[index - 1];
                      if (!prev) return;
                      runMove(node.id, {
                        parentId: node.parentId,
                        rank: `0${prev.rank}`,
                      });
                    }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="rounded px-1.5 text-xs text-muted hover:bg-white"
                    title="Move down"
                    disabled={pending || index >= nodes.length - 1}
                    onClick={() => {
                      const next = nodes[index + 1];
                      if (!next) return;
                      runMove(node.id, {
                        parentId: node.parentId,
                        rank: `${next.rank}z`,
                      });
                    }}
                  >
                    ↓
                  </button>
                  {node.parentId ? (
                    <button
                      type="button"
                      className="rounded px-1.5 text-xs text-muted hover:bg-white"
                      title="Move to root"
                      disabled={pending}
                      onClick={() =>
                        runMove(node.id, { parentId: null })
                      }
                    >
                      ↖
                    </button>
                  ) : null}
                </>
              ) : null}
              {node.publicationStatus === 'PUBLISHED' ? (
                <span className="text-xs uppercase tracking-wide text-accent">
                  live
                </span>
              ) : null}
            </div>
          </div>
          <TreeNodes
            workspaceId={workspaceId}
            parentId={node.id}
            byParent={byParent}
            depth={depth + 1}
            canEdit={canEdit}
            onMoved={onMoved}
          />
        </li>
      ))}
    </ul>
  );
}

export function DocumentTreeNav({
  workspaceId,
  documents,
  canEdit,
}: {
  workspaceId: string;
  documents: DocumentTreeItem[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const byParent = buildForest(documents);

  return (
    <div className="mt-6">
      {canEdit ? (
        <p className="mb-2 text-xs text-muted">
          Drag onto a page to nest. ↑↓ reorder · ↖ un-nest.
        </p>
      ) : null}
      <TreeNodes
        workspaceId={workspaceId}
        parentId={null}
        byParent={byParent}
        depth={0}
        canEdit={canEdit}
        onMoved={() => router.refresh()}
      />
    </div>
  );
}
