'use client';

import Link from 'next/link';
import { useState } from 'react';
import { DocumentAccessPanel } from '@/components/document-access-panel';
import { BlockComments } from '@/components/block-comments';
import { RemoteCaretField } from '@/components/remote-caret-field';
import { VersionHistoryPanel } from '@/components/version-history-panel';
import { useToast } from '@/components/toast-provider';
import { confirmAssetAction, presignAssetAction } from '@/lib/actions';
import { BLOCK_TYPES, type BlockType } from '@/lib/blocks';
import { connectionStatusLabel, messageFromUnknown } from '@/lib/errors';
import { useCollabDoc } from '@/hooks/use-collab-doc';
import type { DocumentDetail, WorkspaceMember } from '@/lib/types';

async function uploadImageFile(
  workspaceId: string,
  documentId: string,
  file: File,
): Promise<string> {
  const presign = await presignAssetAction(workspaceId, {
    mimeType: file.type || 'image/png',
    sizeBytes: file.size,
    documentId,
  });
  if (!presign.ok) {
    throw new Error(presign.error);
  }

  const put = await fetch(presign.data.uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
  });
  if (!put.ok) {
    throw new Error('Upload to storage failed');
  }

  const confirmed = await confirmAssetAction(workspaceId, {
    objectKey: presign.data.objectKey,
    mimeType: file.type || 'image/png',
    sizeBytes: file.size,
    documentId,
  });
  if (!confirmed.ok) {
    throw new Error(confirmed.error);
  }
  return confirmed.data.url;
}

function ImageBlockFields({
  workspaceId,
  documentId,
  src,
  text,
  canUpload,
  onSrcChange,
}: {
  workspaceId: string;
  documentId: string;
  src?: string;
  text: string;
  canUpload: boolean;
  onSrcChange: (src: string) => void;
}) {
  const { show } = useToast();
  const [uploading, setUploading] = useState(false);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !canUpload) return;
    setUploading(true);
    try {
      const url = await uploadImageFile(workspaceId, documentId, file);
      onSrcChange(url);
      show('Image uploaded', 'success');
    } catch (error) {
      show(messageFromUnknown(error, 'Upload failed'), 'error');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        className="field"
        placeholder="Image URL"
        value={src ?? ''}
        disabled={!canUpload}
        onChange={(event) => onSrcChange(event.target.value)}
      />
      {canUpload ? (
        <label className="btn btn-ghost inline-flex cursor-pointer items-center">
          {uploading ? 'Uploading…' : 'Upload'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            disabled={uploading}
            onChange={onFileChange}
          />
        </label>
      ) : null}
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={text || ''} className="max-h-64 rounded-md" />
      ) : null}
    </div>
  );
}

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
    localUserId,
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

  const status = connectionStatusLabel({ conn, browserOnline });
  const editable = canEdit && conn === 'online' && browserOnline;
  const others = presence.filter((user) => user.userId !== localUserId);
  const statusClass =
    status.tone === 'warn'
      ? 'text-sm font-medium text-[#a16207]'
      : status.tone === 'muted'
        ? 'text-sm font-medium text-muted'
        : 'text-sm font-medium';

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
          <p className={statusClass}>{status.label}</p>
          {!canEdit && conn === 'online' ? (
            <p className="mt-0.5 text-[12px] text-muted">View only</p>
          ) : null}
        </div>
        <div>
          <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted">
            Present
          </p>
          {others.length === 0 ? (
            <p className="empty">Just you</p>
          ) : (
            <ul className="space-y-1">
              {others.map((user) => (
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
        <VersionHistoryPanel
          documentId={documentId}
          workspaceId={workspaceId}
          canEdit={canEdit}
        />
        {showAccessPanel ? (
          <DocumentAccessPanel
            workspaceId={workspaceId}
            documentId={documentId}
            initial={accessMeta}
            members={members}
            liveReady={conn === 'online' && browserOnline}
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
          disabled={!editable}
          onChange={(event) => updateTitle(event.target.value)}
          placeholder="Untitled"
        />

        <div className="mt-5 space-y-3">
          {blocks.length === 0 ? (
            <p className="empty">No blocks yet.</p>
          ) : (
            blocks.map((block) => (
              <div key={block.id} className="group relative">
                {block.type === 'checkbox' ? (
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1.5"
                      checked={!!block.checked}
                      disabled={!editable}
                      onChange={(event) =>
                        updateBlock(block.id, {
                          checked: event.target.checked,
                        })
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <RemoteCaretField
                        blockId={block.id}
                        className="field min-h-[2.25rem] resize-y"
                        value={block.text}
                        disabled={!editable}
                        remoteUsers={others}
                        onCursor={setCursor}
                        onChange={(event) =>
                          updateBlock(block.id, { text: event.target.value })
                        }
                      />
                    </div>
                  </label>
                ) : block.type === 'image' ? (
                  <ImageBlockFields
                    workspaceId={workspaceId}
                    documentId={documentId}
                    src={block.src}
                    text={block.text}
                    canUpload={editable}
                    onSrcChange={(next) =>
                      updateBlock(block.id, { src: next })
                    }
                  />
                ) : block.type === 'list' ? (
                  <RemoteCaretField
                    blockId={block.id}
                    className="field min-h-[4rem] resize-y font-mono text-[13px]"
                    value={(block.items ?? ['']).join('\n')}
                    disabled={!editable}
                    placeholder="One item per line"
                    remoteUsers={others}
                    onCursor={setCursor}
                    onChange={(event) =>
                      updateBlock(block.id, {
                        items: event.target.value.split('\n'),
                        text: event.target.value,
                      })
                    }
                  />
                ) : (
                  <RemoteCaretField
                    blockId={block.id}
                    className={`field resize-y ${
                      block.type === 'heading'
                        ? 'min-h-[2.5rem] text-base font-semibold'
                        : block.type === 'code'
                          ? 'min-h-[6rem] font-mono text-[13px]'
                          : 'min-h-[2.75rem]'
                    }`}
                    value={block.text}
                    disabled={!editable}
                    remoteUsers={others}
                    onCursor={setCursor}
                    onChange={(event) =>
                      updateBlock(block.id, { text: event.target.value })
                    }
                  />
                )}

                {editable ? (
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
                  canComment={editable}
                  mentionHints={members.map(
                    (member) => member.user.displayName,
                  )}
                />
              </div>
            ))
          )}
        </div>

        {editable ? (
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
