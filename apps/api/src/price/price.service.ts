import { Injectable, Logger } from '@nestjs/common';
import type { ChartRange, PriceChart, StockQuote } from '@daily-stocks/shared';
import { CatalogService } from '../catalog/catalog.service';

const CACHE_TTL_MS = 5 * 60_000; // 시세 캐시 5분 (무료 소스 과호출 방지)
const DIVIDEND_TTL_MS = 12 * 3_600_000; // 배당 이력 캐시 12시간 (자주 바뀌지 않음)
const SPARK_TTL_MS = 15 * 60_000; // 일봉이라 5분보다 길게 잡아도 값이 안 바뀐다
const SPARK_CHUNK = 20; // 한 번에 보낼 심볼 수

interface CacheEntry {
  quote: StockQuote | null;
  at: number;
}

/** 과거 배당 1건 — ex-date와 주당 배당금 */
export interface DividendPayment {
  /** ex-date (epoch ms, UTC) */
  at: number;
  amount: number;
}

/** 구간별 Yahoo range/interval 매핑 */
const RANGE_PARAMS: Record<ChartRange, { range: string; interval: string }> = {
  '1d': { range: '1d', interval: '5m' },
  '1w': { range: '5d', interval: '30m' },
  '1m': { range: '1mo', interval: '1d' },
  '3m': { range: '3mo', interval: '1d' },
  '1y': { range: '1y', interval: '1wk' },
};

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
  constructor(private readonly catalog: CatalogService) {}

  private readonly logger = new Logger(PriceService.name);
  private readonly cache = new Map<string, CacheEntry>();

  /** Yahoo 심볼 매핑: 국내는 .KS(코스피)/.KQ(코스닥), 미국은 심볼 그대로 */
  private yahooSymbol(ticker: string): string | null {
    const stock = this.catalog.find(ticker);
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

  private readonly chartCache = new Map<
    string,
    { chart: PriceChart | null; at: number }
  >();

  /** 주가 차트 조회 (구간별, 5분 캐시). 실패·미등록 종목은 null */
  async getChart(
    ticker: string,
    range: ChartRange,
  ): Promise<PriceChart | null> {
    const key = `${ticker}:${range}`;
    const cached = this.chartCache.get(key);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.chart;

    let chart: PriceChart | null = null;
    try {
      const symbol = this.yahooSymbol(ticker);
      if (symbol) {
        const params = RANGE_PARAMS[range];
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${params.range}&interval=${params.interval}`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } },
        );
        if (res.ok) {
          const body = (await res.json()) as {
            chart?: {
              result?: {
                meta?: { currency?: string; chartPreviousClose?: number };
                timestamp?: number[];
                indicators?: { quote?: { close?: (number | null)[] }[] };
              }[];
            };
          };
          const result = body.chart?.result?.[0];
          const timestamps = result?.timestamp ?? [];
          const closes = result?.indicators?.quote?.[0]?.close ?? [];
          const points = timestamps
            .map((t, i) => ({ t, price: closes[i] }))
            .filter((p): p is { t: number; price: number } =>
              Number.isFinite(p.price),
            )
            .map((p) => ({
              t: new Date(p.t * 1000).toISOString(),
              price: p.price,
            }));
          if (points.length > 1) {
            // 기준선이 0·음수·비정상이면 null로 준다 —
            // 앱이 1d 등락률의 분모로 쓰기 때문에 그대로 넘기면 Infinity%가 표시된다 (getQuote와 같은 방어)
            const prevClose = result?.meta?.chartPreviousClose;
            chart = {
              ticker,
              currency: result?.meta?.currency ?? 'KRW',
              range,
              previousClose:
                Number.isFinite(prevClose) && prevClose! > 0
                  ? prevClose!
                  : null,
              points,
            };
          }
        }
      }
    } catch (e) {
      this.logger.warn(`차트 조회 실패 (${ticker}, ${range}): ${String(e)}`);
    }
    this.chartCache.set(key, { chart, at: Date.now() });
    return chart;
  }

  private readonly dividendCache = new Map<
    string,
    { payments: DividendPayment[]; at: number }
  >();

  /**
   * 과거 배당 ex-date 목록 (오름차순, 12시간 캐시).
   *
   * 같은 `v8/finance/chart` 엔드포인트에 `&events=div`만 붙인 것으로 키·crumb가 필요 없다.
   * (실적일용 `quoteSummary?modules=calendarEvents`는 401 Invalid Crumb로 막혀 있어 쓰지 않는다.)
   * 과거 이력만 내려오므로 미래 일정은 호출한 쪽에서 주기 외삽으로 추정한다.
   * 실패·미등록·무배당 종목은 빈 배열 — 캘린더의 실적 이벤트는 영향받지 않는다.
   */
  async getDividendDates(ticker: string): Promise<DividendPayment[]> {
    const cached = this.dividendCache.get(ticker);
    if (cached && Date.now() - cached.at < DIVIDEND_TTL_MS) {
      return cached.payments;
    }

    let payments: DividendPayment[] = [];
    try {
      const symbol = this.yahooSymbol(ticker);
      if (symbol) {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2y&interval=1d&events=div`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } },
        );
        if (res.ok) {
          const body = (await res.json()) as {
            chart?: {
              result?: {
                events?: {
                  dividends?: Record<
                    string,
                    { amount?: number; date?: number } | undefined
                  >;
                };
              }[];
            };
          };
          // 같은 ex-date가 두 번 오는 경우가 있어 날짜 기준으로 합친다
          const byDate = new Map<number, number>();
          for (const d of Object.values(
            body.chart?.result?.[0]?.events?.dividends ?? {},
          )) {
            if (!Number.isFinite(d?.amount) || !Number.isFinite(d?.date)) {
              continue;
            }
            byDate.set(d!.date! * 1000, d!.amount!);
          }
          payments = [...byDate]
            .map(([at, amount]) => ({ at, amount }))
            .sort((a, b) => a.at - b.at);
        }
      }
    } catch (e) {
      this.logger.warn(`배당 이력 조회 실패 (${ticker}): ${String(e)}`);
    }
    this.dividendCache.set(ticker, { payments, at: Date.now() });
    return payments;
  }

  private readonly sparkCache = new Map<
    string,
    { points: number[]; at: number }
  >();

  /**
   * 카드용 종가 스파크라인 (최근 1개월 일봉 ≈ 21포인트, 15분 캐시).
   *
   * `/v8/finance/chart`(getChart)는 종목당 1회지만 `/v7/finance/spark` 는
   * **심볼을 콤마로 여러 개 받는다** — 홈 카드 10개가 외부 호출 1회로 끝난다.
   * 키·crumb 불필요 (getDividendDates 와 같은 이유로 quoteSummary 계열은 쓰지 않는다).
   *
   * 5거래일이 아니라 1개월인 이유: 점 5개는 선이 아니라 지그재그로 보여
   * 72px 폭에서 형태를 못 만든다. 그리고 7일은 감성 트렌드 차트와 축이 겹쳐 혼동을 준다.
   *
   * 실패·미등록·상장폐지 종목은 결과에서 빠진다 (앱은 스파크라인만 생략한다).
   */
  async getSparks(tickers: string[]): Promise<Record<string, number[]>> {
    const unique = [...new Set(tickers)];
    const result: Record<string, number[]> = {};
    const staleBefore = Date.now() - SPARK_TTL_MS;
    const missing: string[] = [];

    for (const ticker of unique) {
      const cached = this.sparkCache.get(ticker);
      if (cached && cached.at > staleBefore) {
        if (cached.points.length > 1) result[ticker] = cached.points;
      } else {
        missing.push(ticker);
      }
    }

    for (let i = 0; i < missing.length; i += SPARK_CHUNK) {
      const chunk = missing.slice(i, i + SPARK_CHUNK);
      const bySymbol = new Map<string, string>();
      for (const ticker of chunk) {
        const symbol = this.yahooSymbol(ticker);
        if (symbol) bySymbol.set(symbol, ticker);
      }
      // 실패해도 15분 안에 다시 두드리지 않게 빈 값을 먼저 박아둔다
      const now = Date.now();
      for (const ticker of chunk) {
        this.sparkCache.set(ticker, { points: [], at: now });
      }
      if (bySymbol.size === 0) continue;

      try {
        const symbols = [...bySymbol.keys()].join(',');
        const res = await fetch(
          `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(symbols)}&range=1mo&interval=1d`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } },
        );
        if (!res.ok) continue;

        const body = (await res.json()) as {
          spark?: {
            result?: {
              symbol?: string;
              response?: {
                indicators?: { quote?: { close?: (number | null)[] }[] };
              }[];
            }[];
          };
        };

        for (const entry of body.spark?.result ?? []) {
          const ticker = bySymbol.get(entry.symbol ?? '');
          if (!ticker) continue;
          // 휴장일 등으로 null 이 섞여 온다 — 걸러내야 앱에서 NaN 좌표가 된다
          const points = (
            entry.response?.[0]?.indicators?.quote?.[0]?.close ?? []
          ).filter((p): p is number => Number.isFinite(p));
          this.sparkCache.set(ticker, { points, at: Date.now() });
          if (points.length > 1) result[ticker] = points;
        }
      } catch (e) {
        this.logger.warn(
          `스파크라인 조회 실패 (${chunk.join(',')}): ${String(e)}`,
        );
      }
    }

    return result;
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
