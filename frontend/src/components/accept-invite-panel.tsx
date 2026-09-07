'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { acceptWorkspaceInviteAction } from '@/lib/actions';

export function AcceptInvitePanel({ token }: { token: string }) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();

	return (
		<div className="panel mx-auto w-full max-w-md rounded-[1.5rem] p-8">
			<p className="brand text-3xl">Collab Docs</p>
			<h1 className="mt-3 text-xl font-semibold">Workspace invite</h1>
			<p className="mt-2 text-sm text-muted">
				Accept to join with the role from the invitation. You must be signed in as the
				invited email.
			</p>
			{error ? <p className="error mt-4">{error}</p> : null}
			<button
				type="button"
				className="btn btn-primary mt-6 w-full"
				disabled={pending}
				onClick={() => {
					setError(null);
					startTransition(async () => {
						const result = await acceptWorkspaceInviteAction(token);
						if (!result.ok) {
							setError(result.error);
							return;
						}
						router.push(`/app/w/${result.data.workspaceId}`);
						router.refresh();
					});
				}}
			>
				{pending ? 'Joining…' : 'Accept invite'}
			</button>
			<Link href="/app" className="btn btn-ghost mt-3 w-full">
				Cancel
			</Link>
		</div>
	);
}
