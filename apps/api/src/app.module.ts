import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BriefingModule } from './briefing/briefing.module';
import { CollectModule } from './collect/collect.module';
import { FavoritesModule } from './favorites/favorites.module';
import { HistoryModule } from './history/history.module';
import { NewsModule } from './news/news.module';
import { RecommendationModule } from './recommendation/recommendation.module';
import { SettingsModule } from './settings/settings.module';
import { TrendsModule } from './trends/trends.module';

@Module({
  imports: [
    NewsModule,
    CollectModule,
    RecommendationModule,
    SettingsModule,
    FavoritesModule,
    HistoryModule,
    BriefingModule,
    TrendsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
