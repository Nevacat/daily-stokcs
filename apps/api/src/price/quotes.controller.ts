import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import type {
  ApiResponse,
  ChartRange,
  PriceChart,
  StockQuote,
} from '@daily-stocks/shared';
import { CHART_RANGES } from '@daily-stocks/shared';
import { PriceService } from './price.service';

const MAX_TICKERS = 30;

/** `?tickers=a,b,c` 파싱 + 개수 검증 (quotes / spark 공용) */
function parseTickers(raw?: string): string[] {
  const list = (raw ?? '')
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
  return list;
}

@Controller('quotes')
export class QuotesController {
  constructor(private readonly priceService: PriceService) {}

  /** GET /quotes/chart?ticker=005930&range=1d — 주가 차트 */
  @Get('chart')
  async chart(
    @Query('ticker') ticker?: string,
    @Query('range') range?: string,
  ): Promise<ApiResponse<PriceChart | null>> {
    if (!ticker || (range && !CHART_RANGES.includes(range as ChartRange))) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_BODY',
          message: `ticker는 필수이고 range는 ${CHART_RANGES.join(', ')} 중 하나여야 합니다.`,
        },
      });
    }
    return {
      data: await this.priceService.getChart(
        ticker,
        (range as ChartRange) ?? '1d',
      ),
    };
  }

  /** GET /quotes/spark?tickers=005930,NVDA — 카드용 종가 스파크라인 (외부 호출 1회) */
  @Get('spark')
  async spark(
    @Query('tickers') tickers?: string,
  ): Promise<ApiResponse<Record<string, number[]>>> {
    return { data: await this.priceService.getSparks(parseTickers(tickers)) };
  }

  /** GET /quotes?tickers=005930,NVDA — 시세 일괄 조회 */
  @Get()
  async list(
    @Query('tickers') tickers?: string,
  ): Promise<ApiResponse<Record<string, StockQuote | null>>> {
    return { data: await this.priceService.getQuotes(parseTickers(tickers)) };
  }
}
