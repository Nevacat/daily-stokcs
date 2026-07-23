import { Controller, Get, Param, Query } from '@nestjs/common';
import type {
  ApiResponse,
  CatalogStockLite,
  StockDetail,
} from '@daily-stocks/shared';
import { CatalogService } from '../catalog/catalog.service';
import { StocksService } from './stocks.service';

@Controller('stocks')
export class StocksController {
  constructor(
    private readonly stocksService: StocksService,
    private readonly catalog: CatalogService,
  ) {}

  /** 전체 종목 경량 카탈로그 — 앱이 캐시해 검색·이름 표시에 사용 */
  @Get('catalog')
  list(): ApiResponse<CatalogStockLite[]> {
    return {
      data: this.catalog
        .list()
        .map(({ ticker, name, market }) => ({ ticker, name, market })),
    };
  }

  /** 종목 검색 (이름/티커) */
  @Get('search')
  search(@Query('q') q?: string): ApiResponse<CatalogStockLite[]> {
    return {
      data: this.catalog
        .search(q ?? '')
        .map(({ ticker, name, market }) => ({ ticker, name, market })),
    };
  }

  @Get(':ticker')
  async detail(
    @Param('ticker') ticker: string,
  ): Promise<ApiResponse<StockDetail>> {
    return { data: await this.stocksService.detail(ticker) };
  }
}
