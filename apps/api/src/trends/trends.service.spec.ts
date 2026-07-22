import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BadRequestException } from '@nestjs/common';
import type { NewsItem, Sector, Sentiment } from '@daily-stocks/shared';
import { NewsService } from '../news/news.service';
import { TrendsService } from './trends.service';

const NOW = new Date('2026-07-22T09:00:00.000Z'); // KST 07-22 18:00

let seq = 0;
function news(
  sentiment: Sentiment,
  daysAgo: number,
  opts: { ticker?: string; sector?: Sector } = {},
): NewsItem {
  seq += 1;
  return {
    id: `news-${seq}`,
    title: `기사 ${seq}`,
    press: '테스트',
    publishedAt: new Date(
      NOW.getTime() - daysAgo * 24 * 3_600_000,
    ).toISOString(),
    url: `https://example.com/${seq}`,
    sectors: opts.sector ? [opts.sector] : [],
    tickers: opts.ticker ? [opts.ticker] : [],
    sentiment,
  };
}

function makeService(items: NewsItem[]) {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'trend-test-'));
  const newsService = new NewsService();
  newsService.upsert(items, NOW);
  return new TrendsService(newsService);
}

describe('TrendsService', () => {
  it('과거→오늘 순 7일 버킷을 만들고 뉴스 없는 날은 0이다', () => {
    const trend = makeService([]).build({ ticker: '005930' }, NOW);
    expect(trend.days).toHaveLength(7);
    expect(trend.days[0].date).toBe('2026-07-16');
    expect(trend.days[6].date).toBe('2026-07-22');
    expect(
      trend.days.every((d) => d.positive + d.negative + d.neutral === 0),
    ).toBe(true);
  });

  it('티커 기준으로 일별 감성을 집계한다', () => {
    const trend = makeService([
      news('positive', 0, { ticker: '005930' }),
      news('positive', 0, { ticker: '005930' }),
      news('negative', 1, { ticker: '005930' }),
      news('positive', 0, { ticker: '000660' }), // 다른 종목 제외
    ]).build({ ticker: '005930' }, NOW);

    expect(trend.days[6]).toEqual({
      date: '2026-07-22',
      positive: 2,
      negative: 0,
      neutral: 0,
    });
    expect(trend.days[5].negative).toBe(1);
  });

  it('섹터 기준으로도 집계한다', () => {
    const trend = makeService([
      news('positive', 0, { sector: 'battery' }),
      news('neutral', 0, { sector: 'finance' }), // 다른 섹터 제외
    ]).build({ sector: 'battery' }, NOW);
    expect(trend.target).toEqual({ sector: 'battery' });
    expect(trend.days[6].positive).toBe(1);
    expect(trend.days[6].neutral).toBe(0);
  });

  it('ticker와 sector를 둘 다 주거나 둘 다 없으면 INVALID_TREND_TARGET', () => {
    const service = makeService([]);
    expect(() => service.build({}, NOW)).toThrow(BadRequestException);
    expect(() =>
      service.build({ ticker: '005930', sector: 'battery' }, NOW),
    ).toThrow(BadRequestException);
  });

  it('알 수 없는 섹터는 UNKNOWN_SECTOR', () => {
    expect(() => makeService([]).build({ sector: '없는섹터' }, NOW)).toThrow(
      BadRequestException,
    );
  });
});
