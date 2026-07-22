import { Module } from '@nestjs/common';
import { NewsModule } from '../news/news.module';
import { TrendsController } from './trends.controller';
import { TrendsService } from './trends.service';

@Module({
  imports: [NewsModule],
  controllers: [TrendsController],
  providers: [TrendsService],
})
export class TrendsModule {}
