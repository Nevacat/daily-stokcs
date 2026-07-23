import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CatalogService } from '../catalog/catalog.service';
import { FavoritesService } from '../favorites/favorites.service';
import { HistoryService } from '../history/history.service';
import { DevicesService } from '../notifications/devices.service';
import { NotificationService } from '../notifications/notification.service';
import { PriceService } from '../price/price.service';
import { NewsService } from '../news/news.service';
import { RecommendationService } from '../recommendation/recommendation.service';
import { SettingsService } from '../settings/settings.service';
import { AnalyzerService } from './analyzer/analyzer.service';
import { CollectService } from './collect.service';
import { RawArticle, RssCollectorService } from './rss-collector.service';

function makeService(articles: RawArticle[]) {
  process.env.DATA_DIR = fs.mkdtempSync(
    path.join(os.tmpdir(), 'collect-test-'),
  );
  // 외부 RSS는 목 처리 (rules/testing.md — 실제 API 호출 금지)
  const collector = {
    collect: jest.fn().mockResolvedValue(articles),
  } as unknown as RssCollectorService;
  const catalog = new CatalogService();
  const newsService = new NewsService();
  const service = new CollectService(
    collector,
    new AnalyzerService(catalog),
    newsService,
    new RecommendationService(catalog),
    new SettingsService(),
    new HistoryService(),
    {
      getPrices: jest.fn().mockResolvedValue(new Map()),
    } as unknown as PriceService,
    new FavoritesService(catalog),
    new NotificationService(new DevicesService()),
  );
  return { service, newsService };
}

const article = (title: string, url: string): RawArticle => ({
  title,
  url,
  press: '테스트',
  publishedAt: '2026-07-22T08:00:00.000Z',
});

describe('CollectService', () => {
  it('수집 → 분석 → 저장까지 수행하고 신규 건수를 반환한다', async () => {
    const { service, newsService } = makeService([
      article('삼성전자, 대규모 수주 계약', 'https://example.com/1'),
      article('2차전지 업계 부진 지속', 'https://example.com/2'),
    ]);

    const run = await service.run('manual');

    expect(run.status).toBe('done');
    expect(run.trigger).toBe('manual');
    expect(run.newsCount).toBe(2);
    const saved = newsService.findAll();
    expect(saved.find((n) => n.tickers.includes('005930'))?.sentiment).toBe(
      'positive',
    );
  });

  it('URL 또는 제목이 같은 기사는 중복 제거된다', async () => {
    const { service } = makeService([
      article('삼성전자 수주 소식', 'https://example.com/1'),
      article('삼성전자 수주 소식', 'https://example.com/other'), // 제목 중복
      article('다른 기사', 'https://example.com/1'), // URL 중복
    ]);

    const run = await service.run('manual');
    expect(run.newsCount).toBe(1);
  });

  it('재수집 시 기존 뉴스는 다시 추가되지 않는다', async () => {
    const { service } = makeService([
      article('삼성전자 수주', 'https://example.com/1'),
    ]);
    await service.run('manual');
    const second = await service.run('manual');
    expect(second.newsCount).toBe(0);
  });

  it('수집기 실패 시 run은 failed 상태로 남고 에러가 전파된다', async () => {
    process.env.DATA_DIR = fs.mkdtempSync(
      path.join(os.tmpdir(), 'collect-test-'),
    );
    const collector = {
      collect: jest.fn().mockRejectedValue(new Error('network')),
    } as unknown as RssCollectorService;
    const catalog = new CatalogService();
    const service = new CollectService(
      collector,
      new AnalyzerService(catalog),
      new NewsService(),
      new RecommendationService(catalog),
      new SettingsService(),
      new HistoryService(),
      {
        getPrices: jest.fn().mockResolvedValue(new Map()),
      } as unknown as PriceService,
      new FavoritesService(catalog),
      new NotificationService(new DevicesService()),
    );

    await expect(service.run('manual')).rejects.toThrow('network');
    expect(service.status().lastRun?.status).toBe('failed');
  });
});
