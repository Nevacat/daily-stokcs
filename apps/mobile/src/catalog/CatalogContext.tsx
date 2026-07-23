import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CatalogStockLite } from '@daily-stocks/shared';
import { STOCKS } from '@daily-stocks/shared';
import { api } from '../api/client';

const CACHE_KEY = 'detok.catalog';
const CACHE_TTL_MS = 24 * 3_600_000;

interface CatalogValue {
  stocks: CatalogStockLite[];
  nameOf: (ticker: string) => string;
  search: (query: string, limit?: number) => CatalogStockLite[];
}

const CatalogContext = createContext<CatalogValue | null>(null);

const CURATED: CatalogStockLite[] = STOCKS.map(({ ticker, name, market }) => ({
  ticker,
  name,
  market,
}));

/** 전체 종목 카탈로그 — 서버에서 1회 로드해 24h 캐시 (검색·이름 표시용) */
export function CatalogProvider({ children }: PropsWithChildren) {
  const [stocks, setStocks] = useState<CatalogStockLite[]>(CURATED);

  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as {
            at: number;
            stocks: CatalogStockLite[];
          };
          if (parsed.stocks?.length) setStocks(parsed.stocks);
          if (Date.now() - parsed.at < CACHE_TTL_MS) return; // 아직 신선함
        }
        const res = await api.stockCatalog();
        if (res.data.length > CURATED.length) {
          setStocks(res.data);
          await AsyncStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ at: Date.now(), stocks: res.data }),
          );
        }
      } catch {
        // 실패 시 큐레이션/캐시 유지
      }
    })();
  }, []);

  const value = useMemo<CatalogValue>(() => {
    const byTicker = new Map(stocks.map(s => [s.ticker, s.name]));
    return {
      stocks,
      nameOf: ticker => byTicker.get(ticker) ?? ticker,
      search: (query, limit = 20) => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        const starts: CatalogStockLite[] = [];
        const includes: CatalogStockLite[] = [];
        for (const s of stocks) {
          const name = s.name.toLowerCase();
          if (name.startsWith(q) || s.ticker.toLowerCase().startsWith(q)) {
            starts.push(s);
          } else if (name.includes(q)) {
            includes.push(s);
          }
          if (starts.length >= limit) break;
        }
        return [...starts, ...includes].slice(0, limit);
      },
    };
  }, [stocks]);

  return (
    <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
  );
}

export function useCatalog(): CatalogValue {
  const ctx = useContext(CatalogContext);
  if (!ctx)
    throw new Error('useCatalog은 CatalogProvider 안에서만 사용할 수 있어요.');
  return ctx;
}
