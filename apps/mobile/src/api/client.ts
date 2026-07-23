import { Linking, Platform } from 'react-native';
import type {
  ApiResponse,
  AuthResponse,
  ChartRange,
  PriceChart,
  CollectRun,
  CollectSettings,
  DailyBriefing,
  Favorites,
  HistoryEntry,
  NewsItem,
  Recommendation,
  Sector,
  Sentiment,
  SentimentTrend,
  StockDetail,
  StockQuote,
  UserProfile,
} from '@daily-stocks/shared';

/** 개발용 로컬 API (Android 에뮬레이터는 10.0.2.2가 호스트) */
const BASE_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

/** 로그인 토큰 — AuthContext가 설정하고 모든 요청에 자동 첨부된다 */
let authToken: string | null = null;
export function setAuthToken(token: string | null): void {
  authToken = token;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...init?.headers,
    },
  });

  // 비-JSON 응답(HTML 에러 페이지, 빈 body)에도 상태코드 정보를 잃지 않는다
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    body = null;
  }

  if (!res.ok) {
    const message =
      body !== null &&
      typeof body === 'object' &&
      'error' in body &&
      typeof (body as { error: { message?: unknown } }).error?.message === 'string'
        ? (body as { error: { message: string } }).error.message
        : `요청 실패 (${res.status})`;
    throw new Error(message);
  }
  if (body === null) {
    throw new Error('서버 응답을 해석할 수 없습니다.');
  }
  return body as T;
}

/** 시세 가격 표시 — KRW는 원화, USD는 달러 */
export function formatPrice(quote: StockQuote): string {
  if (quote.currency === 'USD') return `$${quote.price.toFixed(2)}`;
  return `${Math.round(quote.price).toLocaleString('ko-KR')}원`;
}

/** 외부 링크는 http(s)만 연다 (피드 오염 시 tel:/sms: 등 임의 스킴 방어) */
export function openExternalUrl(url: string): void {
  if (/^https?:\/\//i.test(url)) {
    void Linking.openURL(url);
  }
}

export const api = {
  // --- 인증 ---
  devLogin: (nickname: string, termsAgreed: boolean) =>
    request<ApiResponse<AuthResponse>>('/auth/dev', {
      method: 'POST',
      body: JSON.stringify({ nickname, termsAgreed }),
    }),

  kakaoLogin: (accessToken: string, termsAgreed: boolean) =>
    request<ApiResponse<AuthResponse>>('/auth/kakao', {
      method: 'POST',
      body: JSON.stringify({ accessToken, termsAgreed }),
    }),

  appleLogin: (identityToken: string, termsAgreed: boolean, nickname?: string) =>
    request<ApiResponse<AuthResponse>>('/auth/apple', {
      method: 'POST',
      body: JSON.stringify({ identityToken, termsAgreed, nickname }),
    }),

  me: () => request<ApiResponse<UserProfile>>('/auth/me'),

  withdraw: () =>
    request<ApiResponse<{ removed: true }>>('/auth/me', { method: 'DELETE' }),

  // --- 데이터 ---
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

  briefing: () => request<ApiResponse<DailyBriefing>>('/briefing'),

  priceChart: (ticker: string, range: ChartRange) =>
    request<ApiResponse<PriceChart | null>>(
      `/quotes/chart?ticker=${encodeURIComponent(ticker)}&range=${range}`,
    ),

  quotes: (tickers: string[]) =>
    request<ApiResponse<Record<string, StockQuote | null>>>(
      `/quotes?tickers=${encodeURIComponent(tickers.join(','))}`,
    ),

  stockDetail: (ticker: string) =>
    request<ApiResponse<StockDetail>>(`/stocks/${encodeURIComponent(ticker)}`),

  tickerTrend: (ticker: string) =>
    request<ApiResponse<SentimentTrend>>(
      `/trends?ticker=${encodeURIComponent(ticker)}`,
    ),

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
