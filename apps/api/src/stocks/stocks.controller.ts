import { Controller, Get, Param } from '@nestjs/common';
import type { ApiResponse, StockDetail } from '@daily-stocks/shared';
import { StocksService } from './stocks.service';

@Controller('stocks')
export class StocksController {
  constructor(private readonly stocksService: StocksService) {}

  @Get(':ticker')
  async detail(
    @Param('ticker') ticker: string,
  ): Promise<ApiResponse<StockDetail>> {
    return { data: await this.stocksService.detail(ticker) };
  }
}
