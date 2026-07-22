import { Body, Controller, Delete, Param, Post } from '@nestjs/common';
import type { ApiResponse, DeviceRegistration } from '@daily-stocks/shared';
import { DevicesService } from './devices.service';

@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  /** 앱이 FCM 토큰을 받으면 등록 (apps/mobile/src/push/README.md 참고) */
  @Post()
  register(
    @Body() body: { token?: string; platform?: string },
  ): ApiResponse<DeviceRegistration> {
    return { data: this.devicesService.register(body) };
  }

  @Delete(':token')
  unregister(@Param('token') token: string): ApiResponse<{ removed: true }> {
    this.devicesService.unregister(token);
    return { data: { removed: true } };
  }
}
