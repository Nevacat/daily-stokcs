import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Recommendation } from '@daily-stocks/shared';
import { HistoryService } from './history.service';

function rec(ticker: string, score = 70): Recommendation {
  return {
    id: `${ticker}-1`,
    ticker,
    stockName: ticker,
    sector: 'semiconductor_ai',
    score,
    reason: '테스트',
    newsIds: [],
    recommendedAt: new Date().toISOString(),
  };
}

describe('HistoryService', () => {
  let service: HistoryService;

  beforeEach(() => {
    process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'hist-test-'));
    service = new HistoryService();
  });

  it('추천 0건이면 기록하지 않는다', () => {
    service.record([], new Date('2026-07-22T05:00:00Z'));
    expect(service.list()).toHaveLength(0);
  });

  it('같은 날짜(KST)는 마지막 스냅샷으로 덮어쓴다', () => {
    service.record([rec('005930')], new Date('2026-07-22T01:00:00Z'));
    service.record(
      [rec('005930'), rec('000660')],
      new Date('2026-07-22T05:00:00Z'),
    );
    const entries = service.list();
    expect(entries).toHaveLength(1);
    expect(entries[0].recommendations).toHaveLength(2);
  });

  it('UTC 15시 이후는 KST 기준 다음 날로 기록된다', () => {
    service.record([rec('005930')], new Date('2026-07-21T16:00:00Z')); // KST 07-22 01:00
    expect(service.list()[0].date).toBe('2026-07-22');
  });

  it('날짜 내림차순으로 반환하고 limit을 적용한다', () => {
    service.record([rec('005930')], new Date('2026-07-20T05:00:00Z'));
    service.record([rec('005930')], new Date('2026-07-22T05:00:00Z'));
    service.record([rec('005930')], new Date('2026-07-21T05:00:00Z'));
    expect(service.list().map((e) => e.date)).toEqual([
      '2026-07-22',
      '2026-07-21',
      '2026-07-20',
    ]);
    expect(service.list(2)).toHaveLength(2);
  });

  it('30일을 초과하면 오래된 항목부터 삭제된다', () => {
    for (let day = 1; day <= 35; day++) {
      const date = new Date(Date.UTC(2026, 5, day, 5));
      service.record([rec('005930')], date);
    }
    const entries = service.list(30);
    expect(entries).toHaveLength(30);
    expect(entries[entries.length - 1].date).toBe('2026-06-06'); // 6/1~6/5 삭제됨
  });

  it('저장 후 새 인스턴스에서도 유지된다 (파일 영속성)', () => {
    service.record([rec('005930')], new Date('2026-07-22T05:00:00Z'));
    expect(new HistoryService().list()).toHaveLength(1);
  });
});
