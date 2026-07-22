import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BadRequestException } from '@nestjs/common';
import { FavoritesService } from './favorites.service';

const U1 = 'user-1';
const U2 = 'user-2';

describe('FavoritesService (사용자별)', () => {
  let service: FavoritesService;

  beforeEach(() => {
    process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'fav-test-'));
    service = new FavoritesService();
  });

  it('초기 상태는 빈 관심 목록', () => {
    expect(service.get(U1)).toEqual({ tickers: [], sectors: [] });
  });

  it('토글로 관심 종목을 추가/제거한다', () => {
    expect(service.toggleTicker(U1, '005930').tickers).toEqual(['005930']);
    expect(service.toggleTicker(U1, '005930').tickers).toEqual([]);
  });

  it('사용자별로 분리 저장된다', () => {
    service.toggleTicker(U1, '005930');
    service.toggleTicker(U2, 'NVDA');
    expect(service.get(U1).tickers).toEqual(['005930']);
    expect(service.get(U2).tickers).toEqual(['NVDA']);
  });

  it('allFavoriteTickers는 전체 사용자 합집합', () => {
    service.toggleTicker(U1, '005930');
    service.toggleTicker(U2, '005930');
    service.toggleTicker(U2, 'NVDA');
    expect([...service.allFavoriteTickers()].sort()).toEqual([
      '005930',
      'NVDA',
    ]);
  });

  it('회원 탈퇴 시 해당 사용자 데이터만 삭제된다', () => {
    service.toggleTicker(U1, '005930');
    service.toggleTicker(U2, 'NVDA');
    service.removeUser(U1);
    expect(service.get(U1).tickers).toEqual([]);
    expect(service.get(U2).tickers).toEqual(['NVDA']);
  });

  it('중복 종목은 한 번만 저장된다', () => {
    const result = service.update(U1, {
      tickers: ['005930', '005930', '000660'],
    });
    expect(result.tickers).toEqual(['005930', '000660']);
  });

  it('배열이 아닌 body는 INVALID_BODY 에러', () => {
    expect(() => service.update(U1, { tickers: 123 as never })).toThrow(
      BadRequestException,
    );
  });

  it('사전에 없는 종목은 UNKNOWN_TICKER 에러', () => {
    expect(() => service.update(U1, { tickers: ['999999'] })).toThrow(
      BadRequestException,
    );
  });

  it('저장 후 새 인스턴스에서도 유지된다 (파일 영속성)', () => {
    service.toggleTicker(U1, '005930');
    expect(new FavoritesService().get(U1).tickers).toEqual(['005930']);
  });
});
