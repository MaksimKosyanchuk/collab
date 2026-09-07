import { cookies } from 'next/headers';
import { ACCESS_COOKIE, ApiError, apiFetch } from './api';

export async function getAccessToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(ACCESS_COOKIE)?.value ?? null;
}

export async function serverApi<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken();
  if (!token) {
    throw new ApiError(401, { message: 'Unauthorized' });
  }
  return apiFetch<T>(path, { ...init, accessToken: token });
}

export async function serverApiWithShareToken<T>(
  path: string,
  shareToken: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('x-share-token', shareToken);
  return serverApi<T>(path, { ...init, headers });
}
