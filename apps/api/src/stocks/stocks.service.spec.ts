import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { NotFoundException } from '@nestjs/common';
import type { NewsItem } from '@daily-stocks/shared';
import { NewsService } from '../news/news.service';
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
  const recService = new RecommendationService();
  recService.regenerate(newsService.findAll(), NOW);
  return new StocksService(
    newsService,
    recService,
    new TrendsService(newsService),
  );
}

describe('StocksService', () => {
  it('사전에 없는 종목은 UNKNOWN_TICKER 404', () => {
    expect(() => makeService([]).detail('999999')).toThrow(NotFoundException);
  });

  it('추천 중인 종목은 추천·트렌드·관련 뉴스를 모두 담는다', () => {
    const detail = makeService([
      news('005930', 'positive'),
      news('005930', 'positive'),
    ]).detail('005930');

    expect(detail.stock).toEqual({
      ticker: '005930',
      name: '삼성전자',
      sector: 'semiconductor_ai',
    });
    expect(detail.recommendation?.ticker).toBe('005930');
    expect(detail.trend.days).toHaveLength(7);
    expect(detail.news).toHaveLength(2);
  });

  it('추천이 없는 종목은 recommendation이 null이어도 상세를 반환한다', () => {
    const detail = makeService([news('005930', 'negative')]).detail('005930');
    expect(detail.recommendation).toBeNull();
    expect(detail.news).toHaveLength(1);
  });
});
