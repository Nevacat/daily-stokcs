import { Controller, Get, Query } from '@nestjs/common';
import type { ApiResponse, HistoryEntry } from '@daily-stocks/shared';
import { PriceService } from '../price/price.service';
import { HistoryService } from './history.service';

@Controller('history')
export class HistoryController {
  constructor(
    private readonly historyService: HistoryService,
    private readonly priceService: PriceService,
  ) {}

  @Get()
  async list(
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<HistoryEntry[]>> {
    const entries = this.historyService.list(limit ? Number(limit) : undefined);
    // 주가 API 키가 설정된 경우에만 현재가·등락률이 채워진다 (없으면 null)
    const tickers = entries.flatMap((e) =>
      e.recommendations.map((r) => r.ticker),
    );
    const prices = await this.priceService.getPrices(tickers);
    return { data: HistoryService.applyPerformance(entries, prices) };
  }
}
