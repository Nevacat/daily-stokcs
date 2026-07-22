import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CollectModule } from './collect/collect.module';
import { NewsModule } from './news/news.module';
import { RecommendationModule } from './recommendation/recommendation.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [NewsModule, CollectModule, RecommendationModule, SettingsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
