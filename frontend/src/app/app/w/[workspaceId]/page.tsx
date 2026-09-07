import { Suspense } from 'react';
import { DocumentTree } from '@/components/document-tree';
import { serverApi } from '@/lib/server-api';
import { getCachedWorkspaceTree } from '@/lib/workspace-tree';
import type { AuthUser, WorkspaceDetail } from '@/lib/types';
type Props = {
	params: Promise<{
		workspaceId: string;
	}>;
};
function StatsSkeleton() {
	return (
		<div className="mx-auto max-w-5xl panel empty p-4 text-[13px] text-muted">
			Loading workspace…
		</div>
	);
}
function DocsSkeleton() {
	return (
		<div className="mx-auto max-w-5xl panel empty p-4 text-[13px] text-muted">
			Loading documents…
		</div>
	);
}
async function WorkspaceStats({ workspaceId }: { workspaceId: string }) {
	try {
		const workspace = await serverApi<WorkspaceDetail>(`/workspaces/${workspaceId}`);
		return (
			<section className="mx-auto max-w-5xl panel p-4">
				<p className="text-[11px] uppercase tracking-wide text-muted">Overview</p>
				<h1 className="mt-0.5 truncate text-sm font-semibold">{workspace.name}</h1>
				<p className="mt-1 text-[13px] text-muted">
					{workspace.plan} · {workspace.members.length} member
					{workspace.members.length === 1 ? '' : 's'}
					{workspace.myRole ? ` · ${workspace.myRole}` : ''}
				</p>
			</section>
		);
	} catch (error) {
		return (
			<div className="mx-auto max-w-5xl panel p-4">
				<p className="error">
					{error instanceof Error ? error.message : 'Workspace unavailable'}
				</p>
			</div>
		);
	}
}
async function WorkspaceMain({ workspaceId }: { workspaceId: string }) {
	try {
		const [workspace, documents, me] = await Promise.all([
			serverApi<WorkspaceDetail>(`/workspaces/${workspaceId}`),
			getCachedWorkspaceTree(workspaceId),
			serverApi<AuthUser>('/auth/me'),
		]);
		return <DocumentTree workspace={workspace} documents={documents} currentUserId={me.id} />;
	} catch (error) {
		return (
			<div className="mx-auto max-w-5xl panel p-4">
				<p className="error">
					{error instanceof Error ? error.message : 'Workspace unavailable'}
				</p>
			</div>
		);
	}
}
export default async function WorkspacePage({ params }: Props) {
	const { workspaceId } = await params;
	return (
		<div className="space-y-3">
			<Suspense fallback={<StatsSkeleton />}>
				<WorkspaceStats workspaceId={workspaceId} />
			</Suspense>
			<Suspense fallback={<DocsSkeleton />}>
				<WorkspaceMain workspaceId={workspaceId} />
			</Suspense>
		</div>
	);
}
