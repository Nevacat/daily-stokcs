import { Controller, Get, Post } from '@nestjs/common';
import type { ApiResponse, CollectRun } from '@daily-stocks/shared';
import { CollectService } from './collect.service';

@Controller('collect')
export class CollectController {
  constructor(private readonly collectService: CollectService) {}

  /** 수동 "지금 수집하기" (기획서 §2.1) */
  @Post()
  async collect(): Promise<ApiResponse<CollectRun>> {
    const run = await this.collectService.run('manual');
    const { nextCollectAt } = this.collectService.status();
    return { data: run, meta: { collectedAt: run.finishedAt, nextCollectAt } };
  }

  @Get('status')
  status(): ApiResponse<{ lastRun?: CollectRun }> {
    const { lastRun, nextCollectAt } = this.collectService.status();
    return {
      data: { lastRun },
      meta: { collectedAt: lastRun?.finishedAt, nextCollectAt },
    };
  }
}
