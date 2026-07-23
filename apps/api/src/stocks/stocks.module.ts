import { Module } from '@nestjs/common';
import { NewsModule } from '../news/news.module';
import { PriceModule } from '../price/price.module';
import { RecommendationModule } from '../recommendation/recommendation.module';
import { TrendsModule } from '../trends/trends.module';
import { StocksController } from './stocks.controller';
import { StocksService } from './stocks.service';

@Module({
  imports: [NewsModule, RecommendationModule, TrendsModule, PriceModule],
  controllers: [StocksController],
  providers: [StocksService],
})
export class StocksModule {}
