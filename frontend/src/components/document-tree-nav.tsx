'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createDocumentAction, moveDocumentAction } from '@/lib/actions';
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
		return <p className="empty mt-3">No documents yet.</p>;
	}
	function runMove(
		documentId: string,
		input: {
			parentId: string | null;
			rank?: string;
		},
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
				depth === 0 ? 'mt-3 space-y-0.5' : 'ml-3 space-y-0.5 border-l border-line pl-2'
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
						onDragLeave={() => setDragOverId((id) => (id === node.id ? null : id))}
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
						className={`group flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-neutral-50 ${dragOverId === node.id ? 'bg-neutral-100 ring-1 ring-line' : ''}`}
					>
						<Link
							href={`/app/w/${workspaceId}/d/${node.id}`}
							className="min-w-0 flex-1 truncate text-[13px] font-medium"
						>
							{node.title}
						</Link>
						<div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
							{canEdit ? (
								<>
									<form
										action={createDocumentAction.bind(null, workspaceId)}
										className="inline"
									>
										<input type="hidden" name="parentId" value={node.id} />
										<input type="hidden" name="title" value="Untitled" />
										<button
											type="submit"
											className="rounded px-1 text-[11px] text-muted hover:bg-white hover:text-ink"
											title="Add nested page"
											disabled={pending}
										>
											+
										</button>
									</form>
									<button
										type="button"
										className="rounded px-1 text-[11px] text-muted hover:bg-white"
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
										className="rounded px-1 text-[11px] text-muted hover:bg-white"
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
											className="rounded px-1 text-[11px] text-muted hover:bg-white"
											title="Move to root"
											disabled={pending}
											onClick={() => runMove(node.id, { parentId: null })}
										>
											↖
										</button>
									) : null}
								</>
							) : null}
							{node.publicationStatus === 'PUBLISHED' ? (
								<span className="text-[10px] uppercase tracking-wide text-muted">
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
		<div>
			{canEdit ? (
				<p className="mt-3 text-[12px] text-muted">
					Nested pages like Notion: drag onto a page, or use + / parent in New page. ↑↓
					reorder · ↖ un-nest.
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
