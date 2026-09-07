import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Processor('revalidate')
export class RevalidateProcessor extends WorkerHost {
  private readonly logger = new Logger(RevalidateProcessor.name);

  constructor(private readonly config: ConfigService) {
    super();
  }

  async process(
    job: Job<{ slug?: string; documentId: string }>,
  ): Promise<void> {
    const slug = job.data.slug;
    if (!slug) {
      this.logger.warn(
        `Skip revalidate: no slug for document ${job.data.documentId}`,
      );
      return;
    }

    const url =
      this.config.get<string>('NEXT_REVALIDATE_URL') ??
      'http://localhost:3000/api/revalidate';
    const secret = this.config.get<string>('REVALIDATE_SECRET') ?? '';

    if (!secret) {
      this.logger.warn(
        `REVALIDATE_SECRET missing; logged only for slug=${slug}`,
      );
      return;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-revalidate-secret': secret,
      },
      body: JSON.stringify({
        slug,
        documentId: job.data.documentId,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Next revalidate failed (${res.status}) for ${slug}: ${body}`,
      );
    }

    this.logger.log(`ISR revalidated public page /p/${slug}`);
  }
}
