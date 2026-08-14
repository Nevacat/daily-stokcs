import { Controller, Get } from '@nestjs/common';
import type {
  ApiResponse,
  DailyBriefing,
  NightBriefing,
} from '@daily-stocks/shared';
import { BriefingService } from './briefing.service';

@Controller('briefing')
export class BriefingController {
  constructor(private readonly briefingService: BriefingService) {}

  @Get()
  get(): ApiResponse<DailyBriefing> {
    const briefing = this.briefingService.build();
    return { data: briefing, meta: { collectedAt: briefing.generatedAt } };
  }

  /** 나이트 브리핑 (KST 21:00~05:59 홈 슬롯) — 데이터가 없어도 항상 200 */
  @Get('night')
  night(): ApiResponse<NightBriefing> {
    const briefing = this.briefingService.buildNight();
    return { data: briefing, meta: { collectedAt: briefing.generatedAt } };
  }
}
