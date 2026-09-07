'use client';

import { useParams } from 'next/navigation';
import { RouteError } from '@/components/route-state';

export default function DocumentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ workspaceId?: string }>();
  const workspaceId = params.workspaceId;

  return (
    <RouteError
      title="Document unavailable"
      message={error.message}
      reset={reset}
      homeHref={workspaceId ? `/app/w/${workspaceId}` : '/app'}
      homeLabel={workspaceId ? 'Back to workspace' : 'Back to app'}
    />
  );
}
