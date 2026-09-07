'use client';

import Link from 'next/link';
import { DocumentAccessPanel } from '@/components/document-access-panel';
import { BLOCK_TYPES, type BlockType } from '@/lib/blocks';
import { useCollabDoc } from '@/hooks/use-collab-doc';
import type { DocumentDetail, WorkspaceMember } from '@/lib/types';

export function CollabEditor({
  workspaceId,
  documentId,
  accessMeta,
  members,
  shareToken,
  showAccessPanel = true,
}: {
  workspaceId: string;
  documentId: string;
  accessMeta: DocumentDetail;
  members: WorkspaceMember[];
  shareToken?: string | null;
  showAccessPanel?: boolean;
}) {
  const {
    title,
    blocks,
    presence,
    canEdit,
    conn,
    browserOnline,
    updateTitle,
    updateBlock,
    addBlock,
    removeBlock,
    setCursor,
  } = useCollabDoc(documentId, shareToken);

  if (conn === 'deleted') {
    return (
      <div className="panel rounded-[1.5rem] p-8">
        <h1 className="text-2xl font-semibold">Document deleted</h1>
        <p className="mt-2 text-muted">
          Someone removed this page while you were connected. The editor is
          locked.
        </p>
        <Link href={`/app/w/${workspaceId}`} className="btn btn-primary mt-6">
          Back to workspace
        </Link>
      </div>
    );
  }

  const statusLabel = !browserOnline
    ? 'Offline (browser)'
    : conn === 'online'
      ? 'Live'
      : conn === 'connecting'
        ? 'Connecting…'
        : 'Reconnecting…';

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <aside className="panel space-y-4 rounded-2xl p-4">
        <Link
          href={showAccessPanel ? `/app/w/${workspaceId}` : '/app'}
          className="text-sm text-muted"
        >
          ← {showAccessPanel ? 'Documents' : 'App'}
        </Link>
        <div>
          <p className="text-sm text-muted">Status</p>
          <p className="font-semibold">{statusLabel}</p>
          {!canEdit && conn === 'online' ? (
            <p className="mt-1 text-xs text-muted">View only</p>
          ) : null}
        </div>
        <div>
          <p className="mb-2 text-sm text-muted">Present</p>
          {presence.length === 0 ? (
            <p className="empty text-sm">Just you</p>
          ) : (
            <ul className="space-y-2">
              {presence.map((user) => (
                <li key={user.userId} className="flex items-center gap-2 text-sm">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: user.color }}
                  />
                  <span>{user.displayName}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {showAccessPanel ? (
          <DocumentAccessPanel
            workspaceId={workspaceId}
            documentId={documentId}
            initial={accessMeta}
            members={members}
          />
        ) : (
          <p className="border-t border-line pt-4 text-xs text-muted">
            Access via share link
          </p>
        )}
      </aside>

      <section className="panel min-h-[28rem] rounded-[1.5rem] p-6 md:p-8">
        <input
          className="w-full border-0 bg-transparent text-3xl font-semibold tracking-tight outline-none"
          value={title}
          disabled={!canEdit || conn !== 'online'}
          onChange={(event) => updateTitle(event.target.value)}
          placeholder="Untitled"
        />

        <div className="mt-8 space-y-4">
          {blocks.length === 0 ? (
            <p className="empty">No blocks yet.</p>
          ) : (
            blocks.map((block) => (
              <div key={block.id} className="group relative">
                {presence
                  .filter((user) => user.cursor?.blockId === block.id)
                  .map((user) => (
                    <span
                      key={user.userId}
                      className="mb-1 mr-2 inline-block rounded-full px-2 py-0.5 text-[11px] text-white"
                      style={{ background: user.color }}
                    >
                      {user.displayName}
                    </span>
                  ))}

                {block.type === 'checkbox' ? (
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-2"
                      checked={!!block.checked}
                      disabled={!canEdit || conn !== 'online'}
                      onChange={(event) =>
                        updateBlock(block.id, { checked: event.target.checked })
                      }
                    />
                    <textarea
                      className="field min-h-[2.75rem] resize-y"
                      value={block.text}
                      disabled={!canEdit || conn !== 'online'}
                      onChange={(event) =>
                        updateBlock(block.id, { text: event.target.value })
                      }
                      onSelect={(event) =>
                        setCursor(
                          block.id,
                          (event.target as HTMLTextAreaElement).selectionStart,
                        )
                      }
                    />
                  </label>
                ) : block.type === 'image' ? (
                  <div className="space-y-2">
                    <input
                      className="field"
                      placeholder="Image URL"
                      value={block.src ?? ''}
                      disabled={!canEdit || conn !== 'online'}
                      onChange={(event) =>
                        updateBlock(block.id, { src: event.target.value })
                      }
                    />
                    {block.src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={block.src}
                        alt={block.text || ''}
                        className="max-h-72 rounded-xl"
                      />
                    ) : null}
                  </div>
                ) : block.type === 'list' ? (
                  <textarea
                    className="field min-h-[5rem] resize-y font-mono text-sm"
                    value={(block.items ?? ['']).join('\n')}
                    disabled={!canEdit || conn !== 'online'}
                    placeholder="One item per line"
                    onChange={(event) =>
                      updateBlock(block.id, {
                        items: event.target.value.split('\n'),
                        text: event.target.value,
                      })
                    }
                    onSelect={(event) =>
                      setCursor(
                        block.id,
                        (event.target as HTMLTextAreaElement).selectionStart,
                      )
                    }
                  />
                ) : (
                  <textarea
                    className={`field resize-y ${
                      block.type === 'heading'
                        ? 'min-h-[3rem] text-xl font-semibold'
                        : block.type === 'code'
                          ? 'min-h-[7rem] font-mono text-sm'
                          : 'min-h-[3.5rem]'
                    }`}
                    value={block.text}
                    disabled={!canEdit || conn !== 'online'}
                    onChange={(event) =>
                      updateBlock(block.id, { text: event.target.value })
                    }
                    onSelect={(event) =>
                      setCursor(
                        block.id,
                        (event.target as HTMLTextAreaElement).selectionStart,
                      )
                    }
                  />
                )}

                {canEdit && conn === 'online' ? (
                  <div className="mt-1 flex flex-wrap gap-2 opacity-0 transition group-hover:opacity-100">
                    <span className="rounded-full border border-line px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted">
                      {block.type}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-danger"
                      onClick={() => removeBlock(block.id)}
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>

        {canEdit && conn === 'online' ? (
          <div className="mt-8 flex flex-wrap gap-2 border-t border-line pt-5">
            {BLOCK_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className="btn btn-ghost"
                onClick={() => addBlock(type as BlockType)}
              >
                + {type}
              </button>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
