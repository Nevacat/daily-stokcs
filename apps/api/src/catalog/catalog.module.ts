import { Global, Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';

/** Global — 분석기·시세·종목 상세 등 여러 모듈이 카탈로그를 쓴다 */
@Global()
@Module({
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
