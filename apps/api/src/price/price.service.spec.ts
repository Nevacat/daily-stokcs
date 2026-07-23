import { CatalogService } from '../catalog/catalog.service';
import { PriceService } from './price.service';

function yahooResponse(price: number, previousClose: number, currency = 'KRW') {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        chart: {
          result: [
            {
              meta: {
                regularMarketPrice: price,
                chartPreviousClose: previousClose,
                currency,
              },
            },
          ],
        },
      }),
  };
}

describe('PriceService (Yahoo 시세)', () => {
  let service: PriceService;
  let fetchMock: jest.Mock;
  const calledUrl = (i: number): string =>
    String((fetchMock.mock.calls as unknown as [string][])[i][0]);

  beforeEach(() => {
    service = new PriceService(new CatalogService());
    fetchMock = jest.fn().mockResolvedValue(yahooResponse(270000, 260000));
    // 외부 API는 목 처리 (rules/testing.md — 실제 API 호출 금지)
    global.fetch = fetchMock;
  });

  it('코스피 종목은 .KS 심볼로 조회하고 등락률을 계산한다', async () => {
    const quote = await service.getQuote('005930');
    expect(calledUrl(0)).toContain('005930.KS');
    expect(quote).toMatchObject({
      ticker: '005930',
      price: 270000,
      previousClose: 260000,
      changePct: 3.85, // (270000-260000)/260000 = 3.846… → 3.85
      currency: 'KRW',
    });
  });

  it('코스닥 종목은 .KQ, 미국 종목은 심볼 그대로 조회한다', async () => {
    await service.getQuote('247540'); // 에코프로비엠 (KOSDAQ)
    await service.getQuote('NVDA');
    expect(calledUrl(0)).toContain('247540.KQ');
    expect(calledUrl(1)).toContain('/NVDA?');
  });

  it('같은 종목 재조회는 캐시를 사용한다 (5분)', async () => {
    await service.getQuote('005930');
    await service.getQuote('005930');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('사전에 없는 종목·API 실패는 null', async () => {
    expect(await service.getQuote('999999')).toBeNull();
    fetchMock.mockRejectedValueOnce(new Error('network'));
    expect(await service.getQuote('NVDA')).toBeNull();
  });

  it('가격 데이터가 비정상이면 null (0 나누기 방어)', async () => {
    fetchMock.mockResolvedValueOnce(yahooResponse(100, 0));
    expect(await service.getQuote('005930')).toBeNull();
  });

  it('차트: 구간 매핑·null 종가 필터·기준선을 담아 반환한다', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          chart: {
            result: [
              {
                meta: { currency: 'KRW', chartPreviousClose: 260000 },
                timestamp: [1784800000, 1784800300, 1784800600],
                indicators: { quote: [{ close: [265000, null, 270000] }] },
              },
            ],
          },
        }),
    });
    const chart = await service.getChart('005930', '1d');
    expect(calledUrl(0)).toContain('005930.KS');
    expect(calledUrl(0)).toContain('range=1d&interval=5m');
    expect(chart?.points).toHaveLength(2); // null 종가 제외
    expect(chart?.previousClose).toBe(260000);
  });

  it('차트: 포인트가 1개 이하면 null, 캐시는 구간별로 분리된다', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          chart: {
            result: [{ timestamp: [], indicators: { quote: [{ close: [] }] } }],
          },
        }),
    });
    expect(await service.getChart('005930', '1d')).toBeNull();
    await service.getChart('005930', '1m'); // 다른 구간은 새로 조회
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(calledUrl(1)).toContain('range=1mo&interval=1d');
  });

  it('getPrices는 중복 티커를 한 번만 조회한다', async () => {
    const prices = await service.getPrices(['005930', '005930', 'NVDA']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(prices.get('005930')).toBe(270000);
  });
});
