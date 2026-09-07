'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import {
	inviteWorkspaceMemberAction,
	leaveWorkspaceAction,
	removeWorkspaceMemberAction,
	updateWorkspaceMemberRoleAction,
} from '@/lib/actions';
import type { WorkspaceInvitation, WorkspaceMember, WorkspaceRole } from '@/lib/types';

type InviteRole = Exclude<WorkspaceRole, 'OWNER'>;

export function WorkspaceMembersPanel({
	workspaceId,
	members: initialMembers,
	invitations: initialInvitations,
	myRole,
	currentUserId,
}: {
	workspaceId: string;
	members: WorkspaceMember[];
	invitations: WorkspaceInvitation[];
	myRole: WorkspaceRole | null;
	currentUserId: string;
}) {
	const canManage = myRole === 'OWNER' || myRole === 'ADMIN';
	const router = useRouter();
	const [members, setMembers] = useState(initialMembers);
	const [invitations, setInvitations] = useState(initialInvitations);
	const [email, setEmail] = useState('');
	const [role, setRole] = useState<InviteRole>('EDITOR');
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();

	const sortedMembers = useMemo(
		() =>
			[...members].sort((a, b) => {
				const order = { OWNER: 0, ADMIN: 1, EDITOR: 2, VIEWER: 3 };
				return order[a.role] - order[b.role];
			}),
		[members],
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
		<section className="panel p-4">
			<h2 className="text-sm font-semibold">Members</h2>
			<p className="mt-1 text-[13px] text-muted">
				Invite registered users. They get a request in Alerts and join only after accepting.
			</p>

			<ul className="mt-4 space-y-2">
				{sortedMembers.map((member) => (
					<li
						key={member.id}
						className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2 last:border-0 last:pb-0"
					>
						<div className="min-w-0">
							<p className="truncate text-sm font-medium">
								{member.user.displayName}
								{member.userId === currentUserId ? (
									<span className="text-muted"> (you)</span>
								) : null}
							</p>
							<p className="truncate text-[12px] text-muted">{member.user.email}</p>
						</div>
						<div className="flex items-center gap-2">
							{canManage && member.role !== 'OWNER' ? (
								<>
									<select
										className="field !w-auto !py-1 !text-[13px]"
										value={member.role}
										disabled={pending}
										onChange={(event) => {
											const nextRole = event.target.value as InviteRole;
											run(async () => {
												const result =
													await updateWorkspaceMemberRoleAction(
														workspaceId,
														member.userId,
														nextRole,
													);
												if (!result.ok) {
													setError(result.error);
													return;
												}
												setMembers((prev) =>
													prev.map((row) =>
														row.id === member.id
															? { ...row, role: result.data.role }
															: row,
													),
												);
												setMessage(`Updated ${member.user.displayName}.`);
											});
										}}
									>
										<option value="ADMIN">Admin</option>
										<option value="EDITOR">Editor</option>
										<option value="VIEWER">Viewer</option>
									</select>
									<button
										type="button"
										className="btn btn-danger !px-2.5 !py-1 text-[12px]"
										disabled={pending}
										onClick={() =>
											run(async () => {
												const result = await removeWorkspaceMemberAction(
													workspaceId,
													member.userId,
												);
												if (!result.ok) {
													setError(result.error);
													return;
												}
												setMembers((prev) =>
													prev.filter((row) => row.id !== member.id),
												);
												setMessage(`Removed ${member.user.displayName}.`);
											})
										}
									>
										Remove
									</button>
								</>
							) : (
								<span className="text-[11px] font-medium uppercase tracking-wide text-muted">
									{member.role}
								</span>
							)}
						</div>
					</li>
				))}
			</ul>

			{canManage ? (
				<div className="mt-4 space-y-2 border-t border-line pt-4">
					<p className="text-sm font-medium">Invite</p>
					<input
						className="field"
						type="email"
						placeholder="colleague@example.com"
						value={email}
						onChange={(event) => setEmail(event.target.value)}
					/>
					<select
						className="field"
						value={role}
						onChange={(event) => setRole(event.target.value as InviteRole)}
					>
						<option value="ADMIN">Admin</option>
						<option value="EDITOR">Editor</option>
						<option value="VIEWER">Viewer</option>
					</select>
					<button
						type="button"
						className="btn btn-primary w-full"
						disabled={pending || !email.trim()}
						onClick={() =>
							run(async () => {
								const result = await inviteWorkspaceMemberAction(workspaceId, {
									email: email.trim(),
									role,
								});
								if (!result.ok) {
									setError(result.error);
									return;
								}
								setInvitations((prev) => [
									{
										id: result.data.id,
										email: result.data.email,
										role: result.data.role,
										expiresAt: new Date(
											Date.now() + 7 * 24 * 60 * 60 * 1000,
										).toISOString(),
										createdAt: new Date().toISOString(),
									},
									...prev.filter((row) => row.email !== result.data.email),
								]);
								setMessage(
									`Invite sent to ${result.data.displayName}. Waiting for accept.`,
								);
								setEmail('');
							})
						}
					>
						Send invite
					</button>

					{invitations.length > 0 ? (
						<ul className="space-y-1 text-[13px] text-muted">
							{invitations.map((invite) => (
								<li key={invite.id}>
									Pending · {invite.email} · {invite.role}
								</li>
							))}
						</ul>
					) : null}
				</div>
			) : null}

			{myRole && myRole !== 'OWNER' ? (
				<div className="mt-4 border-t border-line pt-4">
					<button
						type="button"
						className="btn btn-danger w-full"
						disabled={pending}
						onClick={() =>
							run(async () => {
								const result = await leaveWorkspaceAction(workspaceId);
								if (!result.ok) {
									setError(result.error);
									return;
								}
								router.push('/app');
								router.refresh();
							})
						}
					>
						Leave workspace
					</button>
				</div>
			) : null}

			{message ? <p className="mt-3 text-[13px] text-accent">{message}</p> : null}
			{error ? <p className="error mt-3">{error}</p> : null}
		</section>
	);
}
