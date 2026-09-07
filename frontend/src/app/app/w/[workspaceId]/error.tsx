'use client';
import { RouteError } from '@/components/route-state';
export default function WorkspaceError({
	error,
	reset,
}: {
	error: Error & {
		digest?: string;
	};
	reset: () => void;
}) {
	return (
		<RouteError
			title="Workspace unavailable"
			message={error.message}
			reset={reset}
			homeHref="/app"
			homeLabel="All workspaces"
		/>
	);
}
