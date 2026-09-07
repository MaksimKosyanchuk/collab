'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath, revalidateTag } from 'next/cache';
import { ACCESS_COOKIE, REFRESH_COOKIE, apiFetch, safeNextPath } from './api';
import { serverApi } from './server-api';
import { workspaceTreeTag } from './cache-tags';
import type {
	AssetConfirm,
	AssetPresign,
	AuthTokens,
	DocumentAccess,
	DocumentDetail,
	DocumentShare,
	DocumentTreeItem,
	DocumentVersion,
	Workspace,
	WorkspaceRole,
} from './types';
function invalidateWorkspaceTree(workspaceId: string) {
	revalidateTag(workspaceTreeTag(workspaceId));
	revalidatePath(`/app/w/${workspaceId}`);
}
const cookieOpts = {
	httpOnly: true,
	sameSite: 'lax' as const,
	path: '/',
	secure: process.env.NODE_ENV === 'production',
};
async function setSession(tokens: AuthTokens) {
	const jar = await cookies();
	jar.set(ACCESS_COOKIE, tokens.accessToken, {
		...cookieOpts,
		maxAge: 60 * 15,
	});
	jar.set(REFRESH_COOKIE, tokens.refreshToken, {
		...cookieOpts,
		maxAge: 60 * 60 * 24 * 7,
	});
}
export async function registerAction(formData: FormData) {
	const email = String(formData.get('email') ?? '');
	const password = String(formData.get('password') ?? '');
	const displayName = String(formData.get('displayName') ?? '');
	const next = safeNextPath(String(formData.get('next') ?? '') || undefined);
	try {
		const tokens = await apiFetch<AuthTokens>('/auth/register', {
			method: 'POST',
			body: JSON.stringify({ email, password, displayName }),
		});
		await setSession(tokens);
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : 'Registration failed',
		};
	}
	redirect(next ?? '/app');
}
export async function loginAction(formData: FormData) {
	const email = String(formData.get('email') ?? '');
	const password = String(formData.get('password') ?? '');
	const next = safeNextPath(String(formData.get('next') ?? '') || undefined);
	try {
		const tokens = await apiFetch<AuthTokens>('/auth/login', {
			method: 'POST',
			body: JSON.stringify({ email, password }),
		});
		await setSession(tokens);
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : 'Login failed',
		};
	}
	redirect(next ?? '/app');
}
export async function logoutAction() {
	const jar = await cookies();
	const refresh = jar.get(REFRESH_COOKIE)?.value;
	try {
		if (refresh) {
			await apiFetch('/auth/logout', {
				method: 'POST',
				accessToken: jar.get(ACCESS_COOKIE)?.value,
				body: JSON.stringify({ refreshToken: refresh }),
			});
		}
	} catch {
		void 0;
	}
	jar.delete(ACCESS_COOKIE);
	jar.delete(REFRESH_COOKIE);
	redirect('/login');
}
export async function createWorkspaceAction(formData: FormData): Promise<void> {
	const name = String(formData.get('name') ?? '').trim();
	if (!name) {
		throw new Error('Name is required');
	}
	const workspace = await serverApi<Workspace>('/workspaces', {
		method: 'POST',
		body: JSON.stringify({ name }),
	});
	redirect(`/app/w/${workspace.id}`);
}
export async function createDocumentAction(workspaceId: string, formData: FormData): Promise<void> {
	const title = String(formData.get('title') ?? 'Untitled').trim() || 'Untitled';
	const parentId = String(formData.get('parentId') ?? '') || undefined;
	const doc = await serverApi<DocumentTreeItem>(`/workspaces/${workspaceId}/documents`, {
		method: 'POST',
		body: JSON.stringify({ title, parentId }),
	});
	invalidateWorkspaceTree(workspaceId);
	redirect(`/app/w/${workspaceId}/d/${doc.id}`);
}
type ActionResult<T> =
	| {
			ok: true;
			data: T;
	  }
	| {
			ok: false;
			error: string;
	  };
function actionError(error: unknown, fallback: string): ActionResult<never> {
	return {
		ok: false,
		error: error instanceof Error ? error.message : fallback,
	};
}
export async function publishDocumentAction(
	documentId: string,
	workspaceId: string,
	published: boolean,
): Promise<ActionResult<DocumentDetail>> {
	try {
		await serverApi(`/documents/${documentId}/publish`, {
			method: 'POST',
			body: JSON.stringify({ published }),
		});
		const data = await serverApi<DocumentDetail>(`/documents/${documentId}`);
		revalidatePath(`/app/w/${workspaceId}/d/${documentId}`);
		invalidateWorkspaceTree(workspaceId);
		if (data.publicSlug) {
			revalidatePath(`/p/${data.publicSlug}`);
			revalidateTag(`public-doc:${data.publicSlug}`);
		}
		return { ok: true, data };
	} catch (error) {
		return actionError(error, 'Publish failed');
	}
}
export async function shareDocumentAction(
	documentId: string,
	workspaceId: string,
	input: {
		email: string;
		access: DocumentAccess;
	},
): Promise<
	ActionResult<{
		status: 'invited';
		id: string;
		email: string;
		access: DocumentAccess;
		displayName: string;
		expiresAt: string;
	}>
> {
	try {
		const data = await serverApi<{
			status: 'invited';
			id: string;
			email: string;
			access: DocumentAccess;
			displayName: string;
			expiresAt: string;
		}>(`/documents/${documentId}/shares`, {
			method: 'POST',
			body: JSON.stringify(input),
		});
		revalidatePath(`/app/w/${workspaceId}/d/${documentId}`);
		return { ok: true, data };
	} catch (error) {
		return actionError(error, 'Share invite failed');
	}
}
export async function createPublicLinkAction(
	documentId: string,
	workspaceId: string,
	input: {
		access: DocumentAccess;
		expiresAt?: string;
	},
): Promise<
	ActionResult<{
		id: string;
		token: string;
		access: DocumentAccess;
		expiresAt: string | null;
	}>
> {
	try {
		const data = await serverApi<{
			id: string;
			token: string;
			access: DocumentAccess;
			expiresAt: string | null;
		}>(`/documents/${documentId}/public-links`, {
			method: 'POST',
			body: JSON.stringify(input),
		});
		revalidatePath(`/app/w/${workspaceId}/d/${documentId}`);
		return { ok: true, data };
	} catch (error) {
		return actionError(error, 'Public link failed');
	}
}
export async function inviteWorkspaceMemberAction(
	workspaceId: string,
	input: {
		email: string;
		role: Exclude<WorkspaceRole, 'OWNER'>;
	},
): Promise<
	ActionResult<{
		status: 'invited';
		email: string;
		role: Exclude<WorkspaceRole, 'OWNER'>;
		displayName: string;
		id: string;
	}>
> {
	try {
		const data = await serverApi<{
			status: 'invited';
			email: string;
			role: Exclude<WorkspaceRole, 'OWNER'>;
			displayName: string;
			id: string;
		}>(`/workspaces/${workspaceId}/invitations`, {
			method: 'POST',
			body: JSON.stringify(input),
		});
		revalidatePath(`/app/w/${workspaceId}`);
		revalidatePath('/app');
		return { ok: true, data };
	} catch (error) {
		return actionError(error, 'Invite failed');
	}
}
export async function renameWorkspaceAction(
	workspaceId: string,
	formData: FormData,
): Promise<ActionResult<Workspace>> {
	const name = String(formData.get('name') ?? '').trim();
	if (name.length < 2) {
		return { ok: false, error: 'Name must be at least 2 characters' };
	}
	try {
		const data = await serverApi<Workspace>(`/workspaces/${workspaceId}`, {
			method: 'PATCH',
			body: JSON.stringify({ name }),
		});
		revalidatePath(`/app/w/${workspaceId}`);
		revalidatePath('/app');
		return { ok: true, data };
	} catch (error) {
		return actionError(error, 'Rename failed');
	}
}
export async function updateWorkspaceMemberRoleAction(
	workspaceId: string,
	memberUserId: string,
	role: Exclude<WorkspaceRole, 'OWNER'>,
): Promise<
	ActionResult<{
		id: string;
		role: WorkspaceRole;
	}>
> {
	try {
		const data = await serverApi<{
			id: string;
			role: WorkspaceRole;
		}>(`/workspaces/${workspaceId}/members/${memberUserId}`, {
			method: 'PATCH',
			body: JSON.stringify({ role }),
		});
		revalidatePath(`/app/w/${workspaceId}`);
		return { ok: true, data };
	} catch (error) {
		return actionError(error, 'Role update failed');
	}
}
export async function removeWorkspaceMemberAction(
	workspaceId: string,
	memberUserId: string,
): Promise<
	ActionResult<{
		removed: true;
	}>
> {
	try {
		await serverApi(`/workspaces/${workspaceId}/members/${memberUserId}`, {
			method: 'DELETE',
		});
		revalidatePath(`/app/w/${workspaceId}`);
		return { ok: true, data: { removed: true } };
	} catch (error) {
		return actionError(error, 'Remove failed');
	}
}
export async function acceptWorkspaceInviteAction(token: string): Promise<
	ActionResult<{
		workspaceId: string;
		workspaceName: string;
		role: string;
	}>
> {
	try {
		const data = await serverApi<{
			workspaceId: string;
			workspaceName: string;
			role: string;
		}>('/workspaces/invitations/accept', {
			method: 'POST',
			body: JSON.stringify({ token }),
		});
		revalidatePath('/app');
		revalidatePath(`/app/w/${data.workspaceId}`);
		return { ok: true, data };
	} catch (error) {
		return actionError(error, 'Accept invite failed');
	}
}
export async function respondWorkspaceInviteAction(
	invitationId: string,
	action: 'accept' | 'decline',
): Promise<
	ActionResult<{
		status: 'accepted' | 'declined';
		workspaceId: string;
		workspaceName: string;
		role?: string;
	}>
> {
	try {
		const data = await serverApi<{
			status: 'accepted' | 'declined';
			workspaceId: string;
			workspaceName: string;
			role?: string;
		}>('/workspaces/invitations/respond', {
			method: 'POST',
			body: JSON.stringify({ invitationId, action }),
		});
		revalidatePath('/app');
		if (data.status === 'accepted') {
			revalidatePath(`/app/w/${data.workspaceId}`);
		}
		return { ok: true, data };
	} catch (error) {
		return actionError(
			error,
			action === 'accept' ? 'Accept invite failed' : 'Decline invite failed',
		);
	}
}
export async function changeWorkspacePlanAction(
	workspaceId: string,
	plan: 'FREE' | 'PRO' | 'TEAM',
): Promise<
	ActionResult<{
		plan: 'FREE' | 'PRO' | 'TEAM';
		duplicateWebhook?: boolean;
	}>
> {
	try {
		if (plan === 'FREE') {
			await serverApi('/billing/checkout', {
				method: 'POST',
				body: JSON.stringify({ workspaceId, plan }),
			});
			revalidatePath(`/app/w/${workspaceId}`);
			revalidatePath('/app');
			return { ok: true, data: { plan: 'FREE' } };
		}
		const session = await serverApi<{
			id: string;
			workspaceId: string;
			plan: 'FREE' | 'PRO' | 'TEAM';
			status: string;
		}>('/billing/checkout', {
			method: 'POST',
			body: JSON.stringify({ workspaceId, plan }),
		});
		const webhook = await serverApi<{
			duplicate: boolean;
			eventId: string;
		}>('/billing/webhook', {
			method: 'POST',
			body: JSON.stringify({
				id: `mock_${session.id}_${Date.now()}`,
				type: 'checkout.session.completed',
				data: {
					workspaceId,
					plan,
					checkoutSessionId: session.id,
				},
			}),
		});
		revalidatePath(`/app/w/${workspaceId}`);
		revalidatePath('/app');
		return {
			ok: true,
			data: { plan, duplicateWebhook: webhook.duplicate },
		};
	} catch (error) {
		return actionError(error, 'Plan change failed');
	}
}
export async function leaveWorkspaceAction(workspaceId: string): Promise<
	ActionResult<{
		left: true;
	}>
> {
	try {
		await serverApi(`/workspaces/${workspaceId}/leave`, { method: 'POST' });
		revalidatePath('/app');
		revalidatePath(`/app/w/${workspaceId}`);
		return { ok: true, data: { left: true } };
	} catch (error) {
		return actionError(error, 'Leave failed');
	}
}
export async function moveDocumentAction(
	workspaceId: string,
	documentId: string,
	input: {
		parentId?: string | null;
		rank?: string;
	},
): Promise<
	ActionResult<{
		id: string;
	}>
> {
	try {
		const data = await serverApi<{
			id: string;
		}>(`/documents/${documentId}/move`, {
			method: 'POST',
			body: JSON.stringify(input),
		});
		invalidateWorkspaceTree(workspaceId);
		return { ok: true, data };
	} catch (error) {
		return actionError(error, 'Move failed');
	}
}
export async function unshareDocumentAction(
	workspaceId: string,
	documentId: string,
	shareUserId: string,
): Promise<
	ActionResult<{
		removed: true;
	}>
> {
	try {
		await serverApi(`/documents/${documentId}/shares/${shareUserId}`, {
			method: 'DELETE',
		});
		revalidatePath(`/app/w/${workspaceId}/d/${documentId}`);
		return { ok: true, data: { removed: true } };
	} catch (error) {
		return actionError(error, 'Unshare failed');
	}
}
export async function updateDocumentShareAccessAction(
	workspaceId: string,
	documentId: string,
	input: {
		userId: string;
		access: DocumentAccess;
	},
): Promise<ActionResult<DocumentShare>> {
	try {
		const data = await serverApi<DocumentShare>(
			`/documents/${documentId}/shares/${input.userId}`,
			{
				method: 'PATCH',
				body: JSON.stringify({ access: input.access }),
			},
		);
		revalidatePath(`/app/w/${workspaceId}/d/${documentId}`);
		return { ok: true, data };
	} catch (error) {
		return actionError(error, 'Update share failed');
	}
}
export async function respondDocumentShareInviteAction(
	invitationId: string,
	action: 'accept' | 'decline',
): Promise<
	ActionResult<{
		status: 'accepted' | 'declined';
		documentId: string;
		workspaceId: string;
		documentTitle?: string;
		access?: DocumentAccess;
	}>
> {
	try {
		const data = await serverApi<{
			status: 'accepted' | 'declined';
			documentId: string;
			workspaceId: string;
			documentTitle?: string;
			access?: DocumentAccess;
		}>('/documents/share-invitations/respond', {
			method: 'POST',
			body: JSON.stringify({ invitationId, action }),
		});
		revalidatePath('/app');
		if (data.status === 'accepted') {
			revalidatePath(`/app/w/${data.workspaceId}/d/${data.documentId}`);
		}
		return { ok: true, data };
	} catch (error) {
		return actionError(
			error,
			action === 'accept' ? 'Accept share failed' : 'Decline share failed',
		);
	}
}
export async function updatePublicLinkAccessAction(
	workspaceId: string,
	documentId: string,
	linkId: string,
	access: DocumentAccess,
): Promise<
	ActionResult<{
		id: string;
		tokenPrefix: string;
		access: DocumentAccess;
		expiresAt: string | null;
		createdAt: string;
	}>
> {
	try {
		const data = await serverApi<{
			id: string;
			tokenPrefix: string;
			access: DocumentAccess;
			expiresAt: string | null;
			createdAt: string;
		}>(`/documents/${documentId}/public-links/${linkId}`, {
			method: 'PATCH',
			body: JSON.stringify({ access }),
		});
		revalidatePath(`/app/w/${workspaceId}/d/${documentId}`);
		return { ok: true, data };
	} catch (error) {
		return actionError(error, 'Update link failed');
	}
}
export async function revokePublicLinkAction(
	workspaceId: string,
	documentId: string,
	linkId: string,
): Promise<
	ActionResult<{
		revoked: true;
	}>
> {
	try {
		await serverApi(`/documents/${documentId}/public-links/${linkId}`, {
			method: 'DELETE',
		});
		revalidatePath(`/app/w/${workspaceId}/d/${documentId}`);
		return { ok: true, data: { revoked: true } };
	} catch (error) {
		return actionError(error, 'Revoke link failed');
	}
}
export async function createCommentThreadAction(
	documentId: string,
	input: {
		blockId: string;
		body: string;
	},
): Promise<ActionResult<unknown>> {
	try {
		const data = await serverApi(`/documents/${documentId}/comments`, {
			method: 'POST',
			body: JSON.stringify(input),
		});
		return { ok: true, data };
	} catch (error) {
		return actionError(error, 'Comment failed');
	}
}
export async function addCommentAction(
	threadId: string,
	body: string,
): Promise<ActionResult<unknown>> {
	try {
		const data = await serverApi(`/comment-threads/${threadId}/comments`, {
			method: 'POST',
			body: JSON.stringify({ body }),
		});
		return { ok: true, data };
	} catch (error) {
		return actionError(error, 'Reply failed');
	}
}
export async function resolveCommentThreadAction(threadId: string): Promise<ActionResult<unknown>> {
	try {
		const data = await serverApi(`/comment-threads/${threadId}/resolve`, {
			method: 'POST',
		});
		return { ok: true, data };
	} catch (error) {
		return actionError(error, 'Resolve failed');
	}
}
export async function markNotificationReadAction(notificationId: string): Promise<
	ActionResult<{
		ok: true;
	}>
> {
	try {
		await serverApi(`/notifications/${notificationId}/read`, {
			method: 'PATCH',
		});
		return { ok: true, data: { ok: true } };
	} catch (error) {
		return actionError(error, 'Mark read failed');
	}
}
export async function listVersionsAction(
	documentId: string,
): Promise<ActionResult<DocumentVersion[]>> {
	try {
		const data = await serverApi<DocumentVersion[]>(`/documents/${documentId}/versions`);
		return { ok: true, data };
	} catch (error) {
		return actionError(error, 'Failed to load versions');
	}
}
export async function createSnapshotAction(
	documentId: string,
	workspaceId: string,
): Promise<ActionResult<DocumentVersion>> {
	try {
		const data = await serverApi<DocumentVersion>(`/documents/${documentId}/versions`, {
			method: 'POST',
		});
		revalidatePath(`/app/w/${workspaceId}/d/${documentId}`);
		return { ok: true, data };
	} catch (error) {
		return actionError(error, 'Snapshot failed');
	}
}
export async function restoreVersionAction(
	documentId: string,
	workspaceId: string,
	versionId: string,
): Promise<
	ActionResult<{
		restored: string;
	}>
> {
	try {
		const data = await serverApi<{
			restored: string;
		}>(`/documents/${documentId}/versions/${versionId}/restore`, { method: 'POST' });
		revalidatePath(`/app/w/${workspaceId}/d/${documentId}`);
		return { ok: true, data };
	} catch (error) {
		return actionError(error, 'Restore failed');
	}
}
export async function presignAssetAction(
	workspaceId: string,
	input: {
		mimeType: string;
		sizeBytes: number;
		documentId?: string;
	},
): Promise<ActionResult<AssetPresign>> {
	try {
		const data = await serverApi<AssetPresign>(`/workspaces/${workspaceId}/assets/presign`, {
			method: 'POST',
			body: JSON.stringify(input),
		});
		return { ok: true, data };
	} catch (error) {
		return actionError(error, 'Upload prepare failed');
	}
}
export async function confirmAssetAction(
	workspaceId: string,
	input: {
		objectKey: string;
		mimeType: string;
		sizeBytes: number;
		documentId?: string;
	},
): Promise<ActionResult<AssetConfirm>> {
	try {
		const data = await serverApi<AssetConfirm>(`/workspaces/${workspaceId}/assets/confirm`, {
			method: 'POST',
			body: JSON.stringify(input),
		});
		return { ok: true, data };
	} catch (error) {
		return actionError(error, 'Upload confirm failed');
	}
}
