import { Module } from '@nestjs/common';
import { FavoritesModule } from '../favorites/favorites.module';
import { PriceModule } from '../price/price.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

/**
 * 실적·배당 예정 이벤트. PriceService(Yahoo 배당 이력)와 FavoritesService를
 * 동시에 필요로 하는 유일한 리소스라 독립 모듈로 둔다.
 * (CatalogModule·AuthModule은 @Global 이라 import 불필요)
 */
@Module({
  imports: [PriceModule, FavoritesModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
