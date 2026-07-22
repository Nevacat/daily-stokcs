import { Module } from '@nestjs/common';
import { NewsModule } from '../news/news.module';
import { RecommendationModule } from '../recommendation/recommendation.module';
import { BriefingController } from './briefing.controller';
import { BriefingService } from './briefing.service';

@Module({
  imports: [NewsModule, RecommendationModule],
  controllers: [BriefingController],
  providers: [BriefingService],
})
export class BriefingModule {}
