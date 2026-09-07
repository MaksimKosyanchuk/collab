import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE } from '@/lib/api';
export async function GET() {
	const jar = await cookies();
	const accessToken = jar.get(ACCESS_COOKIE)?.value;
	if (!accessToken) {
		return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
	}
	return NextResponse.json({ accessToken });
}
