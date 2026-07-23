import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type {
  NewsItem,
  Recommendation,
  Sector,
  Sentiment,
} from '@daily-stocks/shared';
import { CatalogService } from '../catalog/catalog.service';
import { NewsService } from '../news/news.service';
import { RecommendationService } from '../recommendation/recommendation.service';
import { BriefingService } from './briefing.service';

const NOW = new Date('2026-07-22T09:00:00.000Z'); // KST 07-22 18:00

let seq = 0;
function news(sentiment: Sentiment, sectors: Sector[], hoursAgo = 1): NewsItem {
  seq += 1;
  return {
    id: `news-${seq}`,
    title: `기사 ${seq}`,
    press: '테스트',
    publishedAt: new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString(),
    url: `https://example.com/${seq}`,
    sectors,
    tickers: [],
    sentiment,
  };
}

function rec(ticker: string, score: number): Recommendation {
  return {
    id: ticker,
    ticker,
    stockName: ticker,
    sector: 'semiconductor_ai',
    score,
    reason: '테스트',
    newsIds: [],
    recommendedAt: NOW.toISOString(),
  };
}

function makeService(items: NewsItem[], recs: Recommendation[]) {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'brief-test-'));
  const newsService = new NewsService();
  newsService.upsert(items, NOW);
  const recService = new RecommendationService(new CatalogService());
  jest.spyOn(recService, 'findAll').mockReturnValue(recs);
  return new BriefingService(newsService, recService);
}

describe('BriefingService', () => {
  it('데이터가 없으면 0 카운트의 빈 브리핑을 만든다', () => {
    const briefing = makeService([], []).build(NOW);
    expect(briefing.date).toBe('2026-07-22');
    expect(briefing.marketSummary).toEqual({
      total: 0,
      positive: 0,
      negative: 0,
      neutral: 0,
    });
    expect(briefing.topSectors).toEqual([]);
    expect(briefing.topPicks).toEqual([]);
  });

  it('오늘(KST) 뉴스만 집계한다', () => {
    const briefing = makeService(
      [
        news('positive', ['battery'], 1), // 오늘
        news('positive', ['battery'], 20), // KST 기준 어제(07-21 22:00)
      ],
      [],
    ).build(NOW);
    expect(briefing.marketSummary.total).toBe(1);
  });

  it('감성 분포와 긍정 상위 섹터를 집계한다', () => {
    const briefing = makeService(
      [
        news('positive', ['battery']),
        news('positive', ['battery']),
        news('positive', ['finance']),
        news('negative', ['automotive']),
        news('neutral', []),
      ],
      [],
    ).build(NOW);
    expect(briefing.marketSummary).toEqual({
      total: 5,
      positive: 3,
      negative: 1,
      neutral: 1,
    });
    expect(briefing.topSectors[0]).toEqual({
      sector: 'battery',
      positiveCount: 2,
    });
    expect(briefing.topSectors).toHaveLength(2); // 부정만 있는 섹터는 제외
  });

  it('Top Picks는 점수순 최대 3개', () => {
    const briefing = makeService(
      [],
      [rec('A', 60), rec('B', 90), rec('C', 70), rec('D', 80)],
    ).build(NOW);
    expect(briefing.topPicks.map((r) => r.ticker)).toEqual(['B', 'D', 'C']);
  });
});
