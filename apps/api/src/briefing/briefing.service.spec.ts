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

/** 발행 시각을 직접 지정하는 뉴스 (나이트 브리핑 날짜 경계 테스트용) */
function newsAt(
  publishedAt: string,
  sentiment: Sentiment,
  sectors: Sector[] = [],
  tickers: string[] = [],
): NewsItem {
  seq += 1;
  return {
    id: `news-${seq}`,
    title: `기사 ${seq}`,
    press: '테스트',
    publishedAt,
    url: `https://example.com/${seq}`,
    sectors,
    tickers,
    sentiment,
  };
}

function makeService(
  items: NewsItem[],
  recs: Recommendation[],
  now: Date = NOW,
) {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'brief-test-'));
  const newsService = new NewsService();
  newsService.upsert(items, now);
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

/** 나이트 브리핑 — 기준일은 KST 06:00에 넘어간다 (21:00~05:59가 같은 '밤') */
describe('BriefingService.buildNight', () => {
  // KST 07-22 12:00 발행
  const todayNews = (
    sentiment: Sentiment,
    sectors: Sector[] = [],
    tickers: string[] = [],
  ) => newsAt('2026-07-22T03:00:00.000Z', sentiment, sectors, tickers);
  // KST 07-21 12:00 발행
  const yesterdayNews = (sentiment: Sentiment) =>
    newsAt('2026-07-21T03:00:00.000Z', sentiment);

  describe('기준 날짜 경계', () => {
    const cases: [string, string, string][] = [
      [
        'KST 20:59 (아직 낮 취급이지만 당일)',
        '2026-07-22T11:59:00.000Z',
        '2026-07-22',
      ],
      ['KST 21:00 → 당일', '2026-07-22T12:00:00.000Z', '2026-07-22'],
      ['KST 23:59 → 당일', '2026-07-22T14:59:00.000Z', '2026-07-22'],
      ['KST 00:00 → 전날', '2026-07-22T15:00:00.000Z', '2026-07-22'],
      ['KST 05:59 → 전날', '2026-07-22T20:59:00.000Z', '2026-07-22'],
      ['KST 06:00 → 당일로 넘어감', '2026-07-22T21:00:00.000Z', '2026-07-23'],
    ];

    it.each(cases)('%s', (_label, iso, expected) => {
      const now = new Date(iso);
      expect(makeService([], [], now).buildNight(now).date).toBe(expected);
    });
  });

  it('뉴스가 없으면 안내 1줄과 빈 watchlist를 준다', () => {
    const night = makeService([], [rec('005930', 80)]).buildNight(NOW);
    expect(night.lines).toEqual([
      '오늘은 아직 모인 뉴스가 없어요. 내일 아침에 다시 만나요!',
    ]);
    expect(night.watchlist).toEqual([]);
    expect(night.marketSummary.total).toBe(0);
  });

  it('호재가 많으면 1줄, 상위 섹터로 2줄, 어제 대비로 3줄을 만든다', () => {
    const night = makeService(
      [
        todayNews('positive', ['battery']),
        todayNews('positive', ['battery']),
        todayNews('positive', ['finance']),
        todayNews('negative', ['automotive']),
        yesterdayNews('positive'),
      ],
      [],
    ).buildNight(NOW);

    expect(night.lines).toEqual([
      '오늘 뉴스 4건 중 호재가 3건으로 더 많았어요.',
      '2차전지 소식이 호재 2건으로 가장 많았어요.',
      '어제보다 호재 뉴스가 2건 늘었어요.',
    ]);
  });

  it('악재 우세 / 동률 문장을 구분한다', () => {
    const negative = makeService(
      [todayNews('negative'), todayNews('negative'), todayNews('positive')],
      [],
    ).buildNight(NOW);
    expect(negative.lines[0]).toBe(
      '오늘 뉴스 3건 중 악재가 2건으로 조금 더 많았어요.',
    );

    const tie = makeService(
      [todayNews('positive'), todayNews('negative')],
      [],
    ).buildNight(NOW);
    expect(tie.lines[0]).toBe(
      '오늘 뉴스 2건, 호재와 악재가 1건씩으로 팽팽했어요.',
    );
  });

  it('전부 중립인 날은 "0건씩 팽팽했다"고 하지 않는다', () => {
    const night = makeService(
      [todayNews('neutral'), todayNews('neutral'), todayNews('neutral')],
      [],
    ).buildNight(NOW);
    expect(night.lines[0]).toBe('오늘 뉴스 3건 중 호재도 악재도 없었어요.');
  });

  it('호재 섹터가 없으면 2줄을 생략하고, 어제 뉴스가 없으면 3줄을 생략한다', () => {
    const night = makeService(
      [todayNews('negative', ['battery'])],
      [],
    ).buildNight(NOW);
    expect(night.lines).toHaveLength(1);
  });

  it('어제와 호재 수가 같으면 같았다고 알린다', () => {
    const night = makeService(
      [todayNews('positive'), yesterdayNews('positive')],
      [],
    ).buildNight(NOW);
    expect(night.lines[night.lines.length - 1]).toBe(
      '호재 뉴스 수는 어제와 같았어요.',
    );
  });

  it('어제보다 호재가 줄면 줄었다고 알린다', () => {
    const night = makeService(
      [
        todayNews('positive'),
        yesterdayNews('positive'),
        yesterdayNews('positive'),
        yesterdayNews('positive'),
      ],
      [],
    ).buildNight(NOW);
    expect(night.lines[night.lines.length - 1]).toBe(
      '어제보다 호재 뉴스가 2건 줄었어요.',
    );
  });

  it('watchlist는 오늘 뉴스가 있는 추천만 뉴스 수 → 점수 순 상위 3개', () => {
    const night = makeService(
      [
        todayNews('positive', [], ['A']),
        todayNews('positive', [], ['A']),
        todayNews('neutral', [], ['B']),
        todayNews('neutral', [], ['C']),
        todayNews('negative', [], ['D']),
      ],
      [rec('A', 50), rec('B', 90), rec('C', 70), rec('D', 95), rec('E', 99)],
    ).buildNight(NOW);

    // A는 뉴스 2건으로 1위, B·C·D는 1건이라 점수순 → D(95) B(90) C(70)
    expect(night.watchlist.map((w) => w.ticker)).toEqual(['A', 'D', 'B']);
    expect(night.watchlist[0]).toEqual({
      ticker: 'A',
      stockName: 'A',
      sector: 'semiconductor_ai',
      todayNewsCount: 2,
      score: 50,
    });
    // 오늘 뉴스가 없는 E는 점수가 가장 높아도 제외된다
    expect(night.watchlist.some((w) => w.ticker === 'E')).toBe(false);
  });
});
