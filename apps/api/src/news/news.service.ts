import { Injectable } from '@nestjs/common';
import type { NewsItem, Sector, Sentiment } from '@daily-stocks/shared';
import { JsonStore } from '../common/json-store';

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

  /** 새 뉴스만 추가하고, 추가된 목록을 반환 */
  upsert(candidates: NewsItem[]): NewsItem[] {
    const urls = new Set(this.items.map((n) => n.url));
    const titles = new Set(this.items.map((n) => this.normalizeTitle(n.title)));

    const added: NewsItem[] = [];
    for (const item of candidates) {
      const normalized = this.normalizeTitle(item.title);
      if (urls.has(item.url) || titles.has(normalized)) continue;
      urls.add(item.url);
      titles.add(normalized);
      added.push(item);
    }

    if (added.length > 0) {
      this.items = [...this.items, ...added].sort(
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
      const [publishedAt, id] = Buffer.from(q.cursor, 'base64url')
        .toString()
        .split('|');
      list = list.filter(
        (n) =>
          n.publishedAt < publishedAt ||
          (n.publishedAt === publishedAt && n.id < id),
      );
    }

    const limit = Math.min(q.limit ?? 20, 100);
    const items = list.slice(0, limit);
    const last = items[items.length - 1];
    const nextCursor =
      list.length > limit && last
        ? Buffer.from(`${last.publishedAt}|${last.id}`).toString('base64url')
        : undefined;

    return { items, nextCursor };
  }
}
