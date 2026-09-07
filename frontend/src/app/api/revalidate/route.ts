import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

type Body = {
	slug?: string;
	documentId?: string;
	path?: string;
	tag?: string;
};

export async function POST(request: Request) {
	const secret = request.headers.get('x-revalidate-secret');
	if (!secret || secret !== process.env.REVALIDATE_SECRET) {
		return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
	}

	let body: Body;
	try {
		body = (await request.json()) as Body;
	} catch {
		return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
	}

	const revalidated: string[] = [];

	if (body.slug) {
		revalidateTag(`public-doc:${body.slug}`);
		revalidatePath(`/p/${body.slug}`);
		revalidated.push(`tag:public-doc:${body.slug}`, `path:/p/${body.slug}`);
	}
	if (body.path) {
		revalidatePath(body.path);
		revalidated.push(`path:${body.path}`);
	}
	if (body.tag) {
		revalidateTag(body.tag);
		revalidated.push(`tag:${body.tag}`);
	}

	if (revalidated.length === 0) {
		return NextResponse.json({ message: 'slug, path, or tag required' }, { status: 400 });
	}

	return NextResponse.json({
		revalidated: true,
		documentId: body.documentId ?? null,
		items: revalidated,
		now: Date.now(),
	});
}
