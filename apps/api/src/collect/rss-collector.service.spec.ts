import { RssCollectorService } from './rss-collector.service';

// 외부 RSS는 목 처리 (rules/testing.md — 실제 API 호출 금지)
const parseURL = jest.fn();
jest.mock('rss-parser', () => {
  return jest.fn().mockImplementation(() => ({
    parseURL: (...args: unknown[]) => parseURL(...args) as unknown,
  }));
});

describe('RssCollectorService', () => {
  beforeEach(() => {
    parseURL.mockReset();
  });

  it('모든 피드의 기사를 합쳐 반환한다', async () => {
    parseURL.mockResolvedValue({
      items: [
        {
          title: ' 제목 ',
          link: 'https://example.com/1',
          isoDate: '2026-07-22T05:00:00.000Z',
        },
      ],
    });
    const articles = await new RssCollectorService().collect();

    expect(articles).toHaveLength(5); // 피드 5개(국내 3 + 미국 2) × 기사 1건
    expect(articles[0].title).toBe('제목'); // trim 적용
    expect(articles[0].publishedAt).toBe('2026-07-22T05:00:00.000Z');
    expect(articles.map((a) => a.press)).toEqual([
      '연합뉴스',
      '매일경제',
      '한국경제',
      'CNBC',
      'MarketWatch',
    ]);
  });

  it('제목이나 링크가 없는 항목은 제외한다', async () => {
    parseURL.mockResolvedValue({
      items: [
        { title: '정상', link: 'https://example.com/1' },
        { title: undefined, link: 'https://example.com/2' },
        { title: '링크 없음', link: undefined },
      ],
    });
    const articles = await new RssCollectorService().collect();
    expect(articles).toHaveLength(5); // 피드당 1건만 통과
  });

  it('일부 피드가 실패해도 성공한 피드 결과는 반환한다', async () => {
    parseURL.mockRejectedValueOnce(new Error('timeout')).mockResolvedValue({
      items: [{ title: '정상', link: 'https://example.com/1' }],
    });
    const articles = await new RssCollectorService().collect();
    expect(articles).toHaveLength(4); // 실패 1개 피드 제외
  });

  it('isoDate가 없으면 현재 시각으로 대체한다', async () => {
    parseURL.mockResolvedValue({
      items: [{ title: '제목', link: 'https://example.com/1' }],
    });
    const [article] = await new RssCollectorService().collect();
    expect(Number.isNaN(Date.parse(article.publishedAt))).toBe(false);
  });
});
