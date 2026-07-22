import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BadRequestException } from '@nestjs/common';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(() => {
    process.env.DATA_DIR = fs.mkdtempSync(
      path.join(os.tmpdir(), 'settings-test-'),
    );
    service = new SettingsService();
  });

  it('기본값은 60분', () => {
    expect(service.get()).toEqual({ intervalMinutes: 60 });
  });

  it('허용된 주기로 변경하면 리스너에 통지된다', () => {
    const listener = jest.fn();
    service.onChange(listener);
    service.update({ intervalMinutes: 30 });
    expect(service.get().intervalMinutes).toBe(30);
    expect(listener).toHaveBeenCalledWith({ intervalMinutes: 30 });
  });

  it('null은 자동 수집 끄기로 허용된다', () => {
    expect(
      service.update({ intervalMinutes: null }).intervalMinutes,
    ).toBeNull();
  });

  it('필드를 누락하면(undefined) 기존값을 유지하고 에러가 아니다', () => {
    service.update({ intervalMinutes: 180 });
    expect(service.update({})).toEqual({ intervalMinutes: 180 });
  });

  it('허용 목록 밖 값은 INVALID_INTERVAL 에러', () => {
    expect(() => service.update({ intervalMinutes: 45 as never })).toThrow(
      BadRequestException,
    );
  });

  it('저장 후 새 인스턴스에서도 유지된다 (파일 영속성)', () => {
    service.update({ intervalMinutes: 1440 });
    expect(new SettingsService().get().intervalMinutes).toBe(1440);
  });
});
