import { Injectable } from '@nestjs/common';
import type { Sector, Sentiment } from '@daily-stocks/shared';
import {
  NEGATIVE_KEYWORDS,
  POSITIVE_KEYWORDS,
  SECTOR_KEYWORDS,
  STOCKS,
  StockEntry,
} from './dictionaries';

export interface AnalyzedArticle {
  sectors: Sector[];
  /** 매칭된 종목들 */
  stocks: StockEntry[];
  sentiment: Sentiment;
  /** 감성 강도: 매칭된 키워드 수 (양수=호재, 음수=악재) */
  polarity: number;
}

/**
 * 키워드 사전 기반 분석기 (MVP).
 * 추후 LLM 분석기로 교체 시 이 클래스만 대체하면 된다 (기획서 §5).
 */
@Injectable()
export class AnalyzerService {
  analyze(title: string): AnalyzedArticle {
    const stocks = STOCKS.filter((s) =>
      s.aliases.some((a) => title.includes(a)),
    );

    const sectors = new Set<Sector>(stocks.map((s) => s.sector));
    for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
      if (keywords.some((k) => title.includes(k)))
        sectors.add(sector as Sector);
    }

    const positive = POSITIVE_KEYWORDS.filter((k) => title.includes(k)).length;
    const negative = NEGATIVE_KEYWORDS.filter((k) => title.includes(k)).length;
    const polarity = positive - negative;

    const sentiment: Sentiment =
      polarity > 0 ? 'positive' : polarity < 0 ? 'negative' : 'neutral';

    return { sectors: [...sectors], stocks, sentiment, polarity };
  }
}
