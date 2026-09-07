'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  createPublicLinkAction,
  publishDocumentAction,
  shareDocumentAction,
} from '@/lib/actions';
import type {
  DocumentAccess,
  DocumentDetail,
  WorkspaceMember,
} from '@/lib/types';

const ACCESS_EDIT = 2;
const ACCESS_MANAGE = 3;

function appOrigin() {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

export function DocumentAccessPanel({
  workspaceId,
  documentId,
  initial,
  members,
}: {
  workspaceId: string;
  documentId: string;
  initial: DocumentDetail;
  members: WorkspaceMember[];
}) {
  const [doc, setDoc] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [shareUserId, setShareUserId] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [shareAccess, setShareAccess] = useState<DocumentAccess>('VIEW');
  const [linkAccess, setLinkAccess] = useState<DocumentAccess>('VIEW');
  const [freshLink, setFreshLink] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canEdit = doc.access >= ACCESS_EDIT;
  const canManage = doc.access >= ACCESS_MANAGE;
  const published = doc.publicationStatus === 'PUBLISHED';
  const publicUrl = doc.publicSlug
    ? `${appOrigin()}/p/${doc.publicSlug}`
    : null;

  const shareCandidates = useMemo(
    () =>
      members.filter(
        (member) =>
          !doc.shares.some((share) => share.userId === member.userId),
      ),
    [members, doc.shares],
  );

  function run(task: () => Promise<void>) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await task();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      }
    });
  }

  return (
    <div className="space-y-5 border-t border-line pt-4">
      <div>
        <p className="text-sm text-muted">Publish</p>
        {published && publicUrl ? (
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block truncate text-sm font-medium text-accent underline-offset-2 hover:underline"
          >
            {publicUrl}
          </a>
        ) : (
          <p className="mt-1 text-sm text-muted">Not on the public web yet.</p>
        )}
        {canEdit ? (
          <button
            type="button"
            className={`btn mt-3 w-full ${published ? 'btn-ghost' : 'btn-primary'}`}
            disabled={pending}
            onClick={() =>
              run(async () => {
                const result = await publishDocumentAction(
                  documentId,
                  workspaceId,
                  !published,
                );
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setDoc(result.data);
                setMessage(
                  result.data.publicationStatus === 'PUBLISHED'
                    ? 'Published. Public page will refresh shortly.'
                    : 'Unpublished.',
                );
              })
            }
          >
            {published ? 'Unpublish' : 'Publish page'}
          </button>
        ) : null}
      </div>

      {canManage ? (
        <>
          <div>
            <p className="text-sm text-muted">Share with person</p>
            <div className="mt-2 space-y-2">
              {shareCandidates.length > 0 ? (
                <select
                  className="field"
                  value={shareUserId}
                  onChange={(event) => {
                    setShareUserId(event.target.value);
                    setShareEmail('');
                  }}
                >
                  <option value="">Workspace member…</option>
                  {shareCandidates.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.user.displayName} ({member.user.email})
                    </option>
                  ))}
                </select>
              ) : null}
              <input
                className="field"
                type="email"
                placeholder="Or email of registered user"
                value={shareEmail}
                onChange={(event) => {
                  setShareEmail(event.target.value);
                  setShareUserId('');
                }}
              />
              <select
                className="field"
                value={shareAccess}
                onChange={(event) =>
                  setShareAccess(event.target.value as DocumentAccess)
                }
              >
                <option value="VIEW">Can view</option>
                <option value="EDIT">Can edit</option>
              </select>
              <button
                type="button"
                className="btn btn-ghost w-full"
                disabled={pending || (!shareUserId && !shareEmail.trim())}
                onClick={() =>
                  run(async () => {
                    const result = await shareDocumentAction(
                      documentId,
                      workspaceId,
                      {
                        access: shareAccess,
                        ...(shareUserId
                          ? { userId: shareUserId }
                          : { email: shareEmail.trim() }),
                      },
                    );
                    if (!result.ok) {
                      setError(result.error);
                      return;
                    }
                    setDoc((prev) => {
                      const others = prev.shares.filter(
                        (share) => share.userId !== result.data.userId,
                      );
                      return {
                        ...prev,
                        shares: [...others, result.data],
                      };
                    });
                    setShareUserId('');
                    setShareEmail('');
                    setMessage(`Shared with ${result.data.user.displayName}.`);
                  })
                }
              >
                Add share
              </button>
            </div>
            {doc.shares.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {doc.shares.map((share) => (
                  <li
                    key={share.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="truncate">
                      {share.user.displayName}
                      <span className="text-muted"> · {share.user.email}</span>
                    </span>
                    <span className="shrink-0 text-xs uppercase tracking-wide text-muted">
                      {share.access}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">No direct shares yet.</p>
            )}
          </div>

          <div>
            <p className="text-sm text-muted">Link access</p>
            <p className="mt-1 text-xs text-muted">
              Anyone with the URL can open it (no login). Access is view or edit
              by link type — separate from `/p/…` publish.
            </p>
            <select
              className="field mt-2"
              value={linkAccess}
              onChange={(event) =>
                setLinkAccess(event.target.value as DocumentAccess)
              }
            >
              <option value="VIEW">View link</option>
              <option value="EDIT">Edit link</option>
            </select>
            <button
              type="button"
              className="btn btn-ghost mt-2 w-full"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const result = await createPublicLinkAction(
                    documentId,
                    workspaceId,
                    { access: linkAccess },
                  );
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  const shareUrl = `${appOrigin()}/s/${documentId}?t=${encodeURIComponent(result.data.token)}`;
                  setFreshLink(shareUrl);
                  setDoc((prev) => ({
                    ...prev,
                    publicLinks: [
                      {
                        id: result.data.id,
                        tokenPrefix: result.data.token.slice(0, 8),
                        access: result.data.access,
                        expiresAt: result.data.expiresAt,
                        createdAt: new Date().toISOString(),
                      },
                      ...prev.publicLinks,
                    ],
                  }));
                  setMessage(
                    `Share link ready (${linkAccess}). Copy once — the secret is in the URL.`,
                  );
                })
              }
            >
              Create link
            </button>
            {freshLink ? (
              <div className="mt-3 rounded-xl border border-line bg-white/70 p-3">
                <p className="text-xs text-muted">Share URL (shown once)</p>
                <a
                  href={freshLink}
                  className="mt-1 block break-all text-xs font-medium text-accent underline-offset-2 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {freshLink}
                </a>
                <button
                  type="button"
                  className="btn btn-ghost mt-2 w-full"
                  onClick={async () => {
                    await navigator.clipboard.writeText(freshLink);
                    setMessage('Link copied.');
                  }}
                >
                  Copy link
                </button>
              </div>
            ) : null}
            {doc.publicLinks.length > 0 ? (
              <ul className="mt-3 space-y-1 text-sm text-muted">
                {doc.publicLinks.map((link) => (
                  <li key={link.id}>
                    {link.tokenPrefix}… · {link.access}
                    {link.expiresAt
                      ? ` · expires ${new Date(link.expiresAt).toLocaleDateString()}`
                      : ''}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </>
      ) : null}

      {message ? <p className="text-sm text-accent">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
