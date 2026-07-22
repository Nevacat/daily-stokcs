import { Platform } from 'react-native';
import type {
  ApiResponse,
  CollectRun,
  CollectSettings,
  Favorites,
  HistoryEntry,
  NewsItem,
  Recommendation,
  Sector,
  Sentiment,
} from '@daily-stocks/shared';

/** 개발용 로컬 API (Android 에뮬레이터는 10.0.2.2가 호스트) */
const BASE_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = (await res.json()) as T & { error?: { message: string } };
  if (!res.ok) {
    throw new Error(body.error?.message ?? `요청 실패 (${res.status})`);
  }
  return body;
}

export const api = {
  collect: () => request<ApiResponse<CollectRun>>('/collect', { method: 'POST' }),

  collectStatus: () =>
    request<ApiResponse<{ lastRun?: CollectRun }>>('/collect/status'),

  recommendations: (sector?: Sector) =>
    request<ApiResponse<Recommendation[]>>(
      sector ? `/recommendations?sector=${sector}` : '/recommendations',
    ),

  recommendationDetail: (id: string) =>
    request<ApiResponse<{ recommendation: Recommendation; evidence: NewsItem[] }>>(
      `/recommendations/${encodeURIComponent(id)}`,
    ),

  news: (params: { sector?: Sector; sentiment?: Sentiment; cursor?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.sector) query.set('sector', params.sector);
    if (params.sentiment) query.set('sentiment', params.sentiment);
    if (params.cursor) query.set('cursor', params.cursor);
    const qs = query.toString();
    return request<ApiResponse<NewsItem[]>>(`/news${qs ? `?${qs}` : ''}`);
  },

  history: (limit = 14) =>
    request<ApiResponse<HistoryEntry[]>>(`/history?limit=${limit}`),

  favorites: () => request<ApiResponse<Favorites>>('/favorites'),

  toggleFavorite: (ticker: string) =>
    request<ApiResponse<Favorites>>(
      `/favorites/tickers/${encodeURIComponent(ticker)}/toggle`,
      { method: 'POST' },
    ),

  settings: () => request<ApiResponse<CollectSettings>>('/settings'),

  updateSettings: (settings: CollectSettings) =>
    request<ApiResponse<CollectSettings>>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
};

/** ISO(UTC) → KST 표시 (CLAUDE.md: 저장은 UTC, 표시는 KST) */
export function formatKst(iso?: string): string {
  if (!iso) return '-';
  const date = new Date(new Date(iso).getTime() + 9 * 3_600_000);
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mi = String(date.getUTCMinutes()).padStart(2, '0');
  return `${mm}.${dd} ${hh}:${mi}`;
}
