import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import type { ApiResponse, StockQuote } from '@daily-stocks/shared';
import { PriceService } from './price.service';

const MAX_TICKERS = 30;

@Controller('quotes')
export class QuotesController {
  constructor(private readonly priceService: PriceService) {}

  /** GET /quotes?tickers=005930,NVDA — 시세 일괄 조회 */
  @Get()
  async list(
    @Query('tickers') tickers?: string,
  ): Promise<ApiResponse<Record<string, StockQuote | null>>> {
    const list = (tickers ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (list.length === 0 || list.length > MAX_TICKERS) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_BODY',
          message: `tickers는 1~${MAX_TICKERS}개의 콤마 구분 목록이어야 합니다.`,
        },
      });
    }
    return { data: await this.priceService.getQuotes(list) };
  }
}
