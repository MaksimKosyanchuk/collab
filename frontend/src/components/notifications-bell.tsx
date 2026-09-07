'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import {
	markNotificationReadAction,
	respondDocumentShareInviteAction,
	respondWorkspaceInviteAction,
} from '@/lib/actions';

type NotificationItem = {
	id: string;
	type: string;
	payload: {
		documentId?: string;
		documentTitle?: string;
		workspaceId?: string;
		workspaceName?: string;
		threadId?: string;
		blockId?: string;
		invitationId?: string;
		role?: string;
		access?: string;
		invitedByName?: string;
	};
	readAt: string | null;
	createdAt: string;
};

function labelFor(item: NotificationItem) {
	if (item.type === 'INVITE') {
		const workspace = item.payload.workspaceName ?? 'a workspace';
		const by = item.payload.invitedByName;
		const role = item.payload.role ? ` as ${item.payload.role}` : '';
		return by ? `${by} invited you to ${workspace}${role}` : `Invite to ${workspace}${role}`;
	}
	if (item.type === 'DOCUMENT_SHARED') {
		const title = item.payload.documentTitle ?? 'a page';
		const by = item.payload.invitedByName;
		const access = item.payload.access ? ` (${item.payload.access})` : '';
		return by ? `${by} shared “${title}” with you${access}` : `Shared page “${title}”${access}`;
	}
	if (item.type === 'MENTION') {
		return 'You were mentioned in a comment';
	}
	return item.type;
}

export function NotificationsBell() {
	const router = useRouter();
	const [items, setItems] = useState<NotificationItem[]>([]);
	const [open, setOpen] = useState(false);
	const [pending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

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

	function respondWorkspace(item: NotificationItem, action: 'accept' | 'decline') {
		const invitationId = item.payload.invitationId;
		if (!invitationId) return;
		setError(null);
		startTransition(async () => {
			const result = await respondWorkspaceInviteAction(invitationId, action);
			if (!result.ok) {
				setError(result.error);
				return;
			}
			await markNotificationReadAction(item.id);
			await reload();
			if (action === 'accept') {
				setOpen(false);
				router.push(`/app/w/${result.data.workspaceId}`);
				router.refresh();
			}
		});
	}

	function respondShare(item: NotificationItem, action: 'accept' | 'decline') {
		const invitationId = item.payload.invitationId;
		if (!invitationId) return;
		setError(null);
		startTransition(async () => {
			const result = await respondDocumentShareInviteAction(invitationId, action);
			if (!result.ok) {
				setError(result.error);
				return;
			}
			await markNotificationReadAction(item.id);
			await reload();
			if (action === 'accept') {
				setOpen(false);
				router.push(`/app/w/${result.data.workspaceId}/d/${result.data.documentId}`);
				router.refresh();
			}
		});
	}

	return (
		<div className="relative">
			<button
				type="button"
				className="btn btn-ghost !px-2.5"
				onClick={() => setOpen((value) => !value)}
			>
				Alerts{unread > 0 ? ` (${unread})` : ''}
			</button>
			{open ? (
				<div className="absolute right-0 z-20 mt-1.5 w-80 rounded-md border border-line bg-bg-elevated p-2 shadow-sm">
					<p className="mb-1.5 px-1 text-[13px] font-semibold">Notifications</p>
					{error ? <p className="error mb-2 px-1">{error}</p> : null}
					{items.length === 0 ? (
						<p className="empty px-1 text-[13px]">Nothing yet.</p>
					) : (
						<ul className="max-h-80 space-y-1 overflow-auto">
							{items.slice(0, 20).map((item) => (
								<li
									key={item.id}
									className={`rounded-md px-2 py-1.5 text-[13px] ${
										item.readAt ? 'text-muted' : 'bg-neutral-50'
									}`}
								>
									<p className="font-medium">{labelFor(item)}</p>
									<p className="text-[11px] text-muted">
										{new Date(item.createdAt).toLocaleString()}
									</p>
									<div className="mt-1.5 flex flex-wrap gap-2">
										{item.type === 'INVITE' &&
										item.payload.invitationId &&
										!item.readAt ? (
											<>
												<button
													type="button"
													className="text-[12px] font-medium text-accent"
													disabled={pending}
													onClick={() => respondWorkspace(item, 'accept')}
												>
													Accept
												</button>
												<button
													type="button"
													className="text-[12px] text-muted"
													disabled={pending}
													onClick={() =>
														respondWorkspace(item, 'decline')
													}
												>
													Decline
												</button>
											</>
										) : null}
										{item.type === 'DOCUMENT_SHARED' &&
										item.payload.invitationId &&
										!item.readAt ? (
											<>
												<button
													type="button"
													className="text-[12px] font-medium text-accent"
													disabled={pending}
													onClick={() => respondShare(item, 'accept')}
												>
													Accept
												</button>
												<button
													type="button"
													className="text-[12px] text-muted"
													disabled={pending}
													onClick={() => respondShare(item, 'decline')}
												>
													Decline
												</button>
											</>
										) : null}
										{item.type !== 'DOCUMENT_SHARED' &&
										item.payload.documentId &&
										item.payload.workspaceId ? (
											<Link
												className="text-[12px] font-medium text-accent"
												href={`/app/w/${item.payload.workspaceId}/d/${item.payload.documentId}`}
												onClick={() => setOpen(false)}
											>
												Open page
											</Link>
										) : null}
										{!item.readAt &&
										item.type !== 'INVITE' &&
										item.type !== 'DOCUMENT_SHARED' ? (
											<button
												type="button"
												className="text-[12px] text-muted"
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
