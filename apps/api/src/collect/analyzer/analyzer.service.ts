import { Injectable } from '@nestjs/common';
import type { CatalogStock, Sector, Sentiment } from '@daily-stocks/shared';
import { CatalogService } from '../../catalog/catalog.service';
import {
  NEGATIVE_KEYWORDS,
  POSITIVE_KEYWORDS,
  SECTOR_KEYWORDS,
} from './dictionaries';

export interface AnalyzedArticle {
  sectors: Sector[];
  /** 매칭된 종목들 */
  stocks: CatalogStock[];
  sentiment: Sentiment;
  /** 감성 강도: 매칭된 키워드 수 (양수=호재, 음수=악재) */
  polarity: number;
}

// 인쇄 가능한 ASCII만으로 이루어진 별칭인지 (영문 별칭 판별)
const ASCII_ONLY = /^[ -~]+$/;

/**
 * 별칭/키워드 매칭 (한·영 공용, 대소문자 무시).
 * 짧은 영문 별칭(GM, F 등)이 일반 단어 안에서 오탐되지 않도록
 * ASCII 별칭은 단어 경계로 매칭한다 (예: 'GM'이 'segment'에 걸리지 않게).
 */
function matches(lowerTitle: string, keyword: string): boolean {
  const lower = keyword.toLowerCase();
  if (ASCII_ONLY.test(keyword)) {
    const escaped = lower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`).test(lowerTitle);
  }
  return lowerTitle.includes(lower);
}

/**
 * 키워드 사전 기반 분석기 (MVP) — 한국어·영어 뉴스 모두 지원.
 * 추후 LLM 분석기로 교체 시 이 클래스만 대체하면 된다 (기획서 §5).
 */
@Injectable()
export class AnalyzerService {
  constructor(private readonly catalog: CatalogService) {}

  analyze(title: string): AnalyzedArticle {
    const lower = title.toLowerCase();

    // 큐레이션 종목은 별칭으로, 그 외 전체 상장사는 공식명(3자 이상)으로 매칭
    const stocks = this.catalog.list().filter((s) => {
      const aliases = s.aliases ?? (s.name.length >= 3 ? [s.name] : []);
      return aliases.some((a) => matches(lower, a));
    });

    const sectors = new Set<Sector>(
      stocks.flatMap((s) => (s.sector ? [s.sector] : [])),
    );
    for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
      if (keywords.some((k) => matches(lower, k)))
        sectors.add(sector as Sector);
    }

    const positive = POSITIVE_KEYWORDS.filter((k) => matches(lower, k)).length;
    const negative = NEGATIVE_KEYWORDS.filter((k) => matches(lower, k)).length;
    const polarity = positive - negative;

    const sentiment: Sentiment =
      polarity > 0 ? 'positive' : polarity < 0 ? 'negative' : 'neutral';

    return { sectors: [...sectors], stocks, sentiment, polarity };
  }
}
