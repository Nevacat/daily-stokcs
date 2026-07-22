import { Controller, Get, Query } from '@nestjs/common';
import type { ApiResponse, HistoryEntry } from '@daily-stocks/shared';
import { HistoryService } from './history.service';

@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  list(@Query('limit') limit?: string): ApiResponse<HistoryEntry[]> {
    return {
      data: this.historyService.list(limit ? Number(limit) : undefined),
    };
  }
}
