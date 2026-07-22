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
