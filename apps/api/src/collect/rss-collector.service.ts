import { Injectable, Logger } from '@nestjs/common';
import Parser from 'rss-parser';

export interface RawArticle {
  title: string;
  url: string;
  press: string;
  publishedAt: string; // ISO 8601 UTC
  /** 기사 썸네일 (피드 제공 시) */
  image?: string;
}

interface FeedItem {
  title?: string;
  link?: string;
  isoDate?: string;
  enclosure?: { url?: string };
  media?: { $?: { url?: string } };
  thumbnail?: { $?: { url?: string } };
  content?: string;
  'content:encoded'?: string;
}

/** 피드 항목에서 썸네일 URL 추출 (enclosure → media → 본문 img 순) */
function extractImage(item: FeedItem): string | undefined {
  const candidate =
    item.enclosure?.url ??
    item.media?.$?.url ??
    item.thumbnail?.$?.url ??
    (item['content:encoded'] ?? item.content ?? '').match(
      /<img[^>]+src=["']([^"']+)["']/i,
    )?.[1];
  return candidate && /^https?:\/\//i.test(candidate) ? candidate : undefined;
}

/** 경제·증권 카테고리 RSS 피드 (API 키 불필요) — 국내 + 미국 시장 */
const FEEDS: { press: string; url: string }[] = [
  // 국내
  { press: '연합뉴스', url: 'https://www.yna.co.kr/rss/economy.xml' },
  { press: '매일경제', url: 'https://www.mk.co.kr/rss/30100041/' },
  { press: '한국경제', url: 'https://www.hankyung.com/feed/economy' },
  // 미국 (영문 — 분석기가 영문 키워드도 지원)
  {
    press: 'CNBC',
    url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html',
  },
  {
    press: 'MarketWatch',
    url: 'https://feeds.marketwatch.com/marketwatch/topstories/',
  },
];

@Injectable()
export class RssCollectorService {
  private readonly logger = new Logger(RssCollectorService.name);
  private readonly parser = new Parser({
    timeout: 10_000,
    customFields: {
      item: [
        ['media:content', 'media'],
        ['media:thumbnail', 'thumbnail'],
      ],
    },
  });

  /** 모든 피드를 수집한다. 일부 피드 실패는 무시하고 성공분만 반환. */
  async collect(): Promise<RawArticle[]> {
    const results = await Promise.allSettled(
      FEEDS.map(async (feed) => {
        const parsed = await this.parser.parseURL(feed.url);
        return (parsed.items ?? [])
          .filter((item) => item.title && item.link)
          .map((item) => ({
            title: item.title!.trim(),
            url: item.link!,
            press: feed.press,
            publishedAt: item.isoDate ?? new Date().toISOString(),
            image: extractImage(item as FeedItem),
          }));
      }),
    );

    const articles: RawArticle[] = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        articles.push(...r.value);
      } else {
        this.logger.warn(`피드 수집 실패: ${FEEDS[i].press} — ${r.reason}`);
      }
    });
    return articles;
  }
}
