import { Injectable, NotFoundException } from '@nestjs/common';
import type { StockDetail } from '@daily-stocks/shared';
import { CatalogService } from '../catalog/catalog.service';
import { NewsService } from '../news/news.service';
import { PriceService } from '../price/price.service';
import { RecommendationService } from '../recommendation/recommendation.service';
import { TrendsService } from '../trends/trends.service';

const NEWS_LIMIT = 20;

/** 종목 상세 — 추천 여부와 무관하게 종목 단위로 조회 (기획서 §4 IA) */
@Injectable()
export class StocksService {
  constructor(
    private readonly newsService: NewsService,
    private readonly recommendationService: RecommendationService,
    private readonly trendsService: TrendsService,
    private readonly priceService: PriceService,
    private readonly catalog: CatalogService,
  ) {}

  async detail(ticker: string): Promise<StockDetail> {
    const stock = this.catalog.find(ticker);
    if (!stock) {
      throw new NotFoundException({
        error: {
          code: 'UNKNOWN_TICKER',
          message: `알 수 없는 종목입니다: ${ticker}`,
        },
      });
    }

    return {
      stock: {
        ticker: stock.ticker,
        name: stock.name,
        sector: stock.sector ?? null,
        market: stock.market,
      },
      recommendation:
        this.recommendationService.findAll().find((r) => r.ticker === ticker) ??
        null,
      quote: await this.priceService.getQuote(ticker),
      trend: this.trendsService.build({ ticker }),
      news: this.newsService.query({ ticker, limit: NEWS_LIMIT }).items,
    };
  }
}
