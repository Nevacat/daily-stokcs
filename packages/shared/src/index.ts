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
