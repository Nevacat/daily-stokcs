import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { NotFoundException } from '@nestjs/common';
import type { NewsItem } from '@daily-stocks/shared';
import { CatalogService } from '../catalog/catalog.service';
import { NewsService } from '../news/news.service';
import { PriceService } from '../price/price.service';
import { RecommendationService } from '../recommendation/recommendation.service';
import { TrendsService } from '../trends/trends.service';
import { StocksService } from './stocks.service';

const NOW = new Date('2026-07-22T09:00:00.000Z');

function news(ticker: string, sentiment: 'positive' | 'negative'): NewsItem {
  const id = `news-${Math.abs(Math.sin(seq++)).toString(36).slice(2, 10)}`;
  return {
    id,
    title: `기사 ${id}`,
    press: '테스트',
    publishedAt: new Date(NOW.getTime() - seq * 60_000).toISOString(),
    url: `https://example.com/${id}`,
    sectors: [],
    tickers: [ticker],
    sentiment,
  };
}
let seq = 1;

function makeService(items: NewsItem[]) {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-test-'));
  const newsService = new NewsService();
  newsService.upsert(items, NOW);
  const catalog = new CatalogService();
  const recService = new RecommendationService(catalog);
  recService.regenerate(newsService.findAll(), NOW);
  // 시세는 외부 API이므로 목 처리
  const priceService = {
    getQuote: jest.fn().mockResolvedValue(null),
  } as unknown as PriceService;
  return new StocksService(
    newsService,
    recService,
    new TrendsService(newsService),
    priceService,
    catalog,
  );
}

describe('StocksService', () => {
  it('사전에 없는 종목은 UNKNOWN_TICKER 404', async () => {
    await expect(makeService([]).detail('999999')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('추천 중인 종목은 추천·시세·트렌드·관련 뉴스를 모두 담는다', async () => {
    const detail = await makeService([
      news('005930', 'positive'),
      news('005930', 'positive'),
    ]).detail('005930');

    expect(detail.stock).toEqual({
      ticker: '005930',
      name: '삼성전자',
      sector: 'semiconductor_ai',
      market: 'KR',
    });
    expect(detail.recommendation?.ticker).toBe('005930');
    expect(detail.quote).toBeNull(); // 목 — 시세 실패에도 상세는 동작
    expect(detail.trend.days).toHaveLength(7);
    expect(detail.news).toHaveLength(2);
  });

  it('추천이 없는 종목은 recommendation이 null이어도 상세를 반환한다', async () => {
    const detail = await makeService([news('005930', 'negative')]).detail(
      '005930',
    );
    expect(detail.recommendation).toBeNull();
    expect(detail.news).toHaveLength(1);
  });
});
