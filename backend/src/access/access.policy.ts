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

export function resolveDocumentAccess(input: {
  workspaceRole?: WorkspaceRoleInput | null;
  shareAccess?: DocumentAccessInput | null;
  publicLinkAccess?: DocumentAccessInput | null;
}): AccessLevelValue {
  return Math.max(
    workspaceRoleToAccess(input.workspaceRole),
    documentAccessToLevel(input.shareAccess),
    documentAccessToLevel(input.publicLinkAccess),
  ) as AccessLevelValue;
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
