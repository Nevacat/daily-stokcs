import { Controller, Get } from '@nestjs/common';
import type { ApiResponse, DailyBriefing } from '@daily-stocks/shared';
import { BriefingService } from './briefing.service';

@Controller('briefing')
export class BriefingController {
  constructor(private readonly briefingService: BriefingService) {}

  @Get()
  get(): ApiResponse<DailyBriefing> {
    const briefing = this.briefingService.build();
    return { data: briefing, meta: { collectedAt: briefing.generatedAt } };
  }
}
