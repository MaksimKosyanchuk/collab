'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { renameWorkspaceAction } from '@/lib/actions';

export function WorkspaceSettingsForm({
	workspaceId,
	name,
}: {
	workspaceId: string;
	name: string;
}) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();

	return (
		<section className="panel p-4">
			<h2 className="text-sm font-semibold">Settings</h2>
			<p className="mt-1 text-[13px] text-muted">
				Rename this workspace. Owner and Admin only.
			</p>
			<form
				className="mt-3 space-y-2"
				onSubmit={(event) => {
					event.preventDefault();
					const formData = new FormData(event.currentTarget);
					setError(null);
					setMessage(null);
					startTransition(async () => {
						const result = await renameWorkspaceAction(workspaceId, formData);
						if (!result.ok) {
							setError(result.error);
							return;
						}
						setMessage('Workspace renamed');
						router.refresh();
					});
				}}
			>
				<label className="block space-y-1 text-[13px]">
					<span className="text-muted">Name</span>
					<input
						className="field"
						name="name"
						defaultValue={name}
						required
						minLength={2}
						maxLength={80}
						disabled={pending}
					/>
				</label>
				{error ? <p className="error text-[13px]">{error}</p> : null}
				{message ? <p className="text-[13px] text-muted">{message}</p> : null}
				<button className="btn btn-primary w-full" type="submit" disabled={pending}>
					{pending ? 'Saving…' : 'Rename'}
				</button>
			</form>
		</section>
	);
}
