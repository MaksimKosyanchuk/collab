export const AccessLevel = {
  NONE: 0,
  VIEW: 1,
  EDIT: 2,
  MANAGE: 3,
} as const;

export type AccessLevelValue = (typeof AccessLevel)[keyof typeof AccessLevel];

export type WorkspaceRoleInput = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';
export type DocumentAccessInput = 'VIEW' | 'EDIT' | 'MANAGE';

export function workspaceRoleToAccess(
  role: WorkspaceRoleInput | null | undefined,
): AccessLevelValue {
  if (role === 'OWNER' || role === 'ADMIN') {
    return AccessLevel.MANAGE;
  }
  if (role === 'EDITOR') {
    return AccessLevel.EDIT;
  }
  if (role === 'VIEWER') {
    return AccessLevel.VIEW;
  }
  return AccessLevel.NONE;
}

export function documentAccessToLevel(
  access: DocumentAccessInput | null | undefined,
): AccessLevelValue {
  if (access === 'MANAGE') {
    return AccessLevel.MANAGE;
  }
  if (access === 'EDIT') {
    return AccessLevel.EDIT;
  }
  if (access === 'VIEW') {
    return AccessLevel.VIEW;
  }
  return AccessLevel.NONE;
}

/**
 * Access resolution (first match wins):
 * 1. Owner/Admin — always MANAGE (document permission cannot restrict them)
 * 2. Explicit DocumentShare for this user — overrides workspace role
 * 3. Workspace role (Editor / Viewer)
 * 4. Public link token (outsiders)
 * 5. NONE → caller returns 403
 */
export function resolveDocumentAccess(input: {
  workspaceRole?: WorkspaceRoleInput | null;
  shareAccess?: DocumentAccessInput | null;
  publicLinkAccess?: DocumentAccessInput | null;
}): AccessLevelValue {
  const role = input.workspaceRole ?? null;

  if (role === 'OWNER' || role === 'ADMIN') {
    return AccessLevel.MANAGE;
  }

  if (input.shareAccess != null) {
    return documentAccessToLevel(input.shareAccess);
  }

  const fromWorkspace = workspaceRoleToAccess(role);
  if (fromWorkspace > AccessLevel.NONE) {
    return fromWorkspace;
  }

  if (input.publicLinkAccess != null) {
    return documentAccessToLevel(input.publicLinkAccess);
  }

  return AccessLevel.NONE;
}

export function canView(level: AccessLevelValue): boolean {
  return level >= AccessLevel.VIEW;
}

export function canEdit(level: AccessLevelValue): boolean {
  return level >= AccessLevel.EDIT;
}

export function canManage(level: AccessLevelValue): boolean {
  return level >= AccessLevel.MANAGE;
}

/** Workspace-level create / tree mutate (not document-share elevated). */
export function canCreateWorkspaceDocuments(
  role: WorkspaceRoleInput | null | undefined,
): boolean {
  return (
    role === 'OWNER' || role === 'ADMIN' || role === 'EDITOR'
  );
}
