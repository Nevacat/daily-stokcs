import { Module } from '@nestjs/common';
import { FavoritesModule } from '../favorites/favorites.module';
import { HistoryModule } from '../history/history.module';
import { NewsModule } from '../news/news.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PriceModule } from '../price/price.module';
import { RecommendationModule } from '../recommendation/recommendation.module';
import { SettingsModule } from '../settings/settings.module';
import { AnalyzerService } from './analyzer/analyzer.service';
import { CollectController } from './collect.controller';
import { CollectService } from './collect.service';
import { RssCollectorService } from './rss-collector.service';

@Module({
  imports: [
    NewsModule,
    RecommendationModule,
    SettingsModule,
    HistoryModule,
    PriceModule,
    FavoritesModule,
    NotificationsModule,
  ],
  controllers: [CollectController],
  providers: [CollectService, RssCollectorService, AnalyzerService],
})
export class CollectModule {}
