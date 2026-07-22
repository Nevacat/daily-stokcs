import { BadRequestException, Injectable } from '@nestjs/common';
import type { DeviceRegistration } from '@daily-stocks/shared';
import { JsonStore } from '../common/json-store';

/** 푸시 수신 디바이스 토큰 저장소 (기획서 §3.2) */
@Injectable()
export class DevicesService {
  private readonly store = new JsonStore<DeviceRegistration[]>('devices');
  private devices: DeviceRegistration[] = this.store.load() ?? [];

  list(): DeviceRegistration[] {
    return this.devices;
  }

  register(input: { token?: unknown; platform?: unknown }): DeviceRegistration {
    const { token, platform } = input;
    if (typeof token !== 'string' || token.length === 0) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_BODY',
          message: 'token은 비어있지 않은 문자열이어야 합니다.',
        },
      });
    }
    if (platform !== 'ios' && platform !== 'android') {
      throw new BadRequestException({
        error: {
          code: 'INVALID_BODY',
          message: "platform은 'ios' 또는 'android'여야 합니다.",
        },
      });
    }

    const device: DeviceRegistration = {
      token,
      platform,
      registeredAt: new Date().toISOString(),
    };
    // 같은 토큰 재등록은 갱신으로 처리
    this.devices = [...this.devices.filter((d) => d.token !== token), device];
    this.store.save(this.devices);
    return device;
  }

  unregister(token: string): void {
    this.devices = this.devices.filter((d) => d.token !== token);
    this.store.save(this.devices);
  }
}
