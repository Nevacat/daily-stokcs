import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BadRequestException } from '@nestjs/common';
import type { NewsItem } from '@daily-stocks/shared';
import { NewsService } from './news.service';

const NOW = new Date('2026-07-22T09:00:00.000Z');

let seq = 0;
function news(hoursAgo: number): NewsItem {
  seq += 1;
  return {
    id: `news-${String(seq).padStart(3, '0')}`,
    title: `기사 제목 ${seq}`,
    press: '테스트',
    publishedAt: new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString(),
    url: `https://example.com/${seq}`,
    sectors: [],
    tickers: [],
    sentiment: 'neutral',
  };
}

describe('NewsService', () => {
  let service: NewsService;

  beforeEach(() => {
    process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'news-test-'));
    service = new NewsService();
  });

  describe('커서 페이지네이션', () => {
    it('최신순 정렬 + limit + nextCursor로 전체를 빠짐없이 순회한다', () => {
      service.upsert([news(3), news(1), news(2)], NOW);

      const page1 = service.query({ limit: 2 });
      expect(page1.items.map((n) => n.title)).toEqual([
        '기사 제목 2',
        '기사 제목 3',
      ]);
      expect(page1.nextCursor).toBeDefined();

      const page2 = service.query({ limit: 2, cursor: page1.nextCursor });
      expect(page2.items.map((n) => n.title)).toEqual(['기사 제목 1']);
      expect(page2.nextCursor).toBeUndefined();
    });

    it('전체 개수가 limit의 배수면 마지막 페이지 nextCursor는 없다', () => {
      service.upsert([news(1), news(2)], NOW);
      const page = service.query({ limit: 2 });
      expect(page.items).toHaveLength(2);
      expect(page.nextCursor).toBeUndefined();
    });

    it('잘못된 커서는 INVALID_CURSOR 에러', () => {
      service.upsert([news(1)], NOW);
      expect(() => service.query({ cursor: 'garbage!!' })).toThrow(
        BadRequestException,
      );
      expect(() =>
        service.query({
          cursor: Buffer.from('구분자없음').toString('base64url'),
        }),
      ).toThrow(BadRequestException);
    });

    it('limit이 음수·NaN·초과값이어도 1~100으로 정규화된다', () => {
      service.upsert([news(1), news(2), news(3)], NOW);
      expect(service.query({ limit: -5 }).items).toHaveLength(1);
      expect(service.query({ limit: Number('abc') }).items).toHaveLength(3); // 기본 20
      expect(service.query({ limit: 999 }).items).toHaveLength(3); // 상한 100
    });
  });

  describe('보존 정책', () => {
    it('7일이 지난 뉴스는 수집 시 제거된다', () => {
      service.upsert([news(1), news(8 * 24)], NOW);
      expect(service.findAll()).toHaveLength(1);
    });
  });
});
