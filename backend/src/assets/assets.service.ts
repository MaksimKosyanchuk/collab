import {
  BadRequestException,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';
import { randomUUID } from 'crypto';
import { AccessService } from '../access/access.service';
import { PlanLimitException } from '../common/exceptions/plan-limit.exception';
import { PLAN_LIMITS } from '../common/plan-limits';
import { PrismaService } from '../prisma/prisma.service';
import { ConfirmAssetDto, PresignAssetDto } from './dto/asset.dto';

const ALLOWED = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

@Injectable()
export class AssetsService implements OnModuleInit {
  private readonly client: MinioClient;
  private readonly bucket: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {
    this.bucket = this.config.get('MINIO_BUCKET', 'collab');
    this.client = new MinioClient({
      endPoint: this.config.get('MINIO_ENDPOINT', 'localhost'),
      port: Number(this.config.get('MINIO_PORT', 9000)),
      useSSL: false,
      accessKey: this.config.get('MINIO_ACCESS_KEY', 'minio'),
      secretKey: this.config.get('MINIO_SECRET_KEY', 'minio12345'),
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
      }
    } catch {
      // MinIO may be down in unit tests
    }
  }

  async presign(workspaceId: string, userId: string, dto: PresignAssetDto) {
    await this.access.assertWorkspaceMember(workspaceId, userId);
    this.assertMime(dto.mimeType);
    await this.assertStorage(workspaceId, dto.sizeBytes);
    if (dto.documentId) {
      await this.access.assertDocumentEdit(dto.documentId, { userId });
    }
    const ext = extOf(dto.mimeType);
    const objectKey = `${workspaceId}/${dto.documentId ?? 'workspace'}/${randomUUID()}${ext}`;
    const uploadUrl = await this.client.presignedPutObject(
      this.bucket,
      objectKey,
      60 * 10,
    );
    return { objectKey, uploadUrl, bucket: this.bucket };
  }

  async confirm(workspaceId: string, userId: string, dto: ConfirmAssetDto) {
    await this.access.assertWorkspaceMember(workspaceId, userId);
    this.assertMime(dto.mimeType);
    if (!dto.objectKey.startsWith(`${workspaceId}/`)) {
      throw new BadRequestException('Invalid object key');
    }
    await this.assertStorage(workspaceId, dto.sizeBytes);
    const asset = await this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
      });
      const next = workspace.storageUsedBytes + BigInt(dto.sizeBytes);
      if (next > BigInt(PLAN_LIMITS[workspace.plan].storageBytes)) {
        throw new PlanLimitException('storage', workspace.plan);
      }
      await tx.workspace.update({
        where: { id: workspaceId },
        data: { storageUsedBytes: next },
      });
      return tx.asset.create({
        data: {
          workspaceId,
          documentId: dto.documentId,
          uploadedById: userId,
          objectKey: dto.objectKey,
          mimeType: dto.mimeType,
          sizeBytes: dto.sizeBytes,
        },
      });
    });
    const url = await this.client.presignedGetObject(
      this.bucket,
      dto.objectKey,
      60 * 60,
    );
    return { ...asset, url };
  }

  private assertMime(mimeType: string) {
    if (!ALLOWED.has(mimeType)) {
      throw new BadRequestException('Unsupported file type');
    }
  }

  private async assertStorage(workspaceId: string, extraBytes: number) {
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
    });
    const next = workspace.storageUsedBytes + BigInt(extraBytes);
    if (next > BigInt(PLAN_LIMITS[workspace.plan].storageBytes)) {
      throw new PlanLimitException('storage', workspace.plan);
    }
  }
}

function extOf(mime: string): string {
  if (mime === 'image/png') return '.png';
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/gif') return '.gif';
  return '';
}
