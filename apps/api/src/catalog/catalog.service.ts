import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { CatalogStock, Sector } from '@daily-stocks/shared';
import { STOCKS } from '@daily-stocks/shared';
import { JsonStore } from '../common/json-store';

const REFRESH_TTL_MS = 24 * 3_600_000; // 카탈로그 일 1회 갱신

/** KRX 업종명 → 8개 섹터 매핑 (키워드 기반, 매핑 실패 시 sector 없음) */
const INDUSTRY_SECTOR_RULES: [RegExp, Sector][] = [
  [
    /반도체|전자부품|컴퓨터|통신.*장비|소프트웨어|정보서비스|IT|인터넷/i,
    'semiconductor_ai',
  ],
  [/전지|축전지/, 'battery'],
  [/의약|제약|바이오|의료|생물/, 'bio_healthcare'],
  [/자동차/, 'automotive'],
  [/은행|금융|보험|증권|여신|저축/, 'finance'],
  [/방송|영화|오디오|게임|엔터|출판|광고|콘텐츠/, 'entertainment'],
  [/조선|선박|항공|방위|무기|우주/, 'defense_shipbuilding'],
  [/석유|화학|정유|가스|전기업|에너지|연료/, 'energy_chemical'],
];

function mapSector(industry: string): Sector | undefined {
  for (const [pattern, sector] of INDUSTRY_SECTOR_RULES) {
    if (pattern.test(industry)) return sector;
  }
  return undefined;
}

/** 큐레이션 사전(로고·별칭 보유)을 카탈로그 형태로 변환 */
function fromCurated(): CatalogStock[] {
  return STOCKS.map((s) => ({
    ticker: s.ticker,
    name: s.name,
    market: s.market,
    exchange: s.market === 'KR' ? (s.exchange ?? 'KOSPI') : undefined,
    sector: s.sector,
    domain: s.domain,
    aliases: s.aliases,
  }));
}

interface StoredCatalog {
  fetchedAt: string;
  stocks: CatalogStock[];
}

/**
 * 전체 상장사 카탈로그 (토스처럼 모든 종목 지원).
 *
 * KRX 상장법인목록(kind.krx.co.kr)을 키 없이 내려받아 코스피+코스닥 전 종목을
 * 보유한다. 다운로드 실패 시 캐시 → 큐레이션 사전 순으로 폴백하므로
 * 네트워크가 없어도 기존 기능은 그대로 동작한다.
 * 미국 종목은 큐레이션 21개 유지 (전체 미국 상장사는 후속 작업).
 */
@Injectable()
export class CatalogService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CatalogService.name);
  private readonly store = new JsonStore<StoredCatalog>('stocks-catalog');
  private stocks: CatalogStock[];
  private byTicker: Map<string, CatalogStock>;
  private timer?: NodeJS.Timeout;

  constructor() {
    const cached = this.store.load();
    this.stocks = cached?.stocks?.length ? cached.stocks : fromCurated();
    this.byTicker = new Map(this.stocks.map((s) => [s.ticker, s]));
  }

  onModuleInit(): void {
    const cached = this.store.load();
    const stale =
      !cached || Date.now() - Date.parse(cached.fetchedAt) > REFRESH_TTL_MS;
    if (stale) {
      void this.refresh().catch((e) =>
        this.logger.warn(`카탈로그 갱신 실패(폴백 사용): ${String(e)}`),
      );
    }
    this.timer = setInterval(() => {
      void this.refresh().catch((e) =>
        this.logger.warn(`카탈로그 갱신 실패: ${String(e)}`),
      );
    }, REFRESH_TTL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  list(): CatalogStock[] {
    return this.stocks;
  }

  find(ticker: string): CatalogStock | null {
    return this.byTicker.get(ticker) ?? null;
  }

  /** 이름/티커 검색 (앞부분 일치 우선) */
  search(query: string, limit = 20): CatalogStock[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const starts: CatalogStock[] = [];
    const includes: CatalogStock[] = [];
    for (const s of this.stocks) {
      const name = s.name.toLowerCase();
      const ticker = s.ticker.toLowerCase();
      if (name.startsWith(q) || ticker.startsWith(q)) starts.push(s);
      else if (name.includes(q)) includes.push(s);
      if (starts.length >= limit) break;
    }
    return [...starts, ...includes].slice(0, limit);
  }

  /** KRX 상장법인목록 다운로드 → 전체 카탈로그 재구성 */
  async refresh(): Promise<void> {
    const [kospi, kosdaq] = await Promise.all([
      this.downloadKrx('stockMkt', 'KOSPI'),
      this.downloadKrx('kosdaqMkt', 'KOSDAQ'),
    ]);
    if (kospi.length === 0 && kosdaq.length === 0) {
      throw new Error('KRX 목록이 비어 있음');
    }

    // 큐레이션 사전의 별칭·로고·섹터를 우선 병합
    const curated = new Map(fromCurated().map((s) => [s.ticker, s]));
    const kr: CatalogStock[] = [...kospi, ...kosdaq].map((s) => {
      const c = curated.get(s.ticker);
      return c
        ? { ...s, sector: c.sector, domain: c.domain, aliases: c.aliases }
        : s;
    });
    const us = fromCurated().filter((s) => s.market === 'US');

    this.stocks = [...kr, ...us];
    this.byTicker = new Map(this.stocks.map((s) => [s.ticker, s]));
    this.store.save({
      fetchedAt: new Date().toISOString(),
      stocks: this.stocks,
    });
    this.logger.log(
      `카탈로그 갱신: 코스피 ${kospi.length} + 코스닥 ${kosdaq.length} + 미국 ${us.length}`,
    );
  }

  private async downloadKrx(
    marketType: 'stockMkt' | 'kosdaqMkt',
    exchange: 'KOSPI' | 'KOSDAQ',
  ): Promise<CatalogStock[]> {
    const res = await fetch(
      `https://kind.krx.co.kr/corpgeneral/corpList.do?method=download&marketType=${marketType}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    );
    if (!res.ok) return [];
    // KRX는 EUC-KR로 응답하지만, 인코딩 자동 감지(한글 비율)로 안전하게 디코딩
    const buffer = await res.arrayBuffer();
    const eucKr = new TextDecoder('euc-kr').decode(buffer);
    const utf8 = new TextDecoder('utf-8').decode(buffer);
    const hangul = (s: string) => (s.match(/[가-힣]/g) ?? []).length;
    const html = hangul(eucKr) >= hangul(utf8) ? eucKr : utf8;

    const stocks: CatalogStock[] = [];
    for (const row of html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
      const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(
        (m) => m[1].replace(/<[^>]*>/g, '').trim(),
      );
      // [회사명, 시장구분, 종목코드, 업종, ...]
      if (cells.length < 4) continue;
      const [name, , ticker, industry] = cells;
      if (!/^\d{6}$/.test(ticker)) continue;
      stocks.push({
        ticker,
        name,
        market: 'KR',
        exchange,
        sector: mapSector(industry),
        industry,
      });
    }
    return stocks;
  }
}
