import { PriceService } from './price.service';

describe('PriceService', () => {
  const originalKey = process.env.KIS_APP_KEY;
  const originalSecret = process.env.KIS_APP_SECRET;

  afterEach(() => {
    process.env.KIS_APP_KEY = originalKey;
    process.env.KIS_APP_SECRET = originalSecret;
  });

  it('키가 없으면 비활성 상태이고 null을 반환한다', async () => {
    delete process.env.KIS_APP_KEY;
    delete process.env.KIS_APP_SECRET;
    const service = new PriceService();
    expect(service.enabled).toBe(false);
    expect(await service.getPrice('005930')).toBeNull();
  });

  it('getPrices는 중복 티커를 한 번만 조회한다', async () => {
    delete process.env.KIS_APP_KEY;
    const service = new PriceService();
    const spy = jest.spyOn(service, 'getPrice');
    const prices = await service.getPrices(['005930', '005930', '000660']);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(prices.get('005930')).toBeNull();
    expect(prices.size).toBe(2);
  });
});
