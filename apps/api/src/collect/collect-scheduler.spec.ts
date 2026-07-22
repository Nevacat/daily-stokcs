import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { HistoryService } from '../history/history.service';
import { PriceService } from '../price/price.service';
import { NewsService } from '../news/news.service';
import { RecommendationService } from '../recommendation/recommendation.service';
import { SettingsService } from '../settings/settings.service';
import { AnalyzerService } from './analyzer/analyzer.service';
import { CollectService } from './collect.service';
import { RssCollectorService } from './rss-collector.service';

/** 자동 수집 스케줄러 동작 검증 (fake timers) */
describe('CollectService 스케줄러', () => {
  let service: CollectService;
  let settings: SettingsService;
  let collectMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    process.env.DATA_DIR = fs.mkdtempSync(
      path.join(os.tmpdir(), 'sched-test-'),
    );
    collectMock = jest.fn().mockResolvedValue([]);
    settings = new SettingsService(); // 기본 60분
    service = new CollectService(
      { collect: collectMock } as unknown as RssCollectorService,
      new AnalyzerService(),
      new NewsService(),
      new RecommendationService(),
      settings,
      new HistoryService(),
      new PriceService(),
    );
    service.onModuleInit();
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
  });

  it('초기화 시 설정 주기(60분)에 맞춰 다음 수집이 예약된다', () => {
    const { nextCollectAt } = service.status();
    expect(nextCollectAt).toBeDefined();
    expect(collectMock).not.toHaveBeenCalled();
  });

  it('주기가 지나면 자동 수집이 실행된다', async () => {
    await jest.advanceTimersByTimeAsync(60 * 60_000);
    expect(collectMock).toHaveBeenCalledTimes(1);
    expect(service.status().lastRun?.trigger).toBe('auto');
  });

  it('설정을 변경하면 즉시 새 주기로 재예약된다', async () => {
    settings.update({ intervalMinutes: 30 });
    await jest.advanceTimersByTimeAsync(30 * 60_000);
    expect(collectMock).toHaveBeenCalledTimes(1);
  });

  it('끄기(null)로 바꾸면 자동 수집이 예약되지 않는다', async () => {
    settings.update({ intervalMinutes: null });
    expect(service.status().nextCollectAt).toBeUndefined();
    await jest.advanceTimersByTimeAsync(24 * 60 * 60_000);
    expect(collectMock).not.toHaveBeenCalled();
  });

  it('수동 수집 후에도 다음 자동 수집이 재예약된다', async () => {
    await service.run('manual');
    expect(collectMock).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(60 * 60_000);
    expect(collectMock).toHaveBeenCalledTimes(2);
  });
});
