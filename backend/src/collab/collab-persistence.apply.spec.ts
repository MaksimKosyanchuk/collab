import { createHash } from 'crypto';
import { CollabPersistenceService } from './collab-persistence.service';

describe('CollabPersistenceService.applyUpdate', () => {
  it('stores a new update and reports applied=true', async () => {
    const payload = new Uint8Array([1, 2, 3, 4]);
    const hash = createHash('sha256').update(payload).digest('hex');
    const prisma = {
      documentCollabUpdate: {
        create: jest.fn().mockResolvedValue({ id: 'u1', hash }),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const service = new CollabPersistenceService(prisma as never);

    await expect(service.applyUpdate('doc-1', payload)).resolves.toEqual({
      applied: true,
    });
    expect(prisma.documentCollabUpdate.create).toHaveBeenCalledWith({
      data: {
        documentId: 'doc-1',
        payload: expect.any(Uint8Array),
        hash,
      },
    });
  });

  it('returns applied=false when the same hash already exists (replay)', async () => {
    const payload = new Uint8Array([9, 9, 9]);
    const prisma = {
      documentCollabUpdate: {
        create: jest.fn().mockRejectedValue(new Error('Unique constraint')),
        count: jest.fn(),
      },
    };
    const service = new CollabPersistenceService(prisma as never);

    await expect(service.applyUpdate('doc-1', payload)).resolves.toEqual({
      applied: false,
    });
    expect(prisma.documentCollabUpdate.count).not.toHaveBeenCalled();
  });
});
