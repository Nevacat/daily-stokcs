import { Controller, Get, Param } from '@nestjs/common';
import type { ApiResponse, StockDetail } from '@daily-stocks/shared';
import { StocksService } from './stocks.service';

@Controller('stocks')
export class StocksController {
  constructor(private readonly stocksService: StocksService) {}

  @Get(':ticker')
  detail(@Param('ticker') ticker: string): ApiResponse<StockDetail> {
    return { data: this.stocksService.detail(ticker) };
  }
}
