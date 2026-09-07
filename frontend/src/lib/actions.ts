'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  apiFetch,
  safeNextPath,
  serverApi,
} from './api';
import type {
  AuthTokens,
  DocumentAccess,
  DocumentDetail,
  DocumentShare,
  DocumentTreeItem,
  Workspace,
} from './types';

const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: process.env.NODE_ENV === 'production',
};

async function setSession(tokens: AuthTokens) {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, tokens.accessToken, {
    ...cookieOpts,
    maxAge: 60 * 15,
  });
  jar.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...cookieOpts,
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function registerAction(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const displayName = String(formData.get('displayName') ?? '');
  const next = safeNextPath(String(formData.get('next') ?? '') || undefined);
  try {
    const tokens = await apiFetch<AuthTokens>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    });
    await setSession(tokens);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Registration failed',
    };
  }
  redirect(next ?? '/app');
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const next = safeNextPath(String(formData.get('next') ?? '') || undefined);
  try {
    const tokens = await apiFetch<AuthTokens>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await setSession(tokens);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Login failed',
    };
  }
  redirect(next ?? '/app');
}

export async function logoutAction() {
  const jar = await cookies();
  const refresh = jar.get(REFRESH_COOKIE)?.value;
  try {
    if (refresh) {
      await apiFetch('/auth/logout', {
        method: 'POST',
        accessToken: jar.get(ACCESS_COOKIE)?.value,
        body: JSON.stringify({ refreshToken: refresh }),
      });
    }
  } catch {
    // clear cookies anyway
  }
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
  redirect('/login');
}

export async function createWorkspaceAction(formData: FormData): Promise<void> {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) {
    throw new Error('Name is required');
  }
  const workspace = await serverApi<Workspace>('/workspaces', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  redirect(`/app/w/${workspace.id}`);
}

export async function createDocumentAction(
  workspaceId: string,
  formData: FormData,
): Promise<void> {
  const title = String(formData.get('title') ?? 'Untitled').trim() || 'Untitled';
  const parentId = String(formData.get('parentId') ?? '') || undefined;
  const doc = await serverApi<DocumentTreeItem>(
    `/workspaces/${workspaceId}/documents`,
    {
      method: 'POST',
      body: JSON.stringify({ title, parentId }),
    },
  );
  redirect(`/app/w/${workspaceId}/d/${doc.id}`);
}

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function actionError(error: unknown, fallback: string): ActionResult<never> {
  return {
    ok: false,
    error: error instanceof Error ? error.message : fallback,
  };
}

export async function publishDocumentAction(
  documentId: string,
  workspaceId: string,
  published: boolean,
): Promise<ActionResult<DocumentDetail>> {
  try {
    await serverApi(`/documents/${documentId}/publish`, {
      method: 'POST',
      body: JSON.stringify({ published }),
    });
    const data = await serverApi<DocumentDetail>(`/documents/${documentId}`);
    revalidatePath(`/app/w/${workspaceId}/d/${documentId}`);
    revalidatePath(`/app/w/${workspaceId}`);
    if (data.publicSlug) {
      revalidatePath(`/p/${data.publicSlug}`);
    }
    return { ok: true, data };
  } catch (error) {
    return actionError(error, 'Publish failed');
  }
}

export async function shareDocumentAction(
  documentId: string,
  workspaceId: string,
  input: { userId?: string; email?: string; access: DocumentAccess },
): Promise<ActionResult<DocumentShare>> {
  try {
    const data = await serverApi<DocumentShare>(
      `/documents/${documentId}/shares`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    );
    revalidatePath(`/app/w/${workspaceId}/d/${documentId}`);
    return { ok: true, data };
  } catch (error) {
    return actionError(error, 'Share failed');
  }
}

export async function createPublicLinkAction(
  documentId: string,
  workspaceId: string,
  input: { access: DocumentAccess; expiresAt?: string },
): Promise<
  ActionResult<{
    id: string;
    token: string;
    access: DocumentAccess;
    expiresAt: string | null;
  }>
> {
  try {
    const data = await serverApi<{
      id: string;
      token: string;
      access: DocumentAccess;
      expiresAt: string | null;
    }>(`/documents/${documentId}/public-links`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    revalidatePath(`/app/w/${workspaceId}/d/${documentId}`);
    return { ok: true, data };
  } catch (error) {
    return actionError(error, 'Public link failed');
  }
}
