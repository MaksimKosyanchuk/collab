import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ACCESS_COOKIE = 'collab_access';

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  const isAuthPage =
    pathname.startsWith('/login') || pathname.startsWith('/register');
  const isPrivate =
    pathname.startsWith('/app') || pathname.startsWith('/invite');
  const isPublic =
    pathname.startsWith('/p/') || pathname.startsWith('/s/');

  if (isPublic) {
    return NextResponse.next();
  }

  if (isPrivate && !token) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  if (isAuthPage && token) {
    const next = request.nextUrl.searchParams.get('next');
    if (next?.startsWith('/') && !next.startsWith('//')) {
      return NextResponse.redirect(new URL(next, request.url));
    }
    return NextResponse.redirect(new URL('/app', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/app/:path*',
    '/s/:path*',
    '/invite',
    '/login',
    '/register',
  ],
};
