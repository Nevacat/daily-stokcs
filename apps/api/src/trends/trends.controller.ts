import { Controller, Get, Query } from '@nestjs/common';
import type { ApiResponse, SentimentTrend } from '@daily-stocks/shared';
import { TrendsService } from './trends.service';

@Controller('trends')
export class TrendsController {
  constructor(private readonly trendsService: TrendsService) {}

  /** GET /trends?ticker=005930 또는 /trends?sector=battery */
  @Get()
  get(
    @Query('ticker') ticker?: string,
    @Query('sector') sector?: string,
  ): ApiResponse<SentimentTrend> {
    return { data: this.trendsService.build({ ticker, sector }) };
  }
}
