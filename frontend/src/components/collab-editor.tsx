'use client';

import Link from 'next/link';
import { DocumentAccessPanel } from '@/components/document-access-panel';
import { BlockComments } from '@/components/block-comments';
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
      <div className="panel p-5">
        <h1 className="text-base font-semibold">Document deleted</h1>
        <p className="mt-1 text-[13px] text-muted">
          This page was removed while you were connected.
        </p>
        <Link href={`/app/w/${workspaceId}`} className="btn btn-primary mt-4">
          Back to workspace
        </Link>
      </div>
    );
  }

  if (conn === 'revoked') {
    return (
      <div className="panel p-5">
        <h1 className="text-base font-semibold">Access revoked</h1>
        <p className="mt-1 text-[13px] text-muted">
          Your permission to this page was removed.
        </p>
        <Link href="/app" className="btn btn-primary mt-4">
          Back to app
        </Link>
      </div>
    );
  }

  const statusLabel = !browserOnline
    ? 'Offline'
    : conn === 'online'
      ? 'Live'
      : conn === 'connecting'
        ? 'Connecting…'
        : 'Reconnecting…';

  return (
    <div className="grid gap-3 lg:grid-cols-[220px_1fr]">
      <aside className="panel space-y-3 p-3">
        <Link
          href={showAccessPanel ? `/app/w/${workspaceId}` : '/app'}
          className="text-[13px] text-muted hover:text-ink"
        >
          ← {showAccessPanel ? 'Documents' : 'App'}
        </Link>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted">
            Status
          </p>
          <p className="text-sm font-medium">{statusLabel}</p>
          {!canEdit && conn === 'online' ? (
            <p className="mt-0.5 text-[12px] text-muted">View only</p>
          ) : null}
        </div>
        <div>
          <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted">
            Present
          </p>
          {presence.length === 0 ? (
            <p className="empty">Just you</p>
          ) : (
            <ul className="space-y-1">
              {presence.map((user) => (
                <li
                  key={user.userId}
                  className="flex items-center gap-2 text-[13px]"
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: user.color }}
                  />
                  <span className="truncate">{user.displayName}</span>
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
          <p className="border-t border-line pt-3 text-[12px] text-muted">
            Access via share link
          </p>
        )}
      </aside>

      <section className="panel min-h-[24rem] p-4 md:p-5">
        <input
          className="w-full border-0 bg-transparent text-xl font-semibold tracking-tight outline-none placeholder:text-neutral-400"
          value={title}
          disabled={!canEdit || conn !== 'online'}
          onChange={(event) => updateTitle(event.target.value)}
          placeholder="Untitled"
        />

        <div className="mt-5 space-y-3">
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
                      className="mb-1 mr-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] text-white"
                      style={{ background: user.color }}
                    >
                      {user.displayName}
                    </span>
                  ))}

                {block.type === 'checkbox' ? (
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1.5"
                      checked={!!block.checked}
                      disabled={!canEdit || conn !== 'online'}
                      onChange={(event) =>
                        updateBlock(block.id, {
                          checked: event.target.checked,
                        })
                      }
                    />
                    <textarea
                      className="field min-h-[2.25rem] resize-y"
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
                        className="max-h-64 rounded-md"
                      />
                    ) : null}
                  </div>
                ) : block.type === 'list' ? (
                  <textarea
                    className="field min-h-[4rem] resize-y font-mono text-[13px]"
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
                        ? 'min-h-[2.5rem] text-base font-semibold'
                        : block.type === 'code'
                          ? 'min-h-[6rem] font-mono text-[13px]'
                          : 'min-h-[2.75rem]'
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
                    <span className="text-[11px] uppercase tracking-wide text-muted">
                      {block.type}
                    </span>
                    <button
                      type="button"
                      className="text-[12px] text-danger"
                      onClick={() => removeBlock(block.id)}
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
                <BlockComments
                  documentId={documentId}
                  blockId={block.id}
                  canComment={canEdit && conn === 'online'}
                  mentionHints={members.map(
                    (member) => member.user.displayName,
                  )}
                />
              </div>
            ))
          )}
        </div>

        {canEdit && conn === 'online' ? (
          <div className="mt-5 flex flex-wrap gap-1.5 border-t border-line pt-3">
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
