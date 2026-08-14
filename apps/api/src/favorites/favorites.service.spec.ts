import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BadRequestException } from '@nestjs/common';
import type { Favorites, StockQuote } from '@daily-stocks/shared';
import { CatalogService } from '../catalog/catalog.service';
import { PriceService } from '../price/price.service';
import { FavoritesService } from './favorites.service';

const U1 = 'user-1';
const U2 = 'user-2';

/** 시세 스텁 — 외부 호출 없이 담은 시점 가격/현재가를 고정한다 */
function priceStub(prices: Record<string, number | null>): PriceService {
  const quote = (ticker: string): StockQuote | null => {
    const price = prices[ticker];
    return price == null
      ? null
      : {
          ticker,
          price,
          previousClose: price,
          changePct: 0,
          currency: ticker.match(/^\d/) ? 'KRW' : 'USD',
          at: '2026-08-11T00:00:00.000Z',
        };
  };
  return {
    getPrice: (ticker: string) => Promise.resolve(prices[ticker] ?? null),
    getQuotes: (tickers: string[]) =>
      Promise.resolve(
        Object.fromEntries(tickers.map((t) => [t, quote(t)] as const)),
      ),
  } as unknown as PriceService;
}

describe('FavoritesService (사용자별)', () => {
  let dataDir: string;
  let service: FavoritesService;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fav-test-'));
    process.env.DATA_DIR = dataDir;
    service = new FavoritesService(
      new CatalogService(),
      priceStub({ '005930': 71200, '000660': 200000, NVDA: 150 }),
    );
  });

  /** 구버전 저장 파일(entries 없음)을 미리 심어둔다 */
  const seedLegacy = (favorites: Record<string, Favorites>): void => {
    fs.writeFileSync(
      path.join(dataDir, 'favorites.json'),
      JSON.stringify(favorites),
    );
  };

  it('초기 상태는 빈 관심 목록', () => {
    expect(service.get(U1)).toEqual({ tickers: [], sectors: [] });
  });

  it('토글로 관심 종목을 추가/제거한다', async () => {
    expect((await service.toggleTicker(U1, '005930')).tickers).toEqual([
      '005930',
    ]);
    expect((await service.toggleTicker(U1, '005930')).tickers).toEqual([]);
  });

  it('사용자별로 분리 저장된다', async () => {
    await service.toggleTicker(U1, '005930');
    await service.toggleTicker(U2, 'NVDA');
    expect(service.get(U1).tickers).toEqual(['005930']);
    expect(service.get(U2).tickers).toEqual(['NVDA']);
  });

  it('allFavoriteTickers는 전체 사용자 합집합', async () => {
    await service.toggleTicker(U1, '005930');
    await service.toggleTicker(U2, '005930');
    await service.toggleTicker(U2, 'NVDA');
    expect([...service.allFavoriteTickers()].sort()).toEqual([
      '005930',
      'NVDA',
    ]);
  });

  it('회원 탈퇴 시 해당 사용자 데이터만 삭제된다', async () => {
    await service.toggleTicker(U1, '005930');
    await service.toggleTicker(U2, 'NVDA');
    service.removeUser(U1);
    expect(service.get(U1).tickers).toEqual([]);
    expect(service.get(U2).tickers).toEqual(['NVDA']);
  });

  it('중복 종목은 한 번만 저장된다', async () => {
    const result = await service.update(U1, {
      tickers: ['005930', '005930', '000660'],
    });
    expect(result.tickers).toEqual(['005930', '000660']);
  });

  it('배열이 아닌 body는 INVALID_BODY 에러', async () => {
    await expect(service.update(U1, { tickers: 123 as never })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('사전에 없는 종목은 UNKNOWN_TICKER 에러', async () => {
    await expect(service.update(U1, { tickers: ['999999'] })).rejects.toThrow(
      BadRequestException,
    );
  });

  describe('동시 쓰기 (같은 사용자의 토글이 겹칠 때)', () => {
    /** 시세 조회에 실제 지연을 준다 — Yahoo HTTP 호출이 끼어드는 상황 재현 */
    const slowPriceStub = (prices: Record<string, number>): PriceService =>
      ({
        getPrice: (ticker: string) =>
          new Promise((resolve) =>
            setTimeout(() => resolve(prices[ticker] ?? null), 20),
          ),
      }) as unknown as PriceService;

    it('겹친 두 토글이 서로를 덮어쓰지 않는다', async () => {
      const slow = new FavoritesService(
        new CatalogService(),
        slowPriceStub({ '005930': 71200, '000660': 200000 }),
      );

      // await 없이 동시에 던진다 (t=0, t≈0 두 요청)
      await Promise.all([
        slow.toggleTicker(U1, '005930'),
        slow.toggleTicker(U1, '000660'),
      ]);

      expect([...slow.get(U1).tickers].sort()).toEqual(['000660', '005930']);
      // 파일에도 둘 다 남아야 한다 (유실이 영속되면 안 된다)
      expect(
        [...new FavoritesService(new CatalogService()).get(U1).tickers].sort(),
      ).toEqual(['000660', '005930']);
    });

    it('겹친 토글의 담은 시점 기록도 둘 다 남는다', async () => {
      const slow = new FavoritesService(
        new CatalogService(),
        slowPriceStub({ '005930': 71200, '000660': 200000 }),
      );

      await Promise.all([
        slow.toggleTicker(U1, '005930'),
        slow.toggleTicker(U1, '000660'),
      ]);

      const entries = slow.get(U1).entries ?? {};
      expect(entries['005930']?.priceAtAdd).toBe(71200);
      expect(entries['000660']?.priceAtAdd).toBe(200000);
    });

    it('앞 요청이 400으로 끝나도 뒤 요청이 대기열에 갇히지 않는다', async () => {
      const rejected = service.update(U1, { tickers: ['999999'] });
      const next = service.toggleTicker(U1, '005930');

      await expect(rejected).rejects.toThrow(BadRequestException);
      await expect(next).resolves.toMatchObject({ tickers: ['005930'] });
    });

    it('다른 사용자끼리는 서로를 막지 않는다 (전역 락 아님)', async () => {
      const slow = new FavoritesService(
        new CatalogService(),
        slowPriceStub({ '005930': 71200, NVDA: 150 }),
      );

      await Promise.all([
        slow.toggleTicker(U1, '005930'),
        slow.toggleTicker(U2, 'NVDA'),
      ]);

      expect(slow.get(U1).tickers).toEqual(['005930']);
      expect(slow.get(U2).tickers).toEqual(['NVDA']);
    });
  });

  it('저장 후 새 인스턴스에서도 유지된다 (파일 영속성)', async () => {
    await service.toggleTicker(U1, '005930');
    expect(new FavoritesService(new CatalogService()).get(U1).tickers).toEqual([
      '005930',
    ]);
  });

  describe('담은 시점 기록 (모의 포트폴리오)', () => {
    it('새로 담으면 담은 시각과 그 시점 가격이 기록된다', async () => {
      const before = Date.now();
      const result = await service.toggleTicker(U1, '005930');
      const entry = result.entries?.['005930'];
      expect(entry?.priceAtAdd).toBe(71200);
      expect(Date.parse(entry!.addedAt)).toBeGreaterThanOrEqual(before);
    });

    it('시세 조회 실패해도 담기는 성공하고 priceAtAdd만 null', async () => {
      const noPrice = new FavoritesService(new CatalogService(), priceStub({}));
      const result = await noPrice.toggleTicker(U1, '005930');
      expect(result.tickers).toEqual(['005930']);
      expect(result.entries?.['005930'].priceAtAdd).toBeNull();
    });

    it('해제하면 기록도 지워지고, 다시 담으면 새로 기록된다', async () => {
      const added = await service.toggleTicker(U1, '005930');
      const firstAddedAt = added.entries!['005930'].addedAt;

      expect((await service.toggleTicker(U1, '005930')).entries).toEqual({});

      const readded = await service.toggleTicker(U1, '005930');
      expect(
        Date.parse(readded.entries!['005930'].addedAt),
      ).toBeGreaterThanOrEqual(Date.parse(firstAddedAt));
    });

    it('구버전 데이터(entries 없음)는 마이그레이션 없이 그대로 읽힌다', () => {
      seedLegacy({ [U1]: { tickers: ['005930'], sectors: [] } });
      const legacy = new FavoritesService(
        new CatalogService(),
        priceStub({ '005930': 71200 }),
      );
      expect(legacy.get(U1)).toEqual({ tickers: ['005930'], sectors: [] });
    });

    it('이미 담겨 있던 구버전 종목에 담은 시각을 지어내지 않는다', async () => {
      seedLegacy({ [U1]: { tickers: ['005930'], sectors: [] } });
      const legacy = new FavoritesService(
        new CatalogService(),
        priceStub({ '005930': 71200, NVDA: 150 }),
      );

      const result = await legacy.toggleTicker(U1, 'NVDA');

      expect(result.entries?.['005930']).toBeUndefined(); // 백필 금지
      expect(result.entries?.NVDA.priceAtAdd).toBe(150); // 새로 담은 것만 기록
    });
  });

  describe('portfolio (가상 등락률)', () => {
    it('관심 종목이 없으면 빈 포트폴리오', async () => {
      const portfolio = await service.portfolio(U1);
      expect(portfolio.positions).toEqual([]);
      expect(portfolio.averageChangePct).toBeNull();
      expect(portfolio.measuredCount).toBe(0);
    });

    it('담은 시점 대비 등락률과 평균을 계산한다', async () => {
      await service.toggleTicker(U1, '005930'); // 담을 때 71200

      // 현재가만 74700으로 오른 상태를 만든다 (담은 기록은 파일에 남아 있다)
      const later = new FavoritesService(
        new CatalogService(),
        priceStub({ '005930': 74700 }),
      );
      const portfolio = await later.portfolio(U1);

      expect(portfolio.positions[0]).toMatchObject({
        ticker: '005930',
        priceAtAdd: 71200,
        currentPrice: 74700,
        currency: 'KRW',
        changePct: 4.92,
      });
      expect(portfolio.averageChangePct).toBe(4.92);
      expect(portfolio.measuredCount).toBe(1);
    });

    it('계산 불가 종목은 평균에서 빠지고 measuredCount로 기준 수를 알린다', async () => {
      seedLegacy({ [U1]: { tickers: ['000660'], sectors: [] } }); // 구버전 종목
      const mixed = new FavoritesService(
        new CatalogService(),
        priceStub({ '005930': 71200, '000660': 200000 }),
      );
      await mixed.toggleTicker(U1, '005930'); // 71200에 담김

      const later = new FavoritesService(
        new CatalogService(),
        priceStub({ '005930': 78320, '000660': 200000 }),
      );
      const portfolio = await later.portfolio(U1);

      const legacyPosition = portfolio.positions.find(
        (p) => p.ticker === '000660',
      );
      expect(legacyPosition).toMatchObject({
        addedAt: null,
        priceAtAdd: null,
        changePct: null,
      });
      expect(portfolio.averageChangePct).toBe(10); // 71200 → 78320
      expect(portfolio.measuredCount).toBe(1);
    });
  });
});
