import { Body, Controller, Get, Put } from '@nestjs/common';
import type { ApiResponse, CollectSettings } from '@daily-stocks/shared';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  get(): ApiResponse<CollectSettings> {
    return { data: this.settingsService.get() };
  }

  @Put()
  update(@Body() body: Partial<CollectSettings>): ApiResponse<CollectSettings> {
    return { data: this.settingsService.update(body) };
  }
}
