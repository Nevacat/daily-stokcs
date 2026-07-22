import { Injectable } from '@nestjs/common';
import type { DailyBriefing, Sector } from '@daily-stocks/shared';
import { NewsService } from '../news/news.service';
import { RecommendationService } from '../recommendation/recommendation.service';

const TOP_SECTORS = 3;
const TOP_PICKS = 3;

/**
 * 데일리 브리핑 (기획서 §3.4).
 * 저장하지 않고 조회 시점의 뉴스·추천 데이터로 계산한다 —
 * 수집이 돌 때마다 자연스럽게 최신 브리핑이 된다.
 */
@Injectable()
export class BriefingService {
  constructor(
    private readonly newsService: NewsService,
    private readonly recommendationService: RecommendationService,
  ) {}

  /** KST 기준 오늘 날짜 문자열 */
  private kstDate(now: Date): string {
    return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
  }

  build(now: Date = new Date()): DailyBriefing {
    const today = this.kstDate(now);
    const todayNews = this.newsService
      .findAll()
      .filter((n) => this.kstDate(new Date(n.publishedAt)) === today);

    const marketSummary = {
      total: todayNews.length,
      positive: todayNews.filter((n) => n.sentiment === 'positive').length,
      negative: todayNews.filter((n) => n.sentiment === 'negative').length,
      neutral: todayNews.filter((n) => n.sentiment === 'neutral').length,
    };

    const positiveBySector = new Map<Sector, number>();
    for (const n of todayNews) {
      if (n.sentiment !== 'positive') continue;
      for (const sector of n.sectors) {
        positiveBySector.set(sector, (positiveBySector.get(sector) ?? 0) + 1);
      }
    }
    const topSectors = [...positiveBySector.entries()]
      .map(([sector, positiveCount]) => ({ sector, positiveCount }))
      .sort(
        (a, b) =>
          b.positiveCount - a.positiveCount || a.sector.localeCompare(b.sector),
      )
      .slice(0, TOP_SECTORS);

    const topPicks = [...this.recommendationService.findAll()]
      .sort((a, b) => b.score - a.score || b.newsIds.length - a.newsIds.length)
      .slice(0, TOP_PICKS);

    return {
      date: today,
      generatedAt: now.toISOString(),
      marketSummary,
      topSectors,
      topPicks,
    };
  }
}
