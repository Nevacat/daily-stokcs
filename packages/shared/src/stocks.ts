import type { Sector } from './index';

export interface StockEntry {
  ticker: string;
  name: string;
  sector: Sector;
  /** 기사에서 이 종목을 가리키는 표현들 */
  aliases: string[];
}

/** 섹터별 대표 종목 사전 (MVP — 추후 전체 상장사 DB로 교체) */
export const STOCKS: StockEntry[] = [
  // 반도체/AI
  {
    ticker: '005930',
    name: '삼성전자',
    sector: 'semiconductor_ai',
    aliases: ['삼성전자'],
  },
  {
    ticker: '000660',
    name: 'SK하이닉스',
    sector: 'semiconductor_ai',
    aliases: ['SK하이닉스', '하이닉스'],
  },
  {
    ticker: '042700',
    name: '한미반도체',
    sector: 'semiconductor_ai',
    aliases: ['한미반도체'],
  },
  // 2차전지
  {
    ticker: '373220',
    name: 'LG에너지솔루션',
    sector: 'battery',
    aliases: ['LG에너지솔루션', 'LG엔솔'],
  },
  {
    ticker: '006400',
    name: '삼성SDI',
    sector: 'battery',
    aliases: ['삼성SDI'],
  },
  {
    ticker: '247540',
    name: '에코프로비엠',
    sector: 'battery',
    aliases: ['에코프로비엠'],
  },
  // 바이오/헬스케어
  {
    ticker: '207940',
    name: '삼성바이오로직스',
    sector: 'bio_healthcare',
    aliases: ['삼성바이오로직스', '삼성바이오'],
  },
  {
    ticker: '068270',
    name: '셀트리온',
    sector: 'bio_healthcare',
    aliases: ['셀트리온'],
  },
  {
    ticker: '196170',
    name: '알테오젠',
    sector: 'bio_healthcare',
    aliases: ['알테오젠'],
  },
  // 자동차
  {
    ticker: '005380',
    name: '현대차',
    sector: 'automotive',
    aliases: ['현대차', '현대자동차'],
  },
  {
    ticker: '000270',
    name: '기아',
    sector: 'automotive',
    aliases: ['기아차', '기아'],
  },
  {
    ticker: '012330',
    name: '현대모비스',
    sector: 'automotive',
    aliases: ['현대모비스'],
  },
  // 금융
  {
    ticker: '105560',
    name: 'KB금융',
    sector: 'finance',
    aliases: ['KB금융', 'KB국민은행'],
  },
  {
    ticker: '055550',
    name: '신한지주',
    sector: 'finance',
    aliases: ['신한지주', '신한금융'],
  },
  {
    ticker: '323410',
    name: '카카오뱅크',
    sector: 'finance',
    aliases: ['카카오뱅크'],
  },
  // 엔터/콘텐츠
  {
    ticker: '352820',
    name: '하이브',
    sector: 'entertainment',
    aliases: ['하이브'],
  },
  {
    ticker: '035900',
    name: 'JYP엔터',
    sector: 'entertainment',
    aliases: ['JYP엔터', 'JYP엔터테인먼트'],
  },
  {
    ticker: '041510',
    name: '에스엠',
    sector: 'entertainment',
    aliases: ['에스엠', 'SM엔터테인먼트'],
  },
  // 방산/조선
  {
    ticker: '012450',
    name: '한화에어로스페이스',
    sector: 'defense_shipbuilding',
    aliases: ['한화에어로스페이스', '한화에어로'],
  },
  {
    ticker: '329180',
    name: 'HD현대중공업',
    sector: 'defense_shipbuilding',
    aliases: ['HD현대중공업', '현대중공업'],
  },
  {
    ticker: '047810',
    name: '한국항공우주',
    sector: 'defense_shipbuilding',
    aliases: ['한국항공우주', 'KAI'],
  },
  // 에너지/화학
  {
    ticker: '051910',
    name: 'LG화학',
    sector: 'energy_chemical',
    aliases: ['LG화학'],
  },
  {
    ticker: '096770',
    name: 'SK이노베이션',
    sector: 'energy_chemical',
    aliases: ['SK이노베이션'],
  },
  {
    ticker: '010950',
    name: 'S-Oil',
    sector: 'energy_chemical',
    aliases: ['S-Oil', '에쓰오일'],
  },
];
