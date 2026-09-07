import {
  AccessLevel,
  canCreateWorkspaceDocuments,
  resolveDocumentAccess,
} from './access.policy';

describe('resolveDocumentAccess', () => {
  it('maps workspace roles when no document permission', () => {
    expect(resolveDocumentAccess({ workspaceRole: 'OWNER' })).toBe(
      AccessLevel.MANAGE,
    );
    expect(resolveDocumentAccess({ workspaceRole: 'ADMIN' })).toBe(
      AccessLevel.MANAGE,
    );
    expect(resolveDocumentAccess({ workspaceRole: 'EDITOR' })).toBe(
      AccessLevel.EDIT,
    );
    expect(resolveDocumentAccess({ workspaceRole: 'VIEWER' })).toBe(
      AccessLevel.VIEW,
    );
  });

  it('lets document permission raise Viewer to Edit', () => {
    expect(
      resolveDocumentAccess({
        workspaceRole: 'VIEWER',
        shareAccess: 'EDIT',
      }),
    ).toBe(AccessLevel.EDIT);
  });

  it('lets document permission restrict Editor to View', () => {
    expect(
      resolveDocumentAccess({
        workspaceRole: 'EDITOR',
        shareAccess: 'VIEW',
      }),
    ).toBe(AccessLevel.VIEW);
  });

  it('never lets document permission restrict Owner/Admin', () => {
    expect(
      resolveDocumentAccess({
        workspaceRole: 'OWNER',
        shareAccess: 'VIEW',
      }),
    ).toBe(AccessLevel.MANAGE);
    expect(
      resolveDocumentAccess({
        workspaceRole: 'ADMIN',
        shareAccess: 'VIEW',
      }),
    ).toBe(AccessLevel.MANAGE);
  });

  it('grants outsiders access via document share without workspace role', () => {
    expect(
      resolveDocumentAccess({ shareAccess: 'EDIT' }),
    ).toBe(AccessLevel.EDIT);
  });

  it('grants outsiders access via public link when no membership/share', () => {
    expect(resolveDocumentAccess({})).toBe(AccessLevel.NONE);
    expect(
      resolveDocumentAccess({ publicLinkAccess: 'VIEW' }),
    ).toBe(AccessLevel.VIEW);
    expect(
      resolveDocumentAccess({ publicLinkAccess: 'EDIT' }),
    ).toBe(AccessLevel.EDIT);
  });

  it('prefers workspace role over public link when both present', () => {
    expect(
      resolveDocumentAccess({
        workspaceRole: 'VIEWER',
        publicLinkAccess: 'EDIT',
      }),
    ).toBe(AccessLevel.VIEW);
  });

  it('prefers document share over public link', () => {
    expect(
      resolveDocumentAccess({
        shareAccess: 'VIEW',
        publicLinkAccess: 'EDIT',
      }),
    ).toBe(AccessLevel.VIEW);
  });
});

describe('canCreateWorkspaceDocuments', () => {
  it('allows owners admins editors only', () => {
    expect(canCreateWorkspaceDocuments('OWNER')).toBe(true);
    expect(canCreateWorkspaceDocuments('ADMIN')).toBe(true);
    expect(canCreateWorkspaceDocuments('EDITOR')).toBe(true);
    expect(canCreateWorkspaceDocuments('VIEWER')).toBe(false);
    expect(canCreateWorkspaceDocuments(null)).toBe(false);
  });
});
