import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { SearchService } from './search.service';

@Processor('search-sync')
export class SearchProcessor extends WorkerHost {
  constructor(private readonly search: SearchService) {
    super();
  }

  async process(job: Job<{ documentId: string }>): Promise<void> {
    await this.search.indexDocument(job.data.documentId);
  }
}
