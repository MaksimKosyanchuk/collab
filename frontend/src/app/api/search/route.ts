import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE, apiFetch } from '@/lib/api';

export async function GET(request: NextRequest) {
	const jar = await cookies();
	const token = jar.get(ACCESS_COOKIE)?.value;
	if (!token) {
		return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
	}

	const workspaceId = request.nextUrl.searchParams.get('workspaceId') ?? '';
	const q = request.nextUrl.searchParams.get('q') ?? '';
	if (!workspaceId || !q.trim()) {
		return NextResponse.json([]);
	}

	try {
		const params = new URLSearchParams({ workspaceId, q: q.trim() });
		const data = await apiFetch(`/search?${params.toString()}`, {
			accessToken: token,
		});
		return NextResponse.json(data);
	} catch (error) {
		return NextResponse.json(
			{ message: error instanceof Error ? error.message : 'Search failed' },
			{ status: 400 },
		);
	}
}
