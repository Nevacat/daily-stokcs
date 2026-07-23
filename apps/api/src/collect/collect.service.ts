import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { CollectRun, NewsItem } from '@daily-stocks/shared';
import { JsonStore } from '../common/json-store';
import { FavoritesService } from '../favorites/favorites.service';
import { HistoryService } from '../history/history.service';
import { NewsService } from '../news/news.service';
import { NotificationService } from '../notifications/notification.service';
import { PriceService } from '../price/price.service';
import { RecommendationService } from '../recommendation/recommendation.service';
import { SettingsService } from '../settings/settings.service';
import { AnalyzerService } from './analyzer/analyzer.service';
import { RssCollectorService } from './rss-collector.service';

/**
 * 수집 파이프라인 오케스트레이터 (기획서 §2.1):
 * 수집 → 중복 제거 → 분석 → 추천 재생성
 * 자동(주기 타이머) / 수동(POST /collect) 두 경로 모두 이 서비스를 거친다.
 */
@Injectable()
export class CollectService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CollectService.name);
  private timer?: NodeJS.Timeout;
  private nextCollectAt?: string;
  private readonly runStore = new JsonStore<CollectRun>('last-run');
  private lastRun?: CollectRun = this.runStore.load() ?? undefined;
  private running = false;

  constructor(
    private readonly collector: RssCollectorService,
    private readonly analyzer: AnalyzerService,
    private readonly newsService: NewsService,
    private readonly recommendationService: RecommendationService,
    private readonly settingsService: SettingsService,
    private readonly historyService: HistoryService,
    private readonly priceService: PriceService,
    private readonly favoritesService: FavoritesService,
    private readonly notificationService: NotificationService,
  ) {}

  onModuleInit(): void {
    this.settingsService.onChange(() => this.schedule());
    this.schedule();
  }

  onModuleDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  /** 설정된 주기에 맞춰 다음 자동 수집을 예약한다 */
  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    const { intervalMinutes } = this.settingsService.get();
    if (intervalMinutes === null) {
      this.nextCollectAt = undefined;
      this.logger.log('자동 수집 꺼짐');
      return;
    }
    const ms = intervalMinutes * 60_000;
    this.nextCollectAt = new Date(Date.now() + ms).toISOString();
    this.timer = setTimeout(() => {
      void this.run('auto').catch((e) =>
        this.logger.error(`자동 수집 실패: ${e}`),
      );
    }, ms);
    this.timer.unref?.(); // 대기 중인 타이머가 프로세스 종료를 막지 않도록
    this.logger.log(`다음 자동 수집: ${this.nextCollectAt}`);
  }

  status(): { lastRun?: CollectRun; nextCollectAt?: string } {
    return { lastRun: this.lastRun, nextCollectAt: this.nextCollectAt };
  }

  async run(trigger: 'auto' | 'manual'): Promise<CollectRun> {
    if (this.running) {
      throw new ConflictException({
        error: {
          code: 'COLLECT_IN_PROGRESS',
          message: '이미 수집이 진행 중이에요. 잠시만 기다려주세요.',
        },
      });
    }
    this.running = true;

    const run: CollectRun = {
      id: randomUUID(),
      trigger,
      status: 'collecting',
      startedAt: new Date().toISOString(),
      newsCount: 0,
    };
    this.lastRun = run;

    try {
      const raw = await this.collector.collect();

      run.status = 'analyzing';
      const analyzed: NewsItem[] = raw.map((article) => {
        const result = this.analyzer.analyze(article.title);
        return {
          id: randomUUID(),
          title: article.title,
          press: article.press,
          publishedAt: article.publishedAt,
          url: article.url,
          sectors: result.sectors,
          tickers: result.stocks.map((s) => s.ticker),
          sentiment: result.sentiment,
          imageUrl: article.image,
        };
      });

      const added = this.newsService.upsert(analyzed);
      const prevTickers = new Set(
        this.recommendationService.findAll().map((r) => r.ticker),
      );
      const recommendations = this.recommendationService.regenerate(
        this.newsService.findAll(),
      );

      // 관심 종목에 "새로" 등장한 추천만 푸시 (기획서 §3.2 — FCM 키 설정 시 발송)
      const favoriteTickers = this.favoritesService.allFavoriteTickers();
      const newFavoriteRecs = recommendations.filter(
        (r) => favoriteTickers.has(r.ticker) && !prevTickers.has(r.ticker),
      );
      await this.notificationService.notifyNewFavoriteRecommendations(
        newFavoriteRecs,
      );
      // 추천 시점 주가 기록 — 주가 API 키 미설정이면 null (적중률 비활성)
      const prices = await this.priceService.getPrices(
        recommendations.map((r) => r.ticker),
      );
      this.historyService.record(
        recommendations.map((r) => ({
          ...r,
          priceAtRecommendation: prices.get(r.ticker) ?? null,
        })),
      ); // 날짜별 스냅샷 (기획서 §3.3)

      run.status = 'done';
      run.newsCount = added.length;
      run.finishedAt = new Date().toISOString();
      this.runStore.save(run); // 재시작 후에도 마지막 수집 정보 유지
      this.logger.log(`수집 완료(${trigger}): 신규 뉴스 ${added.length}건`);
      return run;
    } catch (e) {
      run.status = 'failed';
      run.finishedAt = new Date().toISOString();
      this.runStore.save(run);
      throw e;
    } finally {
      this.running = false;
      // 수동 수집 후에도 다음 자동 수집은 새 주기로 재예약
      this.schedule();
    }
  }
}
