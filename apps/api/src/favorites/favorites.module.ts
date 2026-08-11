import { Module } from '@nestjs/common';
import { PriceModule } from '../price/price.module';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';

@Module({
  // 담은 시점 가격 기록 + 포트폴리오 현재가 조회용 (PriceModule 은 Favorites 를 모른다 — 순환 없음)
  imports: [PriceModule],
  controllers: [FavoritesController],
  providers: [FavoritesService],
  exports: [FavoritesService],
})
export class FavoritesModule {}
