import { NotFoundException } from '@nestjs/common';
import { PlanTier, Prisma } from '@prisma/client';
import { BillingService } from './billing.service';

describe('BillingService.handleWebhook idempotency', () => {
  const workspaceId = '11111111-1111-1111-1111-111111111111';
  const externalId = 'evt_test_checkout_1';

  function createService(prisma: Record<string, unknown>) {
    const access = { assertWorkspaceManage: jest.fn() };
    const logger = {
      info: jest.fn().mockResolvedValue(undefined),
      warn: jest.fn().mockResolvedValue(undefined),
      error: jest.fn().mockResolvedValue(undefined),
    };
    return new BillingService(
      prisma as never,
      access as never,
      logger as never,
    );
  }

  it('applies plan once for a new checkout.session.completed event', async () => {
    const tx = {
      billingEvent: {
        create: jest.fn().mockResolvedValue({ id: 'be-1' }),
      },
      workspace: {
        findUnique: jest.fn().mockResolvedValue({
          id: workspaceId,
          plan: PlanTier.FREE,
        }),
        update: jest.fn().mockResolvedValue({
          id: workspaceId,
          plan: PlanTier.PRO,
        }),
      },
      subscription: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      checkoutSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const prisma = {
      billingEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    };

    const service = createService(prisma);
    const first = await service.handleWebhook(externalId, 'checkout.session.completed', {
      workspaceId,
      plan: PlanTier.PRO,
    });

    expect(first).toEqual({ duplicate: false, eventId: 'be-1' });
    expect(tx.workspace.update).toHaveBeenCalledWith({
      where: { id: workspaceId },
      data: { plan: PlanTier.PRO },
    });
    expect(tx.billingEvent.create).toHaveBeenCalledTimes(1);
  });

  it('ignores replay of the same externalId without changing plan again', async () => {
    const prisma = {
      billingEvent: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'be-existing',
          externalId,
        }),
      },
      $transaction: jest.fn(),
    };
    const service = createService(prisma);

    const replay = await service.handleWebhook(
      externalId,
      'checkout.session.completed',
      { workspaceId, plan: PlanTier.TEAM },
    );

    expect(replay).toEqual({ duplicate: true, eventId: 'be-existing' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('treats unique-constraint race as duplicate', async () => {
    const prisma = {
      billingEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      ),
    };
    const service = createService(prisma);

    const result = await service.handleWebhook(
      externalId,
      'checkout.session.completed',
      { workspaceId, plan: PlanTier.PRO },
    );

    expect(result).toEqual({ duplicate: true, eventId: externalId });
  });

  it('propagates missing workspace errors', async () => {
    const tx = {
      billingEvent: {
        create: jest.fn().mockResolvedValue({ id: 'be-2' }),
      },
      workspace: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const prisma = {
      billingEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    };
    const service = createService(prisma);

    await expect(
      service.handleWebhook(externalId, 'checkout.session.completed', {
        workspaceId,
        plan: PlanTier.PRO,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
