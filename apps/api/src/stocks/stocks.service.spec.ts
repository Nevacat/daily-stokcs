import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { NewsItem, Sentiment } from '@daily-stocks/shared';
import { CatalogService } from '../catalog/catalog.service';
import { NewsService } from '../news/news.service';
import { PriceService } from '../price/price.service';
import { RecommendationService } from '../recommendation/recommendation.service';
import { TrendsService } from '../trends/trends.service';
import { StocksController } from './stocks.controller';
import { StocksService } from './stocks.service';

const NOW = new Date('2026-07-22T09:00:00.000Z');

function news(ticker: string, sentiment: Sentiment, at: Date = NOW): NewsItem {
  const id = `news-${Math.abs(Math.sin(seq++)).toString(36).slice(2, 10)}`;
  return {
    id,
    title: `기사 ${id}`,
    press: '테스트',
    publishedAt: new Date(at.getTime() - seq * 60_000).toISOString(),
    url: `https://example.com/${id}`,
    sectors: [],
    tickers: [ticker],
    sentiment,
  };
}
let seq = 1;

function makeService(items: NewsItem[], now: Date = NOW) {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-test-'));
  const newsService = new NewsService();
  newsService.upsert(items, now);
  const catalog = new CatalogService();
  const recService = new RecommendationService(catalog);
  recService.regenerate(newsService.findAll(), now);
  // 시세는 외부 API이므로 목 처리 (조회 실패 = null 로 취급)
  const priceService = {
    getQuote: jest.fn().mockResolvedValue(null),
    getQuotes: jest.fn().mockResolvedValue({}),
  } as unknown as PriceService;
  return new StocksService(
    newsService,
    recService,
    new TrendsService(newsService),
    priceService,
    catalog,
  );
}

describe('StocksService', () => {
  it('사전에 없는 종목은 UNKNOWN_TICKER 404', async () => {
    await expect(makeService([]).detail('999999')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('추천 중인 종목은 추천·시세·트렌드·관련 뉴스를 모두 담는다', async () => {
    const detail = await makeService([
      news('005930', 'positive'),
      news('005930', 'positive'),
    ]).detail('005930');

    expect(detail.stock).toEqual({
      ticker: '005930',
      name: '삼성전자',
      sector: 'semiconductor_ai',
      market: 'KR',
    });
    expect(detail.recommendation?.ticker).toBe('005930');
    expect(detail.quote).toBeNull(); // 목 — 시세 실패에도 상세는 동작
    expect(detail.trend.days).toHaveLength(7);
    expect(detail.news).toHaveLength(2);
  });

  it('추천이 없는 종목은 recommendation이 null이어도 상세를 반환한다', async () => {
    const detail = await makeService([news('005930', 'negative')]).detail(
      '005930',
    );
    expect(detail.recommendation).toBeNull();
    expect(detail.news).toHaveLength(1);
  });
});

describe('StocksService.compare', () => {
  // 7일 트렌드는 실제 현재 시각 기준으로 집계되므로 뉴스도 현재 시각 기준으로 만든다
  const RECENT = new Date();

  it('2~3개가 아니면 INVALID_BODY 400', async () => {
    const service = makeService([]);
    await expect(service.compare(['005930'])).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      service.compare(['005930', '000660', '042660', '035420']),
    ).rejects.toThrow(BadRequestException);
    // 중복은 제거 후 개수를 센다 — 같은 종목 2개는 비교가 아니다
    await expect(service.compare(['005930', '005930'])).rejects.toThrow(
      BadRequestException,
    );
  });

  it('사전에 없는 종목은 UNKNOWN_TICKER 400', async () => {
    await expect(makeService([]).compare(['005930', '999999'])).rejects.toThrow(
      BadRequestException,
    );
  });

  it('추천 중이 아닌 종목은 score가 null이고, 감성은 7일 합산으로 내려간다', async () => {
    const service = makeService(
      [
        news('005930', 'positive', RECENT),
        news('005930', 'positive', RECENT),
        news('005930', 'negative', RECENT),
      ],
      RECENT,
    );

    const [samsung, hynix] = await service.compare(['005930', '000660']);

    expect(samsung.name).toBe('삼성전자');
    expect(typeof samsung.score).toBe('number');
    expect(samsung.sentiment7d).toEqual({
      positive: 2,
      negative: 1,
      neutral: 0,
    });
    // 뉴스가 없어 추천 목록에 없는 종목 — 비교는 그대로 가능해야 한다
    expect(hynix.ticker).toBe('000660');
    expect(hynix.score).toBeNull();
    expect(hynix.sentiment7d).toEqual({ positive: 0, negative: 0, neutral: 0 });
    // 시세 목이 빈 응답이어도 카드는 만들어진다
    expect(samsung.quote).toBeNull();
  });
});

describe('StocksController 라우트 순서', () => {
  /**
   * @Get('compare') 가 @Get(':ticker') 아래로 내려가면 'compare' 가 티커로 매칭돼
   * UNKNOWN_TICKER 가 난다. 실제 라우터로 검증해 순서를 잠근다.
   */
  it("'compare'는 ':ticker'보다 먼저 매칭된다", async () => {
    const compare = jest.fn().mockResolvedValue([]);
    const detail = jest.fn().mockResolvedValue(null);
    const moduleRef = await Test.createTestingModule({
      controllers: [StocksController],
      providers: [
        { provide: StocksService, useValue: { compare, detail } },
        {
          provide: CatalogService,
          useValue: { list: () => [], search: () => [] },
        },
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    await request(app.getHttpServer())
      .get('/stocks/compare?tickers=005930,000660')
      .expect(200);

    expect(compare).toHaveBeenCalledWith(['005930', '000660']);
    expect(detail).not.toHaveBeenCalled();
    await app.close();
  });
});
