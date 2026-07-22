import { Module } from '@nestjs/common';
import { NewsModule } from '../news/news.module';
import { RecommendationController } from './recommendation.controller';
import { RecommendationService } from './recommendation.service';

@Module({
  imports: [NewsModule],
  controllers: [RecommendationController],
  providers: [RecommendationService],
  exports: [RecommendationService],
})
export class RecommendationModule {}
