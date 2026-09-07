import { AcceptInvitePanel } from '@/components/accept-invite-panel';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ACCESS_COOKIE } from '@/lib/api';

type Props = {
	searchParams: Promise<{ t?: string; token?: string }>;
};

export default async function InvitePage({ searchParams }: Props) {
	const query = await searchParams;
	const token = query.t ?? query.token;
	const jar = await cookies();
	const access = jar.get(ACCESS_COOKIE)?.value;

	if (!token) {
		return (
			<main className="mx-auto flex min-h-screen max-w-lg items-center px-5 py-12">
				<div className="panel w-full rounded-[1.5rem] p-8">
					<h1 className="text-xl font-semibold">Invalid invite</h1>
					<p className="mt-2 text-sm text-muted">Missing invite token.</p>
					<Link href="/app" className="btn btn-ghost mt-6">
						Go to app
					</Link>
				</div>
			</main>
		);
	}

	if (!access) {
		const next = `/invite?t=${encodeURIComponent(token)}`;
		redirect(`/login?next=${encodeURIComponent(next)}`);
	}

	return (
		<main className="mx-auto flex min-h-screen max-w-lg items-center px-5 py-12">
			<AcceptInvitePanel token={token} />
		</main>
	);
}
