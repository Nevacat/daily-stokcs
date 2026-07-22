import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { NotFoundException } from '@nestjs/common';
import type { ApiError, NewsItem, Sentiment } from '@daily-stocks/shared';
import { RecommendationService } from './recommendation.service';

const NOW = new Date('2026-07-22T09:00:00.000Z');

let seq = 0;
function news(ticker: string, sentiment: Sentiment, hoursAgo = 1): NewsItem {
  seq += 1;
  return {
    id: `news-${seq}`,
    title: `기사 ${seq}`,
    press: '테스트',
    publishedAt: new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString(),
    url: `https://example.com/${seq}`,
    sectors: [],
    tickers: [ticker],
    sentiment,
  };
}

describe('RecommendationService', () => {
  let service: RecommendationService;

  beforeEach(() => {
    process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'reco-test-'));
    service = new RecommendationService();
  });

  it('뉴스 0건이면 추천도 0건', () => {
    expect(service.regenerate([], NOW)).toHaveLength(0);
  });

  it('긍정 뉴스가 있는 종목을 추천하고 점수·이유·근거를 담는다', () => {
    const items = [news('005930', 'positive'), news('005930', 'positive')];
    const [rec] = service.regenerate(items, NOW);
    expect(rec.ticker).toBe('005930');
    expect(rec.score).toBeGreaterThanOrEqual(55);
    expect(rec.reason).toContain('긍정 뉴스 2건');
    expect(rec.newsIds).toHaveLength(2);
  });

  it('전부 부정 뉴스인 종목은 추천하지 않는다', () => {
    const items = [news('005930', 'negative'), news('005930', 'negative')];
    expect(service.regenerate(items, NOW)).toHaveLength(0);
  });

  it('중립 뉴스만 있으면 추천하지 않는다 (긍정 근거 필수)', () => {
    expect(service.regenerate([news('005930', 'neutral')], NOW)).toHaveLength(
      0,
    );
  });

  it('한 섹터에서 최대 5개까지만 추천한다', () => {
    // semiconductor_ai 섹터 종목은 사전에 3개뿐이므로 battery 포함 6종목 생성
    const tickers = [
      '005930',
      '000660',
      '042700',
      '373220',
      '006400',
      '247540',
    ];
    const items = tickers.flatMap((t) => [
      news(t, 'positive'),
      news(t, 'positive'),
    ]);
    const recs = service.regenerate(items, NOW);
    const bySector = recs.reduce<Record<string, number>>((acc, r) => {
      acc[r.sector] = (acc[r.sector] ?? 0) + 1;
      return acc;
    }, {});
    for (const count of Object.values(bySector)) {
      expect(count).toBeLessThanOrEqual(5);
    }
    expect(recs).toHaveLength(6);
  });

  it('동점이면 근거 뉴스가 많은 종목이 먼저 온다', () => {
    const items = [
      news('005930', 'positive', 1),
      news('000660', 'positive', 1),
      news('000660', 'neutral', 1), // 극성 동일, 근거 뉴스만 1건 더
    ];
    const recs = service.regenerate(items, NOW);
    const [first, second] = recs.filter((r) => r.sector === 'semiconductor_ai');
    expect(first.score).toBe(second.score);
    expect(first.ticker).toBe('000660');
  });

  it('findOne: 없는 id면 RECOMMENDATION_NOT_FOUND 에러', () => {
    let caught: unknown;
    try {
      service.findOne('없는-id');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(NotFoundException);
    const response = (caught as NotFoundException).getResponse() as ApiError;
    expect(response.error.code).toBe('RECOMMENDATION_NOT_FOUND');
  });
});
