import { Injectable, NotFoundException } from '@nestjs/common';
import { PlanTier, Prisma } from '@prisma/client';
import { AccessService } from '../access/access.service';
import { LoggerService } from '../logger/logger.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCheckoutDto } from './dto/billing.dto';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly logger: LoggerService,
  ) {}

  async createCheckout(userId: string, dto: CreateCheckoutDto) {
    await this.access.assertWorkspaceManage(dto.workspaceId, userId);
    if (dto.plan === PlanTier.FREE) {
      return this.applyPlan(dto.workspaceId, PlanTier.FREE, null);
    }
    return this.prisma.checkoutSession.create({
      data: {
        workspaceId: dto.workspaceId,
        plan: dto.plan,
        status: 'OPEN',
      },
    });
  }

  async handleWebhook(externalId: string, type: string, data: {
    workspaceId: string;
    plan: PlanTier;
    checkoutSessionId?: string;
  }) {
    const existing = await this.prisma.billingEvent.findUnique({
      where: { externalId },
    });
    if (existing) {
      await this.logger.info(BillingService.name, 'Duplicate billing webhook', {
        externalId,
        type,
      });
      return { duplicate: true, eventId: existing.id };
    }

    try {
      const event = await this.prisma.$transaction(async (tx) => {
        const created = await tx.billingEvent.create({
          data: {
            externalId,
            type,
            workspaceId: data.workspaceId,
            payload: data as unknown as Prisma.InputJsonValue,
          },
        });
        if (type === 'checkout.session.completed') {
          await this.applyPlanTx(
            tx,
            data.workspaceId,
            data.plan,
            data.checkoutSessionId,
          );
        }
        return created;
      });
      await this.logger.info(BillingService.name, 'Billing webhook processed', {
        externalId,
        type,
        plan: data.plan,
      });
      return { duplicate: false, eventId: event.id };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return { duplicate: true, eventId: externalId };
      }
      throw error;
    }
  }

  private async applyPlan(
    workspaceId: string,
    plan: PlanTier,
    checkoutSessionId: string | null,
  ) {
    return this.prisma.$transaction((tx) =>
      this.applyPlanTx(tx, workspaceId, plan, checkoutSessionId),
    );
  }

  private async applyPlanTx(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    plan: PlanTier,
    checkoutSessionId: string | null | undefined,
  ) {
    const workspace = await tx.workspace.findUnique({
      where: { id: workspaceId },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }
    await tx.workspace.update({
      where: { id: workspaceId },
      data: { plan },
    });
    await tx.subscription.upsert({
      where: { workspaceId },
      update: {
        plan,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      create: {
        workspaceId,
        plan,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    if (checkoutSessionId) {
      await tx.checkoutSession.updateMany({
        where: { id: checkoutSessionId, workspaceId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
    }
    return { workspaceId, plan };
  }
}
