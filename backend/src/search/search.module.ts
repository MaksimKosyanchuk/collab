import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SearchController } from './search.controller';
import { SearchProcessor } from './search.processor';
import { SearchService } from './search.service';
import { RevalidateProcessor } from './revalidate.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'search-sync' }),
    BullModule.registerQueue({ name: 'revalidate' }),
  ],
  controllers: [SearchController],
  providers: [SearchService, SearchProcessor, RevalidateProcessor],
  exports: [SearchService],
})
export class SearchModule {}
