import { Injectable } from '@nestjs/common';
import type { HistoryEntry, Recommendation } from '@daily-stocks/shared';
import { JsonStore } from '../common/json-store';

/** 보관 일수 상한 (무료 티어 정책은 기획서 §3.7에서 확정) */
const MAX_DAYS = 30;

/**
 * 추천 히스토리 (기획서 §3.3).
 * 수집 파이프라인이 추천을 재생성할 때마다 스냅샷을 기록하며,
 * 날짜(KST)당 마지막 결과만 보관한다.
 * 적중률(추천 시점 대비 주가 등락)은 주가 API 연동 후 추가 예정.
 */
@Injectable()
export class HistoryService {
  private readonly store = new JsonStore<HistoryEntry[]>('history');
  private entries: HistoryEntry[] = this.store.load() ?? [];

  /** KST 기준 날짜 문자열 */
  private kstDate(now: Date): string {
    return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
  }

  record(recommendations: Recommendation[], now: Date = new Date()): void {
    if (recommendations.length === 0) return; // 빈 결과는 기록하지 않음

    const date = this.kstDate(now);
    const entry: HistoryEntry = {
      date,
      generatedAt: now.toISOString(),
      recommendations,
    };

    this.entries = [entry, ...this.entries.filter((e) => e.date !== date)]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, MAX_DAYS);
    this.store.save(this.entries);
  }

  list(limit = 14): HistoryEntry[] {
    // NaN·음수 방어: 1~MAX_DAYS로 정규화
    const requested = Number.isFinite(limit) ? Math.floor(limit) : 14;
    return this.entries.slice(0, Math.min(Math.max(requested, 1), MAX_DAYS));
  }
}
