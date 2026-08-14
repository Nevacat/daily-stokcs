import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { StockComparison, StockDetail } from '@daily-stocks/shared';
import { CatalogService } from '../catalog/catalog.service';
import { NewsService } from '../news/news.service';
import { PriceService } from '../price/price.service';
import { RecommendationService } from '../recommendation/recommendation.service';
import { TrendsService } from '../trends/trends.service';

const NEWS_LIMIT = 20;
/** 비교 대상 개수 — 과다 비교 방지 (기획서 §4) */
const COMPARE_MIN = 2;
const COMPARE_MAX = 3;

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

  /**
   * 종목 비교 — 2~3개를 나란히 놓고 본다 (기획서 §4 기능 ③).
   * 추천 중이 아닌 종목은 score null, 시세 실패는 quote null 로 내려간다.
   */
  async compare(tickers: string[]): Promise<StockComparison[]> {
    const unique = [...new Set(tickers)];
    if (unique.length < COMPARE_MIN || unique.length > COMPARE_MAX) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_BODY',
          message: `tickers는 ${COMPARE_MIN}~${COMPARE_MAX}개의 콤마 구분 목록이어야 합니다.`,
        },
      });
    }

    const stocks = unique.map((ticker) => {
      const stock = this.catalog.find(ticker);
      if (!stock) {
        throw new BadRequestException({
          error: {
            code: 'UNKNOWN_TICKER',
            message: `알 수 없는 종목입니다: ${ticker}`,
          },
        });
      }
      return stock;
    });

    const quotes = await this.priceService.getQuotes(unique);
    const recommendations = this.recommendationService.findAll();

    return stocks.map((stock) => ({
      ticker: stock.ticker,
      name: stock.name,
      sector: stock.sector ?? null,
      market: stock.market,
      score:
        recommendations.find((r) => r.ticker === stock.ticker)?.score ?? null,
      quote: quotes[stock.ticker] ?? null,
      sentiment7d: this.trendsService
        .build({ ticker: stock.ticker })
        .days.reduce(
          (acc, day) => ({
            positive: acc.positive + day.positive,
            negative: acc.negative + day.negative,
            neutral: acc.neutral + day.neutral,
          }),
          { positive: 0, negative: 0, neutral: 0 },
        ),
    }));
  }
}
