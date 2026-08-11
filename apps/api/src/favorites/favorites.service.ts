import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  FavoriteEntry,
  Favorites,
  PaperPortfolio,
  PaperPosition,
} from '@daily-stocks/shared';
import { SECTORS } from '@daily-stocks/shared';
import { CatalogService } from '../catalog/catalog.service';
import { JsonStore } from '../common/json-store';
import { changePct } from '../common/pct';
import { PriceService } from '../price/price.service';

const EMPTY: Favorites = { tickers: [], sectors: [] };

/** 사용자별 관심 종목/섹터 (기획서 §3.1) */
@Injectable()
export class FavoritesService {
  /**
   * price 는 '담은 시점 가격' 기록용 보조 의존성이다.
   * 앱 구동 시에는 항상 주입되고(FavoritesModule → PriceModule),
   * 없으면 priceAtAdd 가 null 이 될 뿐이다 — 시세 조회 실패와 같은 경로라 담기는 성공한다.
   */
  constructor(
    private readonly catalog: CatalogService,
    private readonly price?: PriceService,
  ) {}

  private readonly store = new JsonStore<Record<string, Favorites>>(
    'favorites',
  );
  private byUser: Record<string, Favorites> = this.store.load() ?? {};

  /**
   * 사용자별 쓰기 대기열. update()는 시세 조회(HTTP)를 await 하므로 읽기~저장 사이가 벌어진다.
   * 같은 사용자의 요청이 겹치면 뒤 요청이 낡은 스냅샷으로 앞 요청을 덮어쓰기 때문에
   * 사용자 단위로 직렬화한다. (다른 사용자끼리는 서로 막지 않는다)
   *
   * ponytail: 프로세스 내 메모리 체인이라 서버를 여러 대로 늘리면 무력해진다.
   * 그때는 이 파일 저장소를 DB로 옮기면서 행 잠금이나 버전 컬럼(낙관적 잠금)으로 교체한다.
   * 사용자 수만큼 항목이 남지만 byUser 자체가 이미 같은 크기라 별도 정리는 두지 않는다.
   */
  private readonly writeQueue = new Map<string, Promise<unknown>>();

  private serializeWrite<T>(
    userId: string,
    task: () => Promise<T>,
  ): Promise<T> {
    const run = (this.writeQueue.get(userId) ?? Promise.resolve()).then(task);
    // 대기열에는 항상 성공으로 끝나는 프로미스를 넣는다.
    // 앞 요청이 400으로 끝나도 뒤 요청이 막히지 않고, unhandled rejection도 나지 않는다.
    this.writeQueue.set(
      userId,
      run.catch(() => undefined),
    );
    return run;
  }

  get(userId: string): Favorites {
    return this.byUser[userId] ?? EMPTY;
  }

  update(userId: string, input: Partial<Favorites>): Promise<Favorites> {
    return this.serializeWrite(userId, () => this.applyUpdate(userId, input));
  }

  /** 실제 갱신 — 반드시 serializeWrite 안에서만 호출한다 (읽기~저장이 원자적이어야 한다) */
  private async applyUpdate(
    userId: string,
    input: Partial<Favorites>,
  ): Promise<Favorites> {
    // body 타입 방어: 배열이 아니거나 문자열이 아닌 요소가 있으면 400
    for (const [field, value] of [
      ['tickers', input.tickers],
      ['sectors', input.sectors],
    ] as const) {
      if (
        value !== undefined &&
        (!Array.isArray(value) || value.some((v) => typeof v !== 'string'))
      ) {
        throw new BadRequestException({
          error: {
            code: 'INVALID_BODY',
            message: `${field}는 문자열 배열이어야 합니다.`,
          },
        });
      }
    }

    const current = this.get(userId);
    const tickers = [...new Set(input.tickers ?? current.tickers)];
    const sectors = [...new Set(input.sectors ?? current.sectors)];

    const badTicker = tickers.find((t) => !this.catalog.find(t));
    if (badTicker) {
      throw new BadRequestException({
        error: {
          code: 'UNKNOWN_TICKER',
          message: `알 수 없는 종목입니다: ${badTicker}`,
        },
      });
    }
    const badSector = sectors.find((s) => !SECTORS.includes(s));
    if (badSector) {
      throw new BadRequestException({
        error: {
          code: 'UNKNOWN_SECTOR',
          message: `알 수 없는 섹터입니다: ${String(badSector)}`,
        },
      });
    }

    const entries = await this.nextEntries(current, tickers);

    this.byUser = { ...this.byUser, [userId]: { tickers, sectors, entries } };
    this.store.save(this.byUser);
    return this.byUser[userId];
  }

  /**
   * '담은 시점' 기록 갱신 (모의 포트폴리오용).
   * - 새로 담은 종목만 기록한다 — 이미 담겨 있던 구버전 종목에 지금 시각을 채우면 가짜 데이터가 된다.
   * - 해제된 종목의 기록은 지운다. 다시 담으면 그 시점으로 새로 기록된다.
   */
  private async nextEntries(
    current: Favorites,
    tickers: string[],
  ): Promise<Record<string, FavoriteEntry>> {
    const entries = Object.fromEntries(
      Object.entries(current.entries ?? {}).filter(([t]) =>
        tickers.includes(t),
      ),
    );
    for (const ticker of tickers) {
      if (entries[ticker] || current.tickers.includes(ticker)) continue;
      entries[ticker] = {
        addedAt: new Date().toISOString(),
        priceAtAdd: (await this.price?.getPrice(ticker)) ?? null,
      };
    }
    return entries;
  }

  /**
   * 종목 즐겨찾기 토글 — 앱 카드의 별 버튼용.
   * 현재 목록을 읽어 뒤집는 read-modify-write라 update()와 같은 대기열 안에서 돌아야 한다.
   * (밖에서 읽으면 겹친 토글이 같은 낡은 목록을 보고 서로를 지운다)
   */
  toggleTicker(userId: string, ticker: string): Promise<Favorites> {
    return this.serializeWrite(userId, () => {
      const current = this.get(userId);
      const has = current.tickers.includes(ticker);
      return this.applyUpdate(userId, {
        tickers: has
          ? current.tickers.filter((t) => t !== ticker)
          : [...current.tickers, ticker],
      });
    });
  }

  /**
   * 모의 포트폴리오 — 담은 시점 가격 대비 등락률.
   * 실제 매매가 아니라 '담은 날 가격'으로 계산한 가상 수치다(수량·수수료·세금 개념 없음).
   */
  async portfolio(
    userId: string,
    now: Date = new Date(),
  ): Promise<PaperPortfolio> {
    const favorites = this.get(userId);
    const quotes = (await this.price?.getQuotes(favorites.tickers)) ?? {};

    const positions: PaperPosition[] = favorites.tickers.map((ticker) => {
      const stock = this.catalog.find(ticker);
      const entry = favorites.entries?.[ticker];
      const quote = quotes[ticker] ?? null;
      const priceAtAdd = entry?.priceAtAdd ?? null;
      const currentPrice = quote?.price ?? null;
      return {
        ticker,
        stockName: stock?.name ?? ticker,
        addedAt: entry?.addedAt ?? null,
        priceAtAdd,
        currentPrice,
        currency: quote?.currency ?? (stock?.market === 'US' ? 'USD' : 'KRW'),
        changePct: changePct(priceAtAdd, currentPrice),
      };
    });

    // 수량 개념이 없으므로 금액 가중이 아니라 계산 가능한 종목의 단순 평균이다.
    const measured = positions
      .map((p) => p.changePct)
      .filter((pct): pct is number => pct !== null);
    const sum = measured.reduce((acc, pct) => acc + pct, 0);

    return {
      positions,
      averageChangePct: measured.length
        ? Math.round((sum / measured.length) * 100) / 100
        : null,
      measuredCount: measured.length,
      asOf: now.toISOString(),
    };
  }

  /** 전체 사용자의 관심 티커 합집합 — 푸시 알림 대상 판단용 */
  allFavoriteTickers(): Set<string> {
    return new Set(Object.values(this.byUser).flatMap((f) => f.tickers));
  }

  /** 회원 탈퇴 시 데이터 정리 */
  removeUser(userId: string): void {
    if (!(userId in this.byUser)) return;
    this.byUser = Object.fromEntries(
      Object.entries(this.byUser).filter(([id]) => id !== userId),
    );
    this.store.save(this.byUser);
  }
}
