import { Injectable } from '@nestjs/common';
import type {
  DailyBriefing,
  NewsItem,
  NightBriefing,
  NightWatchItem,
  Sector,
} from '@daily-stocks/shared';
import { SECTOR_LABELS } from '@daily-stocks/shared';
import { NewsService } from '../news/news.service';
import { RecommendationService } from '../recommendation/recommendation.service';

const TOP_SECTORS = 3;
const TOP_PICKS = 3;
/** 나이트 브리핑의 '오늘'은 KST 06:00에 넘어간다 — 21:00~23:59는 당일, 00:00~05:59는 전날 */
const NIGHT_OFFSET_HOURS = 6;

type MarketSummary = DailyBriefing['marketSummary'];

/**
 * 데일리 브리핑 (기획서 §3.4) + 나이트 브리핑.
 * 저장하지 않고 조회 시점의 뉴스·추천 데이터로 계산한다 —
 * 수집이 돌 때마다 자연스럽게 최신 브리핑이 된다.
 */
@Injectable()
export class BriefingService {
  constructor(
    private readonly newsService: NewsService,
    private readonly recommendationService: RecommendationService,
  ) {}

  /** KST 기준 날짜 문자열 */
  private kstDate(now: Date): string {
    return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
  }

  /** YYYY-MM-DD 하루 전 */
  private previousDate(date: string): string {
    return new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000)
      .toISOString()
      .slice(0, 10);
  }

  /** 해당 KST 날짜에 발행된 뉴스 */
  private newsOn(date: string): NewsItem[] {
    return this.newsService
      .findAll()
      .filter((n) => this.kstDate(new Date(n.publishedAt)) === date);
  }

  private summaryOf(news: NewsItem[]): MarketSummary {
    return {
      total: news.length,
      positive: news.filter((n) => n.sentiment === 'positive').length,
      negative: news.filter((n) => n.sentiment === 'negative').length,
      neutral: news.filter((n) => n.sentiment === 'neutral').length,
    };
  }

  /** 호재 뉴스가 많은 섹터 상위 N (아침·나이트 공용) */
  private topSectorsOf(
    news: NewsItem[],
  ): { sector: Sector; positiveCount: number }[] {
    const positiveBySector = new Map<Sector, number>();
    for (const n of news) {
      if (n.sentiment !== 'positive') continue;
      for (const sector of n.sectors) {
        positiveBySector.set(sector, (positiveBySector.get(sector) ?? 0) + 1);
      }
    }
    return [...positiveBySector.entries()]
      .map(([sector, positiveCount]) => ({ sector, positiveCount }))
      .sort(
        (a, b) =>
          b.positiveCount - a.positiveCount || a.sector.localeCompare(b.sector),
      )
      .slice(0, TOP_SECTORS);
  }

  build(now: Date = new Date()): DailyBriefing {
    const today = this.kstDate(now);
    const todayNews = this.newsOn(today);

    const topPicks = [...this.recommendationService.findAll()]
      .sort((a, b) => b.score - a.score || b.newsIds.length - a.newsIds.length)
      .slice(0, TOP_PICKS);

    return {
      date: today,
      generatedAt: now.toISOString(),
      marketSummary: this.summaryOf(todayNews),
      topSectors: this.topSectorsOf(todayNews),
      topPicks,
    };
  }

  /**
   * 나이트 브리핑 (KST 21:00~익일 05:59).
   * 요약 3줄은 규칙 기반 템플릿이다 (LLM 미사용). 전부 사실 전달 톤.
   */
  buildNight(now: Date = new Date()): NightBriefing {
    const date = this.kstDate(
      new Date(now.getTime() - NIGHT_OFFSET_HOURS * 3_600_000),
    );
    const todayNews = this.newsOn(date);
    const marketSummary = this.summaryOf(todayNews);

    return {
      date,
      generatedAt: now.toISOString(),
      lines: this.nightLines(date, todayNews, marketSummary),
      marketSummary,
      watchlist: this.nightWatchlist(todayNews),
    };
  }

  /** 최소 1줄, 최대 3줄. 데이터가 없는 줄은 생략한다 */
  private nightLines(
    date: string,
    todayNews: NewsItem[],
    summary: MarketSummary,
  ): string[] {
    if (summary.total === 0) {
      return ['오늘은 아직 모인 뉴스가 없어요. 내일 아침에 다시 만나요!'];
    }

    const lines: string[] = [
      summary.positive > summary.negative
        ? `오늘 뉴스 ${summary.total}건 중 호재가 ${summary.positive}건으로 더 많았어요.`
        : summary.negative > summary.positive
          ? `오늘 뉴스 ${summary.total}건 중 악재가 ${summary.negative}건으로 조금 더 많았어요.`
          : // 전부 중립인 날에 '0건씩 팽팽했어요'가 나오지 않게 분리한다
            summary.positive === 0
            ? `오늘 뉴스 ${summary.total}건 중 호재도 악재도 없었어요.`
            : `오늘 뉴스 ${summary.total}건, 호재와 악재가 ${summary.positive}건씩으로 팽팽했어요.`,
    ];

    const [top] = this.topSectorsOf(todayNews);
    if (top) {
      lines.push(
        `${SECTOR_LABELS[top.sector]} 소식이 호재 ${top.positiveCount}건으로 가장 많았어요.`,
      );
    }

    // 어제 뉴스가 아예 없으면(첫 사용일) 비교 줄을 만들지 않는다
    const yesterdayNews = this.newsOn(this.previousDate(date));
    if (yesterdayNews.length > 0) {
      const diff = summary.positive - this.summaryOf(yesterdayNews).positive;
      lines.push(
        diff === 0
          ? '호재 뉴스 수는 어제와 같았어요.'
          : `어제보다 호재 뉴스가 ${Math.abs(diff)}건 ${diff > 0 ? '늘었어요' : '줄었어요'}.`,
      );
    }

    return lines;
  }

  /** 오늘(KST) 뉴스가 있는 추천 종목 상위 3 */
  private nightWatchlist(todayNews: NewsItem[]): NightWatchItem[] {
    const countByTicker = new Map<string, number>();
    for (const n of todayNews) {
      for (const ticker of n.tickers) {
        countByTicker.set(ticker, (countByTicker.get(ticker) ?? 0) + 1);
      }
    }

    return this.recommendationService
      .findAll()
      .map((r) => ({
        ticker: r.ticker,
        stockName: r.stockName,
        sector: r.sector,
        todayNewsCount: countByTicker.get(r.ticker) ?? 0,
        score: r.score,
      }))
      .filter((w) => w.todayNewsCount > 0)
      .sort(
        (a, b) =>
          b.todayNewsCount - a.todayNewsCount ||
          b.score - a.score ||
          a.ticker.localeCompare(b.ticker),
      )
      .slice(0, TOP_PICKS);
  }
}
