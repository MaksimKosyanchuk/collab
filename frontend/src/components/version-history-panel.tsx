'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createSnapshotAction,
  listVersionsAction,
  restoreVersionAction,
} from '@/lib/actions';
import { useToast } from '@/components/toast-provider';
import { messageFromUnknown } from '@/lib/errors';
import type { DocumentVersion } from '@/lib/types';

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function VersionHistoryPanel({
  documentId,
  workspaceId,
  canEdit,
}: {
  documentId: string;
  workspaceId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    startTransition(async () => {
      try {
        const result = await listVersionsAction(documentId);
        if (!result.ok) {
          show(result.error, 'error');
          return;
        }
        setVersions(result.data);
      } catch (error) {
        show(messageFromUnknown(error, 'Failed to load versions'), 'error');
      } finally {
        setLoading(false);
      }
    });
  }, [documentId, show]);

  useEffect(() => {
    if (canEdit) load();
  }, [canEdit, load]);

  if (!canEdit) return null;

  function snapshot() {
    startTransition(async () => {
      const result = await createSnapshotAction(documentId, workspaceId);
      if (!result.ok) {
        show(result.error, 'error');
        return;
      }
      show('Snapshot saved', 'success');
      load();
    });
  }

  function restore(versionId: string) {
    startTransition(async () => {
      const result = await restoreVersionAction(
        documentId,
        workspaceId,
        versionId,
      );
      if (!result.ok) {
        show(result.error, 'error');
        return;
      }
      show('Version restored', 'success');
      router.refresh();
      load();
    });
  }

  return (
    <div className="space-y-2 border-t border-line pt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wide text-muted">
          History
        </p>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={pending}
          onClick={snapshot}
        >
          Snapshot
        </button>
      </div>
      {loading ? <p className="text-[12px] text-muted">Loading…</p> : null}
      {!loading && versions.length === 0 ? (
        <p className="empty">No versions yet</p>
      ) : null}
      <ul className="max-h-48 space-y-1.5 overflow-y-auto">
        {versions.map((version) => (
          <li
            key={version.id}
            className="rounded-md border border-line px-2 py-1.5"
          >
            <p className="truncate text-[13px] font-medium">
              {version.title || 'Untitled'}
            </p>
            <p className="text-[11px] text-muted">
              {version.trigger} · {formatWhen(version.createdAt)}
            </p>
            <button
              type="button"
              className="mt-1 text-[12px] text-muted hover:text-ink"
              disabled={pending}
              onClick={() => restore(version.id)}
            >
              Restore
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
