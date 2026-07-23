import { Injectable, NotFoundException } from '@nestjs/common';
import type { NewsItem, Recommendation, Sector } from '@daily-stocks/shared';
import { SECTOR_LABELS } from '@daily-stocks/shared';
import { JsonStore } from '../common/json-store';
import { STOCKS } from '../collect/analyzer/dictionaries';

/** 섹터당 최대 추천 수 (기획서 §2.2) */
const MAX_PER_SECTOR = 5;
/** 최신성 가중치 반감기 (시간) */
const RECENCY_HALF_LIFE_HOURS = 24;
/** 추천 최소 점수 */
const MIN_SCORE = 55;

@Injectable()
export class RecommendationService {
  private readonly store = new JsonStore<Recommendation[]>('recommendations');
  private recommendations: Recommendation[] = this.store.load() ?? [];

  /**
   * 뉴스 전체를 기반으로 추천을 다시 생성한다 (기획서 §5).
   * 점수: Σ(감성 극성 × 최신성 가중치) → 0~100 정규화
   */
  regenerate(allNews: NewsItem[], now: Date = new Date()): Recommendation[] {
    const next: Recommendation[] = [];

    for (const stock of STOCKS) {
      const related = allNews.filter((n) => n.tickers.includes(stock.ticker));
      if (related.length === 0) continue;

      let raw = 0;
      let positive = 0;
      let negative = 0;
      for (const n of related) {
        const ageHours = Math.max(
          0,
          (now.getTime() - Date.parse(n.publishedAt)) / 3_600_000,
        );
        const recency = Math.pow(0.5, ageHours / RECENCY_HALF_LIFE_HOURS);
        const polarity =
          n.sentiment === 'positive' ? 1 : n.sentiment === 'negative' ? -1 : 0;
        raw += polarity * recency;
        if (n.sentiment === 'positive') positive++;
        if (n.sentiment === 'negative') negative++;
      }

      const score = Math.round(50 + 50 * Math.tanh(raw / 3));
      // 잘못된 publishedAt로 NaN이 전파되면 추천에서 제외
      if (!Number.isFinite(score) || score < MIN_SCORE || positive === 0) {
        continue;
      }

      // 근거 뉴스: 비중립 우선, 최대 5건 (상세 화면에서 감성 태그와 함께 노출)
      const evidence = [...related]
        .sort(
          (a, b) =>
            Number(a.sentiment === 'neutral') -
            Number(b.sentiment === 'neutral'),
        )
        .slice(0, 5)
        .map((n) => n.id);

      next.push({
        // 티커를 id로 사용 — 재생성돼도 상세 링크가 깨지지 않는다
        id: stock.ticker,
        ticker: stock.ticker,
        stockName: stock.name,
        sector: stock.sector,
        score,
        reason: this.buildReason(
          stock.name,
          stock.sector,
          positive,
          negative,
          score,
        ),
        newsIds: evidence,
        recommendedAt: now.toISOString(),
        market: stock.market,
      });
    }

    // 섹터별 점수순 상위 N개, 동점이면 근거 뉴스 많은 순
    const bySector = new Map<Sector, Recommendation[]>();
    for (const rec of next) {
      const list = bySector.get(rec.sector) ?? [];
      list.push(rec);
      bySector.set(rec.sector, list);
    }
    this.recommendations = [...bySector.values()].flatMap((list) =>
      list
        .sort(
          (a, b) => b.score - a.score || b.newsIds.length - a.newsIds.length,
        )
        .slice(0, MAX_PER_SECTOR),
    );

    this.store.save(this.recommendations);
    return this.recommendations;
  }

  /** 판단 로직을 그대로 노출하는 추천 이유 (기획서 §2.3 — 투자 조언 아닌 사실 전달 톤) */
  private buildReason(
    name: string,
    sector: Sector,
    positive: number,
    negative: number,
    score: number,
  ): string {
    const balance =
      negative === 0
        ? `긍정 뉴스 ${positive}건`
        : `긍정 뉴스 ${positive}건, 부정 뉴스 ${negative}건`;
    return `${SECTOR_LABELS[sector]} 섹터의 ${name}, ${balance}이 모여서 종합 ${score}점이에요.`;
  }

  findAll(sector?: Sector): Recommendation[] {
    return sector
      ? this.recommendations.filter((r) => r.sector === sector)
      : this.recommendations;
  }

  findOne(id: string): Recommendation {
    const rec = this.recommendations.find((r) => r.id === id);
    if (!rec) {
      throw new NotFoundException({
        error: {
          code: 'RECOMMENDATION_NOT_FOUND',
          message: `추천을 찾을 수 없습니다: ${id}`,
        },
      });
    }
    return rec;
  }
}
