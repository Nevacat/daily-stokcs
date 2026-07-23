import { BadRequestException, Injectable } from '@nestjs/common';
import type { Favorites } from '@daily-stocks/shared';
import { SECTORS } from '@daily-stocks/shared';
import { CatalogService } from '../catalog/catalog.service';
import { JsonStore } from '../common/json-store';

const EMPTY: Favorites = { tickers: [], sectors: [] };

/** 사용자별 관심 종목/섹터 (기획서 §3.1) */
@Injectable()
export class FavoritesService {
  constructor(private readonly catalog: CatalogService) {}

  private readonly store = new JsonStore<Record<string, Favorites>>(
    'favorites',
  );
  private byUser: Record<string, Favorites> = this.store.load() ?? {};

  get(userId: string): Favorites {
    return this.byUser[userId] ?? EMPTY;
  }

  update(userId: string, input: Partial<Favorites>): Favorites {
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

    this.byUser = { ...this.byUser, [userId]: { tickers, sectors } };
    this.store.save(this.byUser);
    return this.byUser[userId];
  }

  /** 종목 즐겨찾기 토글 — 앱 카드의 별 버튼용 */
  toggleTicker(userId: string, ticker: string): Favorites {
    const current = this.get(userId);
    const has = current.tickers.includes(ticker);
    return this.update(userId, {
      tickers: has
        ? current.tickers.filter((t) => t !== ticker)
        : [...current.tickers, ticker],
    });
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
