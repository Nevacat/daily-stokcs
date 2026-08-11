import { Controller, Get, Param, Query } from '@nestjs/common';
import type {
  ApiResponse,
  CatalogStockLite,
  StockComparison,
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

  /**
   * 종목 비교 (2~3개).
   * ⚠️ 이 핸들러는 반드시 @Get(':ticker') 위에 있어야 한다 —
   *    아래에 두면 'compare'가 티커로 매칭돼 UNKNOWN_TICKER가 난다.
   *    stocks.service.spec.ts 의 라우트 순서 테스트가 이를 잠근다.
   */
  @Get('compare')
  async compare(
    @Query('tickers') tickers?: string,
  ): Promise<ApiResponse<StockComparison[]>> {
    const list = (tickers ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    return { data: await this.stocksService.compare(list) };
  }

  @Get(':ticker')
  async detail(
    @Param('ticker') ticker: string,
  ): Promise<ApiResponse<StockDetail>> {
    return { data: await this.stocksService.detail(ticker) };
  }
}
