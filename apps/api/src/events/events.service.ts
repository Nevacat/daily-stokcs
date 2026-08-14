import { Injectable } from '@nestjs/common';
import type { CatalogStock, StockEvent } from '@daily-stocks/shared';
import { CatalogService } from '../catalog/catalog.service';
import { FavoritesService } from '../favorites/favorites.service';
import { PriceService } from '../price/price.service';

const DAY_MS = 86_400_000;
const KST_OFFSET_MS = 9 * 3_600_000;
/** 조회 창 — 오늘(KST 00:00) 부터 +90일 */
const WINDOW_DAYS = 90;
/** 한 번에 다룰 종목 상한 — Yahoo 호출 횟수를 묶어둔다 */
export const MAX_TICKERS = 20;

/**
 * 12월 결산법인 정기보고서 제출 기한 (자본시장법). KST 기준 고정 날짜다.
 *
 * ponytail: 결산월을 12월로 가정한다. 비-12월 결산법인은 예정일이 어긋난다.
 * 카탈로그(CatalogStock)에 결산월이 들어오거나 DART 오픈API를 붙이면
 * 종목별 정확한 기한으로 교체한다. 그때까지는 화면의 '예상 날짜' 문구가 상한이다.
 */
const EARNINGS_DEADLINES: { md: string; label: string }[] = [
  { md: '03-31', label: '지난해 연간 실적 공시 기한이에요' },
  { md: '05-15', label: '1분기 실적 공시 기한이에요' },
  { md: '08-14', label: '상반기 실적 공시 기한이에요' },
  { md: '11-14', label: '3분기 실적 공시 기한이에요' },
];

/** KST 기준 YYYY-MM-DD */
const kstDate = (ms: number): string =>
  new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10);

/**
 * 중앙값. 배당 주기 계산에서 평균을 쓰면 특별배당 1회에 크게 흔들리므로 중앙값을 쓴다.
 * 빈 배열은 호출 전에 걸러진다.
 */
export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * 실적·배당 예정 이벤트 (기획서 §3 확장).
 *
 * **여기서 만드는 날짜는 전부 추정치다.** 확정 일정을 주는 무료 소스가 없다.
 *  - 실적: 법정 공시 기한 규칙 (외부 호출 0회, 12월 결산 가정, KR 종목만)
 *  - 배당: Yahoo 과거 ex-date의 중앙값 주기 외삽
 * 화면에서 반드시 '예상'임을 함께 노출해야 한다 (EventTimeline 캡션).
 */
@Injectable()
export class EventsService {
  constructor(
    private readonly catalog: CatalogService,
    private readonly price: PriceService,
    private readonly favorites: FavoritesService,
  ) {}

  /** 관심 종목 기준 (인증 사용자) */
  forUser(userId: string, now: Date = new Date()): Promise<StockEvent[]> {
    return this.build(this.favorites.get(userId).tickers, now);
  }

  /**
   * 오늘 ~ +90일(KST) 창의 예정 이벤트를 date 오름차순으로.
   * 배당 조회(외부 호출)가 실패해도 규칙 기반 실적 이벤트는 그대로 나온다.
   */
  async build(
    tickers: string[],
    now: Date = new Date(),
  ): Promise<StockEvent[]> {
    const stocks = [...new Set(tickers)]
      .slice(0, MAX_TICKERS)
      .map((t) => this.catalog.find(t))
      .filter((s): s is CatalogStock => s !== null);

    const from = kstDate(now.getTime());
    const to = kstDate(now.getTime() + WINDOW_DAYS * DAY_MS);
    const inWindow = (date: string): boolean => date >= from && date <= to;

    const events = stocks.flatMap((s) => this.earnings(s, from, inWindow));
    const dividends = await Promise.all(
      stocks.map((s) => this.dividend(s, from)),
    );
    for (const e of dividends) {
      if (e && inWindow(e.date)) events.push(e);
    }

    return events.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.ticker.localeCompare(b.ticker) ||
        a.kind.localeCompare(b.kind),
    );
  }

  /**
   * (A) 실적 — 법정 공시 기한 규칙. 외부 호출 0회.
   * 미국 종목은 실적일을 추정할 근거가 없으므로 **만들지 않는다**
   * (대충 만든 날짜는 틀린 정보라 없는 게 낫다).
   */
  private earnings(
    stock: CatalogStock,
    from: string,
    inWindow: (date: string) => boolean,
  ): StockEvent[] {
    if (stock.market !== 'KR') return [];
    const year = Number(from.slice(0, 4));
    // 창이 연말을 넘을 수 있어 올해+내년 후보를 만든 뒤 창으로 거른다
    return [year, year + 1]
      .flatMap((y) =>
        EARNINGS_DEADLINES.map((d) => ({ date: `${y}-${d.md}`, ...d })),
      )
      .filter((d) => inWindow(d.date))
      .map((d) => ({
        ticker: stock.ticker,
        stockName: stock.name,
        kind: 'earnings' as const,
        date: d.date,
        label: d.label,
      }));
  }

  /**
   * (B) 배당 — 과거 ex-date의 중앙값 주기로 다음 1회를 외삽.
   *
   * ponytail: 배당 정책을 바꾼 회사(연 1회 → 분기)는 다음 1회가 어긋난다.
   * 확정 공시 소스가 붙을 때까지의 상한.
   */
  private async dividend(
    stock: CatalogStock,
    today: string,
  ): Promise<StockEvent | null> {
    const payments = await this.price.getDividendDates(stock.ticker);
    if (payments.length < 2) return null; // 주기 계산 불가 (무배당·신규상장·조회 실패)

    const gap = median(payments.slice(1).map((p, i) => p.at - payments[i].at));
    if (gap < DAY_MS) return null; // 하루보다 잦은 배당은 없다 — 데이터 이상 방어

    const last = payments[payments.length - 1];
    let next = last.at + gap;
    // 오래 배당하지 않은 종목이 과거 날짜를 뱉지 않게 오늘 이후로 민다
    while (kstDate(next) < today) next += gap;

    // 금액은 반드시 '지난 배당'(과거 사실)으로 표기한다. 다음 배당액은 알 수 없다.
    const amount =
      stock.market === 'US'
        ? `$${last.amount}`
        : `${Math.round(last.amount).toLocaleString('ko-KR')}원`;

    return {
      ticker: stock.ticker,
      stockName: stock.name,
      kind: 'dividend',
      date: kstDate(next),
      label: `배당 기준일 예상 (지난 배당 ${amount})`,
    };
  }
}
