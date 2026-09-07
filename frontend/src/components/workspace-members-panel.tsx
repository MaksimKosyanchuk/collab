'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  inviteWorkspaceMemberAction,
  removeWorkspaceMemberAction,
  updateWorkspaceMemberRoleAction,
} from '@/lib/actions';
import type {
  WorkspaceInvitation,
  WorkspaceMember,
  WorkspaceRole,
} from '@/lib/types';

type InviteRole = Exclude<WorkspaceRole, 'OWNER'>;

function appOrigin() {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

export function WorkspaceMembersPanel({
  workspaceId,
  members: initialMembers,
  invitations: initialInvitations,
  myRole,
}: {
  workspaceId: string;
  members: WorkspaceMember[];
  invitations: WorkspaceInvitation[];
  myRole: WorkspaceRole | null;
}) {
  const canManage = myRole === 'OWNER' || myRole === 'ADMIN';
  const [members, setMembers] = useState(initialMembers);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteRole>('EDITOR');
  const [freshInviteUrl, setFreshInviteUrl] = useState<string | null>(null);
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
    <section className="panel rounded-[1.5rem] p-6">
      <h2 className="text-lg font-semibold">Members</h2>
      <p className="mt-1 text-sm text-muted">
        Registered users are added immediately. Others get an invite link.
      </p>

      <ul className="mt-5 space-y-3">
        {sortedMembers.map((member) => (
          <li
            key={member.id}
            className="flex flex-wrap items-center justify-between gap-2 border-b border-line/70 pb-3 last:border-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{member.user.displayName}</p>
              <p className="truncate text-sm text-muted">{member.user.email}</p>
            </div>
            <div className="flex items-center gap-2">
              {canManage && member.role !== 'OWNER' ? (
                <>
                  <select
                    className="field !w-auto !py-1.5 !text-sm"
                    value={member.role}
                    disabled={pending}
                    onChange={(event) => {
                      const nextRole = event.target.value as InviteRole;
                      run(async () => {
                        const result = await updateWorkspaceMemberRoleAction(
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
                    className="btn btn-danger !px-3 !py-1.5 text-sm"
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
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {member.role}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      {canManage ? (
        <div className="mt-6 space-y-3 border-t border-line pt-5">
          <p className="text-sm font-medium">Invite or add</p>
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
                if (result.data.status === 'added' && result.data.member) {
                  setMembers((prev) => [...prev, result.data.member!]);
                  setFreshInviteUrl(null);
                  setMessage(
                    `Added ${result.data.member.user.displayName} as ${result.data.role}.`,
                  );
                } else if (result.data.token) {
                  const url = `${appOrigin()}/invite?t=${encodeURIComponent(result.data.token)}`;
                  setFreshInviteUrl(url);
                  setInvitations((prev) => [
                    {
                      id: result.data.id ?? crypto.randomUUID(),
                      email: result.data.email,
                      role: result.data.role,
                      expiresAt: new Date(
                        Date.now() + 7 * 24 * 60 * 60 * 1000,
                      ).toISOString(),
                      createdAt: new Date().toISOString(),
                    },
                    ...prev,
                  ]);
                  setMessage(
                    `Invite created for ${result.data.email}. Copy the link once.`,
                  );
                }
                setEmail('');
              })
            }
          >
            Send invite
          </button>

          {freshInviteUrl ? (
            <div className="rounded-xl border border-line bg-white/70 p-3">
              <p className="text-xs text-muted">Invite URL (shown once)</p>
              <a
                href={freshInviteUrl}
                className="mt-1 block break-all text-xs font-medium text-accent underline-offset-2 hover:underline"
              >
                {freshInviteUrl}
              </a>
              <button
                type="button"
                className="btn btn-ghost mt-2 w-full"
                onClick={async () => {
                  await navigator.clipboard.writeText(freshInviteUrl);
                  setMessage('Invite link copied.');
                }}
              >
                Copy invite link
              </button>
            </div>
          ) : null}

          {invitations.length > 0 ? (
            <ul className="space-y-2 text-sm text-muted">
              {invitations.map((invite) => (
                <li key={invite.id}>
                  Pending · {invite.email} · {invite.role}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {message ? <p className="mt-4 text-sm text-accent">{message}</p> : null}
      {error ? <p className="error mt-4">{error}</p> : null}
    </section>
  );
}
