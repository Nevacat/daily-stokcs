/** API·앱이 공유하는 도메인 타입 (기획서 §2, §5 기준) */

/** 기본 섹터 8종 (기획서 §2.2) */
export const SECTORS = [
  'semiconductor_ai',
  'battery',
  'bio_healthcare',
  'automotive',
  'finance',
  'entertainment',
  'defense_shipbuilding',
  'energy_chemical',
] as const;

export type Sector = (typeof SECTORS)[number];

export const SECTOR_LABELS: Record<Sector, string> = {
  semiconductor_ai: '반도체/AI',
  battery: '2차전지',
  bio_healthcare: '바이오/헬스케어',
  automotive: '자동차',
  finance: '금융',
  entertainment: '엔터/콘텐츠',
  defense_shipbuilding: '방산/조선',
  energy_chemical: '에너지/화학',
};

/** 시장 구분: 국내(KRX) / 미국 */
export type Market = 'KR' | 'US';

export const MARKET_LABELS: Record<Market, string> = {
  KR: '국내',
  US: '미국',
};

export type Sentiment = 'positive' | 'negative' | 'neutral';

export interface NewsItem {
  id: string;
  title: string;
  press: string;
  publishedAt: string; // ISO 8601 UTC
  url: string;
  sectors: Sector[];
  tickers: string[];
  sentiment: Sentiment;
  /** 기사 썸네일 (RSS 제공 시) */
  imageUrl?: string;
}

export interface Recommendation {
  id: string;
  ticker: string;
  stockName: string;
  sector: Sector;
  /** 0~100 종합 점수 (기획서 §5) */
  score: number;
  /** 1~2문장 추천 요약 */
  reason: string;
  /** 근거 뉴스 id 목록 */
  newsIds: string[];
  recommendedAt: string; // ISO 8601 UTC
  /** 시장 구분 — 구버전 데이터엔 없을 수 있음(없으면 KR로 간주) */
  market?: Market;
  /** 추천 시점 주가 — 주가 API 키(KIS) 설정 시 채워짐 (기획서 §3.3 적중률) */
  priceAtRecommendation?: number | null;
  /** 조회 시점 현재가 — 히스토리 조회 시 계산 */
  currentPrice?: number | null;
  /** 추천 시점 대비 등락률(%) — 두 가격이 모두 있을 때만 */
  changePct?: number | null;
}

export type CollectStatus = 'idle' | 'collecting' | 'analyzing' | 'done' | 'failed';

export interface CollectRun {
  id: string;
  trigger: 'auto' | 'manual';
  status: CollectStatus;
  startedAt: string;
  finishedAt?: string;
  newsCount: number;
}

/** 실시간(지연) 시세 — Yahoo Finance 기반, 키 불필요 */
export interface StockQuote {
  ticker: string;
  price: number;
  previousClose: number;
  /** 전일 종가 대비 등락률(%) */
  changePct: number;
  currency: string; // KRW | USD
  at: string; // ISO 8601 UTC
}

/** 주가 차트 구간 */
export const CHART_RANGES = ['1d', '1w', '1m', '3m', '1y'] as const;
export type ChartRange = (typeof CHART_RANGES)[number];

export const CHART_RANGE_LABELS: Record<ChartRange, string> = {
  '1d': '1일',
  '1w': '1주',
  '1m': '1달',
  '3m': '3달',
  '1y': '1년',
};

/** 주가 차트 데이터 (Yahoo 기반, 15~20분 지연) */
export interface PriceChart {
  ticker: string;
  currency: string;
  range: ChartRange;
  /** 1d 기준선(전일 종가). 그 외 구간은 첫 포인트 기준 */
  previousClose: number | null;
  points: { t: string; price: number }[];
}

/** 전체 상장사 카탈로그 항목 (서버가 KRX에서 일 1회 갱신) */
export interface CatalogStock {
  ticker: string;
  name: string;
  market: Market;
  exchange?: 'KOSPI' | 'KOSDAQ';
  /** 8개 섹터로 매핑 안 되는 종목은 없음 — 추천 대상에서 제외되지만 검색·시세는 가능 */
  sector?: Sector;
  /** KRX 업종명 (원본) */
  industry?: string;
  domain?: string;
  aliases?: string[];
}

/** 앱 검색용 경량 카탈로그 항목 */
export interface CatalogStockLite {
  ticker: string;
  name: string;
  market: Market;
}

/** 종목 상세 (§4 IA — 뉴스·히스토리에서 진입하는 독립 상세) */
export interface StockDetail {
  stock: {
    ticker: string;
    name: string;
    /** 섹터 미분류 종목은 null */
    sector: Sector | null;
    market: Market;
  };
  /** 현재 추천 중이 아니면 null */
  recommendation: Recommendation | null;
  /** 시세 조회 실패 시 null */
  quote: StockQuote | null;
  trend: SentimentTrend;
  /** 관련 뉴스 최신순 */
  news: NewsItem[];
}

/** 데일리 브리핑 (기획서 §3.4 — 오늘의 시장 요약 + 주목 섹터 + Top 3) */
export interface DailyBriefing {
  /** KST 기준 YYYY-MM-DD */
  date: string;
  generatedAt: string; // ISO 8601 UTC
  /** 오늘(KST) 수집 뉴스 감성 분포 */
  marketSummary: {
    total: number;
    positive: number;
    negative: number;
    neutral: number;
  };
  /** 긍정 뉴스가 많은 섹터 상위 3 */
  topSectors: { sector: Sector; positiveCount: number }[];
  /** 점수 상위 추천 3 */
  topPicks: Recommendation[];
}

/** 일별 감성 집계 (기획서 §3.5 — 최근 7일 트렌드) */
export interface SentimentTrendDay {
  /** KST 기준 YYYY-MM-DD */
  date: string;
  positive: number;
  negative: number;
  neutral: number;
}

export interface SentimentTrend {
  /** ticker 또는 sector 중 하나 */
  target: { ticker?: string; sector?: Sector };
  /** 과거 → 오늘 순 7일 */
  days: SentimentTrendDay[];
}

/** 날짜별 추천 스냅샷 (기획서 §3.3 — 해당 날짜의 마지막 추천 결과) */
export interface HistoryEntry {
  /** KST 기준 YYYY-MM-DD */
  date: string;
  generatedAt: string; // ISO 8601 UTC
  recommendations: Recommendation[];
}

/** 로그인 제공자 — dev는 개발용(프로덕션 비활성) */
export type AuthProvider = 'kakao' | 'apple' | 'dev';

export interface UserProfile {
  id: string;
  provider: AuthProvider;
  nickname: string;
  email?: string;
  /** 약관 동의 시각 (가입 시 필수) */
  termsAgreedAt: string; // ISO 8601 UTC
  createdAt: string; // ISO 8601 UTC
}

export interface AuthResponse {
  /** Bearer 토큰 (30일) */
  token: string;
  user: UserProfile;
}

/** 푸시 알림 디바이스 등록 (기획서 §3.2) */
export interface DeviceRegistration {
  /** FCM 디바이스 토큰 */
  token: string;
  platform: 'ios' | 'android';
  registeredAt: string; // ISO 8601 UTC
}

/** 관심 종목/섹터 (기획서 §3.1) */
export interface Favorites {
  tickers: string[];
  sectors: Sector[];
}

/** 자동 수집 주기 옵션(분). null = 자동 수집 끄기 (기획서 §2.1) */
export const ALLOWED_INTERVALS = [30, 60, 180, 360, 1440] as const;

export interface CollectSettings {
  /** 30 | 60 | 180 | 360 | 1440 | null(끄기) */
  intervalMinutes: (typeof ALLOWED_INTERVALS)[number] | null;
}

/** 공통 API 응답 포맷 (rules/api-design.md) */
export interface ApiResponse<T> {
  data: T;
  meta?: {
    collectedAt?: string;
    nextCollectAt?: string;
    cursor?: string;
  };
}

export interface ApiError {
  error: { code: string; message: string };
}

export { STOCKS, type StockEntry } from './stocks';
