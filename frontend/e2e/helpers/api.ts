import { randomUUID } from 'crypto';
import type { APIRequestContext, BrowserContext } from '@playwright/test';

export const API = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001';

export type Tokens = { accessToken: string; refreshToken: string };

export async function registerUser(
  request: APIRequestContext,
  label: string,
): Promise<{ tokens: Tokens; email: string; password: string; userId: string }> {
  const email = `pw_${label}_${randomUUID().slice(0, 8)}@example.com`;
  const password = 'password123';
  const displayName = label.slice(0, 20) || 'User';
  const res = await request.post(`${API}/auth/register`, {
    data: { email, password, displayName },
  });
  if (!res.ok()) {
    throw new Error(`register failed: ${res.status()} ${await res.text()}`);
  }
  const tokens = (await res.json()) as Tokens;
  const me = await request.get(`${API}/auth/me`, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });
  if (!me.ok()) {
    throw new Error(`me failed: ${me.status()}`);
  }
  const body = (await me.json()) as { id: string };
  return { tokens, email, password, userId: body.id };
}

export async function createWorkspace(
  request: APIRequestContext,
  token: string,
  name: string,
): Promise<{ id: string }> {
  const res = await request.post(`${API}/workspaces`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name },
  });
  if (!res.ok()) {
    throw new Error(`workspace failed: ${res.status()} ${await res.text()}`);
  }
  return (await res.json()) as { id: string };
}

export async function createDocument(
  request: APIRequestContext,
  token: string,
  workspaceId: string,
  title: string,
): Promise<{ id: string; title: string }> {
  const res = await request.post(`${API}/workspaces/${workspaceId}/documents`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title },
  });
  if (!res.ok()) {
    throw new Error(`document failed: ${res.status()} ${await res.text()}`);
  }
  return (await res.json()) as { id: string; title: string };
}

export async function inviteViewer(
  request: APIRequestContext,
  token: string,
  workspaceId: string,
  email: string,
): Promise<{ id: string }> {
  const res = await request.post(`${API}/workspaces/${workspaceId}/invitations`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { email, role: 'VIEWER' },
  });
  if (!res.ok()) {
    throw new Error(`invite failed: ${res.status()} ${await res.text()}`);
  }
  return (await res.json()) as { id: string };
}

export async function acceptInvite(
  request: APIRequestContext,
  token: string,
  invitationId: string,
): Promise<void> {
  const res = await request.post(`${API}/workspaces/invitations/respond`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { invitationId, action: 'accept' },
  });
  if (!res.ok()) {
    throw new Error(`accept failed: ${res.status()} ${await res.text()}`);
  }
}

export async function publishDocument(
  request: APIRequestContext,
  token: string,
  documentId: string,
): Promise<{ publicSlug: string; publicationStatus: string }> {
  const res = await request.post(`${API}/documents/${documentId}/publish`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { published: true },
  });
  if (!res.ok()) {
    throw new Error(`publish failed: ${res.status()} ${await res.text()}`);
  }
  return (await res.json()) as {
    publicSlug: string;
    publicationStatus: string;
  };
}

export async function setAuthCookies(
  context: BrowserContext,
  tokens: Tokens,
  baseURL: string,
): Promise<void> {
  const url = new URL(baseURL);
  await context.addCookies([
    {
      name: 'collab_access',
      value: tokens.accessToken,
      domain: url.hostname,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: 'collab_refresh',
      value: tokens.refreshToken,
      domain: url.hostname,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}
