import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BadRequestException } from '@nestjs/common';
import type { Recommendation } from '@daily-stocks/shared';
import { DevicesService } from './devices.service';
import { NotificationService } from './notification.service';

const rec: Recommendation = {
  id: '005930',
  ticker: '005930',
  stockName: '삼성전자',
  sector: 'semiconductor_ai',
  score: 80,
  reason: '테스트',
  newsIds: [],
  recommendedAt: '2026-07-22T05:00:00Z',
};

describe('DevicesService', () => {
  let service: DevicesService;

  beforeEach(() => {
    process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-test-'));
    service = new DevicesService();
  });

  it('토큰을 등록하고 같은 토큰은 갱신 처리한다', () => {
    service.register({ token: 't1', platform: 'ios' });
    service.register({ token: 't1', platform: 'android' });
    expect(service.list()).toHaveLength(1);
    expect(service.list()[0].platform).toBe('android');
  });

  it('토큰/플랫폼이 유효하지 않으면 INVALID_BODY', () => {
    expect(() => service.register({ token: '', platform: 'ios' })).toThrow(
      BadRequestException,
    );
    expect(() => service.register({ token: 't1', platform: 'web' })).toThrow(
      BadRequestException,
    );
  });

  it('등록 해제하면 목록에서 제거된다', () => {
    service.register({ token: 't1', platform: 'ios' });
    service.unregister('t1');
    expect(service.list()).toHaveLength(0);
  });
});

describe('NotificationService', () => {
  beforeEach(() => {
    process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'noti-test-'));
    delete process.env.FCM_SERVICE_ACCOUNT_PATH;
  });

  it('FCM 미설정이면 발송을 건너뛴다 (에러 없음)', async () => {
    const service = new NotificationService(new DevicesService());
    expect(service.enabled).toBe(false);
    const result = await service.notifyNewFavoriteRecommendations([rec]);
    expect(result).toEqual({ sent: 0, skipped: true });
  });

  it('알릴 추천이 없으면 아무것도 하지 않는다', async () => {
    const service = new NotificationService(new DevicesService());
    const result = await service.notifyNewFavoriteRecommendations([]);
    expect(result).toEqual({ sent: 0, skipped: false });
  });
});
