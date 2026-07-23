import { Injectable, Logger } from '@nestjs/common';
import type { StockQuote } from '@daily-stocks/shared';
import { STOCKS } from '@daily-stocks/shared';

const CACHE_TTL_MS = 5 * 60_000; // 시세 캐시 5분 (무료 소스 과호출 방지)

interface CacheEntry {
  quote: StockQuote | null;
  at: number;
}

/**
 * 주가 시세 서비스.
 *
 * 기본 제공자는 Yahoo Finance 공개 차트 API — **키 없이 동작**하며
 * 국내(KOSPI/KOSDAQ)·미국 종목의 현재가와 전일 대비 등락률을 제공한다.
 * (비공식 소스이므로 15~20분 지연 시세일 수 있음)
 *
 * ┌─ 공식 API(한국투자증권 KIS)로 전환하려면 ────────────────────┐
 * │ apps/api/.env 에 KIS_APP_KEY/KIS_APP_SECRET을 채우고         │
 * │ 아래 fetchQuote를 KIS 호출로 교체:                            │
 * │ 1) POST /oauth2/tokenP 로 access_token 발급 (24h 캐시)        │
 * │ 2) 국내: /uapi/domestic-stock/v1/quotations/inquire-price     │
 * │    해외: /uapi/overseas-price/v1/quotations/price             │
 * └──────────────────────────────────────────────────────────────┘
 */
@Injectable()
export class PriceService {
  private readonly logger = new Logger(PriceService.name);
  private readonly cache = new Map<string, CacheEntry>();

  /** Yahoo 심볼 매핑: 국내는 .KS(코스피)/.KQ(코스닥), 미국은 심볼 그대로 */
  private yahooSymbol(ticker: string): string | null {
    const stock = STOCKS.find((s) => s.ticker === ticker);
    if (!stock) return null;
    if (stock.market === 'US') return ticker;
    return `${ticker}.${stock.exchange === 'KOSDAQ' ? 'KQ' : 'KS'}`;
  }

  private async fetchQuote(ticker: string): Promise<StockQuote | null> {
    const symbol = this.yahooSymbol(ticker);
    if (!symbol) return null;

    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    );
    if (!res.ok) return null;

    const body = (await res.json()) as {
      chart?: {
        result?: {
          meta?: {
            regularMarketPrice?: number;
            chartPreviousClose?: number;
            previousClose?: number;
            currency?: string;
          };
        }[];
      };
    };
    const meta = body.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    const previousClose = meta?.chartPreviousClose ?? meta?.previousClose;
    if (
      !Number.isFinite(price) ||
      !Number.isFinite(previousClose) ||
      previousClose === 0
    ) {
      return null;
    }

    return {
      ticker,
      price: price!,
      previousClose: previousClose!,
      changePct:
        Math.round(((price! - previousClose!) / previousClose!) * 10000) / 100,
      currency: meta?.currency ?? 'KRW',
      at: new Date().toISOString(),
    };
  }

  /** 시세 조회 (5분 캐시). 실패·미등록 종목은 null */
  async getQuote(ticker: string): Promise<StockQuote | null> {
    const cached = this.cache.get(ticker);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.quote;

    let quote: StockQuote | null = null;
    try {
      quote = await this.fetchQuote(ticker);
    } catch (e) {
      this.logger.warn(`시세 조회 실패 (${ticker}): ${String(e)}`);
    }
    this.cache.set(ticker, { quote, at: Date.now() });
    return quote;
  }

  /** 여러 종목 시세 일괄 조회 (중복 제거) */
  async getQuotes(
    tickers: string[],
  ): Promise<Record<string, StockQuote | null>> {
    const unique = [...new Set(tickers)];
    const entries = await Promise.all(
      unique.map(async (t) => [t, await this.getQuote(t)] as const),
    );
    return Object.fromEntries(entries);
  }

  /** 현재가만 필요할 때 (히스토리 적중률 계산용) */
  async getPrice(ticker: string): Promise<number | null> {
    return (await this.getQuote(ticker))?.price ?? null;
  }

  /** 여러 종목 현재가 (중복 제거) */
  async getPrices(tickers: string[]): Promise<Map<string, number | null>> {
    const quotes = await this.getQuotes(tickers);
    return new Map(
      Object.entries(quotes).map(([t, q]) => [t, q?.price ?? null]),
    );
  }
}
