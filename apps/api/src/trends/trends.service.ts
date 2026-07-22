import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  Sector,
  SentimentTrend,
  SentimentTrendDay,
} from '@daily-stocks/shared';
import { SECTORS } from '@daily-stocks/shared';
import { NewsService } from '../news/news.service';

/** 기획서 §3.5: 최근 7일 — 뉴스 보존 기간(RETENTION_DAYS=7)과 일치 */
const TREND_DAYS = 7;

@Injectable()
export class TrendsService {
  constructor(private readonly newsService: NewsService) {}

  private kstDate(date: Date): string {
    return new Date(date.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
  }

  build(
    target: { ticker?: string; sector?: string },
    now: Date = new Date(),
  ): SentimentTrend {
    const { ticker, sector } = target;
    if ((ticker && sector) || (!ticker && !sector)) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_TREND_TARGET',
          message: 'ticker 또는 sector 중 하나만 지정해야 합니다.',
        },
      });
    }
    if (sector && !SECTORS.includes(sector as Sector)) {
      throw new BadRequestException({
        error: {
          code: 'UNKNOWN_SECTOR',
          message: `알 수 없는 섹터입니다: ${sector}`,
        },
      });
    }

    const related = this.newsService
      .findAll()
      .filter((n) =>
        ticker
          ? n.tickers.includes(ticker)
          : n.sectors.includes(sector as Sector),
      );

    // 과거 → 오늘 순으로 7일 버킷 생성 (뉴스 없는 날은 0)
    const days: SentimentTrendDay[] = [];
    for (let offset = TREND_DAYS - 1; offset >= 0; offset--) {
      const date = this.kstDate(
        new Date(now.getTime() - offset * 24 * 3_600_000),
      );
      const daily = related.filter(
        (n) => this.kstDate(new Date(n.publishedAt)) === date,
      );
      days.push({
        date,
        positive: daily.filter((n) => n.sentiment === 'positive').length,
        negative: daily.filter((n) => n.sentiment === 'negative').length,
        neutral: daily.filter((n) => n.sentiment === 'neutral').length,
      });
    }

    return {
      target: ticker ? { ticker } : { sector: sector as Sector },
      days,
    };
  }
}
