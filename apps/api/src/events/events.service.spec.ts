import { BadRequestException, type ExecutionContext } from '@nestjs/common';
import type { CatalogStock } from '@daily-stocks/shared';
import { CatalogService } from '../catalog/catalog.service';
import { FavoritesService } from '../favorites/favorites.service';
import type { DividendPayment } from '../price/price.service';
import { PriceService } from '../price/price.service';
import { EventsController, TickersOrAuthGuard } from './events.controller';
import { EventsService, MAX_TICKERS } from './events.service';

const NOW = new Date('2026-08-11T03:40:00.000Z'); // KST 2026-08-11 12:40

const SAMSUNG: CatalogStock = {
  ticker: '005930',
  name: '삼성전자',
  market: 'KR',
  exchange: 'KOSPI',
};
const NVDA: CatalogStock = { ticker: 'NVDA', name: '엔비디아', market: 'US' };

/** KST 날짜 문자열 → epoch ms (ex-date는 날짜 단위라 자정으로 잡는다) */
const day = (date: string): number => Date.parse(`${date}T00:00:00+09:00`);

const payment = (date: string, amount = 370): DividendPayment => ({
  at: day(date),
  amount,
});

function makeService(
  dividends: Record<string, DividendPayment[]> = {},
  stocks: CatalogStock[] = [SAMSUNG],
): EventsService {
  const catalog = {
    find: (ticker: string) => stocks.find((s) => s.ticker === ticker) ?? null,
  } as unknown as CatalogService;
  const price = {
    getDividendDates: (ticker: string) =>
      Promise.resolve(dividends[ticker] ?? []),
  } as unknown as PriceService;
  const favorites = {
    get: () => ({ tickers: stocks.map((s) => s.ticker), sectors: [] }),
  } as unknown as FavoritesService;
  return new EventsService(catalog, price, favorites);
}

describe('EventsService', () => {
  it('배당 주기는 평균이 아니라 중앙값이라 특별배당 1회에 흔들리지 않는다', async () => {
    // 2024-06-01 특별배당 뒤 분기 배당 3회 — gap = [485, 91, 91, 91]일
    // 중앙값 91일 → 2026-09-28 / 평균 189.5일이면 2026-12월대라 90일 창 밖으로 밀린다
    const service = makeService({
      '005930': [
        payment('2024-06-01', 1000),
        payment('2025-09-29', 370),
        payment('2025-12-29', 566),
        payment('2026-03-30', 372),
        payment('2026-06-29', 374),
      ],
    });

    const events = await service.build(['005930'], NOW);
    const dividend = events.find((e) => e.kind === 'dividend');

    expect(dividend).toEqual({
      ticker: '005930',
      stockName: '삼성전자',
      kind: 'dividend',
      date: '2026-09-28',
      label: '배당 기준일 예상 (지난 배당 374원)',
    });
  });

  it('오래 배당하지 않은 종목의 추정일을 오늘 이후로 민다', async () => {
    // 마지막 배당이 6년 전 — 밀지 않으면 2020년 날짜가 나오고 창 밖이라 사라진다
    const service = makeService({
      '005930': [payment('2020-05-21'), payment('2020-06-20')], // gap 30일
    });

    const events = await service.build(['005930'], NOW);
    const dividend = events.find((e) => e.kind === 'dividend');

    expect(dividend).toBeDefined();
    expect(dividend!.date >= '2026-08-11').toBe(true);
    expect(dividend!.date <= '2026-11-09').toBe(true);
  });

  it('배당 이력이 1건 이하면 배당 이벤트를 만들지 않는다 (실적은 그대로)', async () => {
    const service = makeService({ '005930': [payment('2026-06-29')] });

    const events = await service.build(['005930'], NOW);

    expect(events.filter((e) => e.kind === 'dividend')).toEqual([]);
    expect(events.map((e) => e.date)).toEqual(['2026-08-14']);
  });

  it('90일 창 경계 — 마지막 날은 포함하고 하루 넘으면 제외한다', async () => {
    const service = makeService();
    const dates = async (kstDay: string): Promise<string[]> =>
      (await service.build(['005930'], new Date(`${kstDay}T00:00:00+09:00`)))
        .filter((e) => e.kind === 'earnings')
        .map((e) => e.date);

    // 08-16 +90일 = 11-14 → 경계 당일 포함
    expect(await dates('2026-08-16')).toEqual(['2026-11-14']);
    // 08-15 +90일 = 11-13 → 하루 차이로 제외
    expect(await dates('2026-08-15')).toEqual([]);
    // 창 시작도 당일 포함 (오늘이 공시 기한일 때 사라지면 안 된다)
    expect(await dates('2026-08-14')).toEqual(['2026-08-14']);
  });

  it('미국 종목은 실적 이벤트를 만들지 않는다 (추정 근거 없음)', async () => {
    const service = makeService(
      { NVDA: [payment('2026-03-05', 0.01), payment('2026-06-05', 0.01)] },
      [NVDA],
    );

    const events = await service.build(['NVDA'], NOW);

    expect(events).toEqual([
      {
        ticker: 'NVDA',
        stockName: '엔비디아',
        kind: 'dividend',
        date: '2026-09-05',
        label: '배당 기준일 예상 (지난 배당 $0.01)',
      },
    ]);
  });
});

describe('EventsController (tickers 쿼리 방어)', () => {
  /** 모든 티커를 아는 카탈로그 — 상한 처리만 보기 위한 스텁 */
  const anyCatalog = {
    find: (ticker: string): CatalogStock => ({
      ticker,
      name: ticker,
      market: 'KR',
      exchange: 'KOSPI',
    }),
  } as unknown as CatalogService;

  function makeController() {
    const build = jest.fn().mockResolvedValue([]);
    const forUser = jest.fn().mockResolvedValue([]);
    const controller = new EventsController(
      { build, forUser } as unknown as EventsService,
      anyCatalog,
    );
    return { controller, build, forUser };
  }

  it('tickers가 배열(?tickers=a&tickers=b)이면 500이 아니라 400', async () => {
    const { controller, build } = makeController();

    await expect(
      controller.list(undefined, ['005930', 'NVDA'] as unknown),
    ).rejects.toThrow(BadRequestException);
    expect(build).not.toHaveBeenCalled();
  });

  it('가드도 배열 tickers를 공개 조회로 인정한다 (401 아님)', () => {
    const guard = new TickersOrAuthGuard(null as never);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ query: { tickers: ['005930', 'NVDA'] } }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('빈 tickers는 400 (관심 종목 조회와 구분이 안 된다)', async () => {
    const { controller } = makeController();
    await expect(controller.list(undefined, ' , ')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('상한을 넘는 tickers는 400이 아니라 잘라서 조회한다 (forUser 경로와 동일)', async () => {
    const { controller, build } = makeController();
    const tickers = Array.from({ length: MAX_TICKERS + 5 }, (_, i) => `T${i}`);

    await expect(
      controller.list(undefined, tickers.join(',')),
    ).resolves.toEqual({
      data: [],
      meta: { collectedAt: expect.any(String) as string },
    });
    expect(build).toHaveBeenCalledWith(tickers.slice(0, MAX_TICKERS));
  });
});
