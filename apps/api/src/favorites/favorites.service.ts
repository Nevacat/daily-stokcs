import { BadRequestException, Injectable } from '@nestjs/common';
import type { Favorites } from '@daily-stocks/shared';
import { SECTORS } from '@daily-stocks/shared';
import { JsonStore } from '../common/json-store';
import { STOCKS } from '../collect/analyzer/dictionaries';

const EMPTY: Favorites = { tickers: [], sectors: [] };

@Injectable()
export class FavoritesService {
  private readonly store = new JsonStore<Favorites>('favorites');
  private favorites: Favorites = this.store.load() ?? EMPTY;

  get(): Favorites {
    return this.favorites;
  }

  update(input: Partial<Favorites>): Favorites {
    const tickers = [...new Set(input.tickers ?? this.favorites.tickers)];
    const sectors = [...new Set(input.sectors ?? this.favorites.sectors)];

    const knownTickers = new Set(STOCKS.map((s) => s.ticker));
    const badTicker = tickers.find((t) => !knownTickers.has(t));
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

    this.favorites = { tickers, sectors };
    this.store.save(this.favorites);
    return this.favorites;
  }

  /** 종목 즐겨찾기 토글 — 앱 카드의 별 버튼용 */
  toggleTicker(ticker: string): Favorites {
    const has = this.favorites.tickers.includes(ticker);
    return this.update({
      tickers: has
        ? this.favorites.tickers.filter((t) => t !== ticker)
        : [...this.favorites.tickers, ticker],
    });
  }
}
