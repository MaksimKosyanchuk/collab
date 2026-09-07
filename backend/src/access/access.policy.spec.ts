import { AccessLevel, resolveDocumentAccess } from './access.policy';

describe('resolveDocumentAccess', () => {
  it('maps workspace roles', () => {
    expect(resolveDocumentAccess({ workspaceRole: 'OWNER' })).toBe(
      AccessLevel.MANAGE,
    );
    expect(resolveDocumentAccess({ workspaceRole: 'EDITOR' })).toBe(
      AccessLevel.EDIT,
    );
    expect(resolveDocumentAccess({ workspaceRole: 'VIEWER' })).toBe(
      AccessLevel.VIEW,
    );
  });

  it('lets a document share raise a viewer to editor', () => {
    expect(
      resolveDocumentAccess({
        workspaceRole: 'VIEWER',
        shareAccess: 'EDIT',
      }),
    ).toBe(AccessLevel.EDIT);
  });

  it('grants outsiders access only via share or public link', () => {
    expect(resolveDocumentAccess({})).toBe(AccessLevel.NONE);
    expect(
      resolveDocumentAccess({ publicLinkAccess: 'VIEW' }),
    ).toBe(AccessLevel.VIEW);
  });

  it('never lets a public view link grant edit', () => {
    expect(
      resolveDocumentAccess({
        workspaceRole: 'VIEWER',
        publicLinkAccess: 'VIEW',
      }),
    ).toBe(AccessLevel.VIEW);
  });
});
