import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, apiFetch } from '@/lib/api';

export async function GET() {
	const jar = await cookies();
	const token = jar.get(ACCESS_COOKIE)?.value;
	if (!token) {
		return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
	}
	try {
		const data = await apiFetch('/notifications', { accessToken: token });
		return NextResponse.json(data);
	} catch (error) {
		return NextResponse.json(
			{ message: error instanceof Error ? error.message : 'Failed' },
			{ status: 400 },
		);
	}
}
