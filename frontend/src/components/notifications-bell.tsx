'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { markNotificationReadAction } from '@/lib/actions';

type NotificationItem = {
  id: string;
  type: string;
  payload: {
    documentId?: string;
    workspaceId?: string;
    threadId?: string;
    blockId?: string;
  };
  readAt: string | null;
  createdAt: string;
};

export function NotificationsBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  async function reload() {
    const res = await fetch('/api/notifications', { cache: 'no-store' });
    if (!res.ok) return;
    setItems((await res.json()) as NotificationItem[]);
  }

  useEffect(() => {
    void reload();
    const timer = setInterval(() => void reload(), 15_000);
    return () => clearInterval(timer);
  }, []);

  const unread = items.filter((item) => !item.readAt).length;

  return (
    <div className="relative">
      <button
        type="button"
        className="btn btn-ghost !px-3"
        onClick={() => setOpen((value) => !value)}
      >
        Alerts{unread > 0 ? ` (${unread})` : ''}
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-2xl border border-line bg-bg-elevated p-3 shadow-lg">
          <p className="mb-2 text-sm font-semibold">Notifications</p>
          {items.length === 0 ? (
            <p className="empty text-sm">Nothing yet.</p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-auto">
              {items.slice(0, 20).map((item) => (
                <li
                  key={item.id}
                  className={`rounded-xl px-3 py-2 text-sm ${
                    item.readAt ? 'text-muted' : 'bg-white/70'
                  }`}
                >
                  <p className="font-medium">{item.type}</p>
                  <p className="text-xs text-muted">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                  <div className="mt-2 flex gap-2">
                    {item.payload.documentId && item.payload.workspaceId ? (
                      <Link
                        className="text-xs font-semibold text-accent"
                        href={`/app/w/${item.payload.workspaceId}/d/${item.payload.documentId}`}
                        onClick={() => setOpen(false)}
                      >
                        Open page
                      </Link>
                    ) : null}
                    {!item.readAt ? (
                      <button
                        type="button"
                        className="text-xs text-muted"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            await markNotificationReadAction(item.id);
                            await reload();
                          })
                        }
                      >
                        Mark read
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
