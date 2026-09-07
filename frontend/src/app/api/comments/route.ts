import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, apiFetch } from '@/lib/api';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('documentId');
  if (!documentId) {
    return NextResponse.json({ message: 'documentId required' }, { status: 400 });
  }
  const jar = await cookies();
  const token = jar.get(ACCESS_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  try {
    const data = await apiFetch(`/documents/${documentId}/comments`, {
      accessToken: token,
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed' },
      { status: 400 },
    );
  }
}
