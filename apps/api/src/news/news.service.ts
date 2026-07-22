import { BadRequestException, Injectable } from '@nestjs/common';
import type { NewsItem, Sector, Sentiment } from '@daily-stocks/shared';
import { JsonStore } from '../common/json-store';

/** 뉴스 보존 기간. 반감기(24h) 특성상 이후에는 점수 기여가 사실상 0이다 */
const RETENTION_DAYS = 7;

export interface NewsQuery {
  sector?: Sector;
  ticker?: string;
  sentiment?: Sentiment;
  cursor?: string;
  limit?: number;
}

@Injectable()
export class NewsService {
  private readonly store = new JsonStore<NewsItem[]>('news');
  private items: NewsItem[] = this.store.load() ?? [];

  /** URL 또는 정규화된 제목이 같으면 중복으로 본다 (기획서 §2.1) */
  private normalizeTitle(title: string): string {
    return title.replace(/\s+/g, '').replace(/[^\p{L}\p{N}]/gu, '');
  }

  /** 보존 기간이 지난 뉴스 제거 (무한 누적 방지) */
  private prune(items: NewsItem[], now: Date): NewsItem[] {
    const cutoff = new Date(
      now.getTime() - RETENTION_DAYS * 24 * 3_600_000,
    ).toISOString();
    return items.filter((n) => n.publishedAt >= cutoff);
  }

  /** 새 뉴스만 추가하고, 추가된 목록을 반환 */
  upsert(candidates: NewsItem[], now: Date = new Date()): NewsItem[] {
    const urls = new Set(this.items.map((n) => n.url));
    const titles = new Set(this.items.map((n) => this.normalizeTitle(n.title)));

    const added: NewsItem[] = [];
    // 보존 기간이 지난 후보는 애초에 신규로 집계하지 않는다
    for (const item of this.prune(candidates, now)) {
      const normalized = this.normalizeTitle(item.title);
      if (urls.has(item.url) || titles.has(normalized)) continue;
      urls.add(item.url);
      titles.add(normalized);
      added.push(item);
    }

    // 신규가 없어도 기존 항목의 보존 기간 만료는 항상 반영한다
    const pruned = this.prune(this.items, now);
    if (added.length > 0 || pruned.length !== this.items.length) {
      this.items = [...pruned, ...added].sort(
        (a, b) =>
          b.publishedAt.localeCompare(a.publishedAt) ||
          b.id.localeCompare(a.id),
      );
      this.store.save(this.items);
    }
    return added;
  }

  findAll(): NewsItem[] {
    return this.items;
  }

  findByIds(ids: string[]): NewsItem[] {
    const set = new Set(ids);
    return this.items.filter((n) => set.has(n.id));
  }

  /** 최신순 + 커서 페이지네이션 (rules/api-design.md) */
  query(q: NewsQuery): { items: NewsItem[]; nextCursor?: string } {
    let list = this.items;
    if (q.sector) list = list.filter((n) => n.sectors.includes(q.sector!));
    if (q.ticker) list = list.filter((n) => n.tickers.includes(q.ticker!));
    if (q.sentiment) list = list.filter((n) => n.sentiment === q.sentiment);

    if (q.cursor) {
      const decoded = Buffer.from(q.cursor, 'base64url').toString();
      const [publishedAt, id] = decoded.split('|');
      if (!publishedAt || !id || Number.isNaN(Date.parse(publishedAt))) {
        throw new BadRequestException({
          error: {
            code: 'INVALID_CURSOR',
            message: '유효하지 않은 커서입니다.',
          },
        });
      }
      list = list.filter(
        (n) =>
          n.publishedAt < publishedAt ||
          (n.publishedAt === publishedAt && n.id < id),
      );
    }

    // NaN·음수·소수 방어: 1~100으로 정규화 (기본 20)
    const requested = Number.isFinite(q.limit) ? Math.floor(q.limit!) : 20;
    const limit = Math.min(Math.max(requested, 1), 100);
    const items = list.slice(0, limit);
    const last = items[items.length - 1];
    const nextCursor =
      list.length > limit && last
        ? Buffer.from(`${last.publishedAt}|${last.id}`).toString('base64url')
        : undefined;

    return { items, nextCursor };
  }
}
