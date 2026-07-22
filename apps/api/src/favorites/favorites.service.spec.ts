import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BadRequestException } from '@nestjs/common';
import { FavoritesService } from './favorites.service';

describe('FavoritesService', () => {
  let service: FavoritesService;

  beforeEach(() => {
    process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'fav-test-'));
    service = new FavoritesService();
  });

  it('초기 상태는 빈 관심 목록', () => {
    expect(service.get()).toEqual({ tickers: [], sectors: [] });
  });

  it('토글로 관심 종목을 추가/제거한다', () => {
    expect(service.toggleTicker('005930').tickers).toEqual(['005930']);
    expect(service.toggleTicker('005930').tickers).toEqual([]);
  });

  it('중복 종목은 한 번만 저장된다', () => {
    const result = service.update({ tickers: ['005930', '005930', '000660'] });
    expect(result.tickers).toEqual(['005930', '000660']);
  });

  it('사전에 없는 종목은 UNKNOWN_TICKER 에러', () => {
    expect(() => service.update({ tickers: ['999999'] })).toThrow(
      BadRequestException,
    );
  });

  it('알 수 없는 섹터는 UNKNOWN_SECTOR 에러', () => {
    expect(() => service.update({ sectors: ['없는섹터' as never] })).toThrow(
      BadRequestException,
    );
  });

  it('저장 후 새 인스턴스에서도 유지된다 (파일 영속성)', () => {
    service.toggleTicker('005930');
    const reloaded = new FavoritesService();
    expect(reloaded.get().tickers).toEqual(['005930']);
  });
});
