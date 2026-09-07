'use client';

import { useEffect, useState, useTransition } from 'react';
import {
	addCommentAction,
	createCommentThreadAction,
	resolveCommentThreadAction,
} from '@/lib/actions';

type CommentAuthor = { id: string; displayName: string };
type Comment = {
	id: string;
	body: string;
	createdAt: string;
	author: CommentAuthor;
};
type Thread = {
	id: string;
	blockId: string;
	resolvedAt: string | null;
	comments: Comment[];
};

export function BlockComments({
	documentId,
	blockId,
	canComment,
	mentionHints,
}: {
	documentId: string;
	blockId: string;
	canComment: boolean;
	mentionHints: string[];
}) {
	const [threads, setThreads] = useState<Thread[]>([]);
	const [body, setBody] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();
	const [open, setOpen] = useState(false);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const res = await fetch(`/api/comments?documentId=${documentId}`, {
					cache: 'no-store',
				});
				if (!res.ok) return;
				const all = (await res.json()) as Thread[];
				if (!cancelled) {
					setThreads(all.filter((thread) => thread.blockId === blockId));
				}
			} catch {
				// ignore
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [documentId, blockId]);

	const openThreads = threads.filter((thread) => !thread.resolvedAt);

	return (
		<div className="mt-1">
			<button
				type="button"
				className="text-xs text-muted hover:text-ink"
				onClick={() => setOpen((value) => !value)}
			>
				{openThreads.length > 0
					? `${openThreads.length} comment${openThreads.length === 1 ? '' : 's'}`
					: 'Comment'}
			</button>
			{open ? (
				<div className="mt-2 space-y-3 rounded-xl border border-line bg-white/70 p-3">
					{threads.length === 0 ? (
						<p className="text-xs text-muted">No threads on this block.</p>
					) : (
						threads.map((thread) => (
							<div
								key={thread.id}
								className="space-y-2 border-b border-line pb-2 last:border-0"
							>
								{thread.comments.map((comment) => (
									<p key={comment.id} className="text-sm">
										<span className="font-medium">
											{comment.author.displayName}
										</span>
										<span className="text-muted"> · </span>
										{comment.body}
									</p>
								))}
								{canComment && !thread.resolvedAt ? (
									<div className="flex gap-2">
										<input
											className="field !py-1.5 text-sm"
											placeholder="Reply… use @Name"
											id={`reply-${thread.id}`}
											onKeyDown={(event) => {
												if (event.key !== 'Enter') return;
												const input = event.currentTarget;
												const value = input.value.trim();
												if (!value) return;
												startTransition(async () => {
													const result = await addCommentAction(
														thread.id,
														value,
													);
													if (!result.ok) {
														setError(result.error);
														return;
													}
													input.value = '';
													const res = await fetch(
														`/api/comments?documentId=${documentId}`,
														{ cache: 'no-store' },
													);
													if (res.ok) {
														const all = (await res.json()) as Thread[];
														setThreads(
															all.filter(
																(row) => row.blockId === blockId,
															),
														);
													}
												});
											}}
										/>
										<button
											type="button"
											className="btn btn-ghost !px-3 !py-1.5 text-xs"
											disabled={pending}
											onClick={() =>
												startTransition(async () => {
													await resolveCommentThreadAction(thread.id);
													setThreads((prev) =>
														prev.map((row) =>
															row.id === thread.id
																? {
																		...row,
																		resolvedAt:
																			new Date().toISOString(),
																	}
																: row,
														),
													);
												})
											}
										>
											Resolve
										</button>
									</div>
								) : null}
								{thread.resolvedAt ? (
									<p className="text-xs text-muted">Resolved</p>
								) : null}
							</div>
						))
					)}
					{canComment ? (
						<div className="space-y-2">
							<textarea
								className="field min-h-16 text-sm"
								placeholder={
									mentionHints.length
										? `New thread… try @${mentionHints[0]}`
										: 'New thread… @mention by display name'
								}
								value={body}
								onChange={(event) => setBody(event.target.value)}
							/>
							<button
								type="button"
								className="btn btn-ghost w-full !py-1.5 text-sm"
								disabled={pending || !body.trim()}
								onClick={() =>
									startTransition(async () => {
										setError(null);
										const result = await createCommentThreadAction(documentId, {
											blockId,
											body: body.trim(),
										});
										if (!result.ok) {
											setError(result.error);
											return;
										}
										setBody('');
										const res = await fetch(
											`/api/comments?documentId=${documentId}`,
											{ cache: 'no-store' },
										);
										if (res.ok) {
											const all = (await res.json()) as Thread[];
											setThreads(
												all.filter((row) => row.blockId === blockId),
											);
										}
									})
								}
							>
								Start thread
							</button>
						</div>
					) : null}
					{error ? <p className="error text-xs">{error}</p> : null}
				</div>
			) : null}
		</div>
	);
}
