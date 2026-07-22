import { BadRequestException, Injectable } from '@nestjs/common';
import type { CollectSettings } from '@daily-stocks/shared';
import { ALLOWED_INTERVALS } from '@daily-stocks/shared';
import { JsonStore } from '../common/json-store';

const DEFAULT_SETTINGS: CollectSettings = { intervalMinutes: 60 };

@Injectable()
export class SettingsService {
  private readonly store = new JsonStore<CollectSettings>('settings');
  private settings: CollectSettings = this.store.load() ?? DEFAULT_SETTINGS;
  private readonly listeners: ((s: CollectSettings) => void)[] = [];

  get(): CollectSettings {
    return this.settings;
  }

  update(input: Partial<CollectSettings>): CollectSettings {
    const interval = input.intervalMinutes;
    if (interval !== null && !ALLOWED_INTERVALS.includes(interval as never)) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_INTERVAL',
          message: `intervalMinutes는 ${ALLOWED_INTERVALS.join(', ')} 또는 null(끄기)만 가능합니다.`,
        },
      });
    }
    this.settings = { intervalMinutes: interval ?? null };
    this.store.save(this.settings);
    this.listeners.forEach((cb) => cb(this.settings));
    return this.settings;
  }

  /** 설정 변경 시 알림 (스케줄러 재조정용 — 순환 의존 없이 연결) */
  onChange(cb: (s: CollectSettings) => void): void {
    this.listeners.push(cb);
  }
}
