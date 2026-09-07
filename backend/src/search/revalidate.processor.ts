import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

@Processor('revalidate')
export class RevalidateProcessor extends WorkerHost {
  private readonly logger = new Logger(RevalidateProcessor.name);

  async process(
    job: Job<{ slug?: string; documentId: string }>,
  ): Promise<void> {
    this.logger.log(
      `ISR revalidate queued for ${job.data.slug ?? job.data.documentId}`,
    );
  }
}
