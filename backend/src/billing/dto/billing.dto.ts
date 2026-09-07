import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlanTier } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class CreateCheckoutDto {
  @ApiProperty()
  @IsUUID()
  workspaceId: string;

  @ApiProperty({ enum: PlanTier })
  @IsEnum(PlanTier)
  plan: PlanTier;
}

export class BillingWebhookDataDto {
  @ApiProperty()
  @IsUUID()
  workspaceId: string;

  @ApiProperty({ enum: PlanTier })
  @IsEnum(PlanTier)
  plan: PlanTier;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  checkoutSessionId?: string;
}

export class BillingWebhookDto {
  @ApiProperty({ description: 'Idempotency key / Stripe-like event id' })
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  type: string;

  @ApiProperty({ type: BillingWebhookDataDto })
  @ValidateNested()
  @Type(() => BillingWebhookDataDto)
  data: BillingWebhookDataDto;
}
