import { CollabEditor } from '@/components/collab-editor';
import { apiFetch } from '@/lib/api';
import type { DocumentDetail } from '@/lib/types';
import Link from 'next/link';

type Props = {
	params: Promise<{ documentId: string }>;
	searchParams: Promise<{ t?: string; token?: string }>;
};

export default async function ShareLinkPage({ params, searchParams }: Props) {
	const { documentId } = await params;
	const query = await searchParams;
	const shareToken = query.t ?? query.token;

	if (!shareToken) {
		return (
			<main className="mx-auto flex min-h-screen max-w-lg items-center px-5 py-12">
				<div className="panel w-full rounded-[1.5rem] p-8">
					<h1 className="text-xl font-semibold">Invalid share link</h1>
					<p className="mt-2 text-sm text-muted">This URL is missing the access token.</p>
					<Link href="/app" className="btn btn-ghost mt-6">
						Go to app
					</Link>
				</div>
			</main>
		);
	}

	try {
		const document = await apiFetch<DocumentDetail>(
			`/public/documents/${documentId}/shared?token=${encodeURIComponent(shareToken)}`,
		);

		return (
			<main className="mx-auto min-h-screen max-w-6xl px-4 py-8 md:px-8">
				<p className="mb-4 text-sm text-muted">
					Opened via share link · {document.access >= 2 ? 'can edit' : 'view only'}
				</p>
				<CollabEditor
					workspaceId={document.workspaceId}
					documentId={documentId}
					accessMeta={document}
					members={[]}
					shareToken={shareToken}
					showAccessPanel={false}
				/>
			</main>
		);
	} catch {
		return (
			<main className="mx-auto flex min-h-screen max-w-lg items-center px-5 py-12">
				<div className="panel w-full rounded-[1.5rem] p-8">
					<h1 className="text-xl font-semibold">Link unavailable</h1>
					<p className="mt-2 text-sm text-muted">
						The token may be expired, revoked, or wrong for this document. Ask for a new
						link.
					</p>
					<Link href="/app" className="btn btn-ghost mt-6">
						Go to app
					</Link>
				</div>
			</main>
		);
	}
}
