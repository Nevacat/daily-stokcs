import type { Sector } from '@daily-stocks/shared';

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

/** 종목 매칭 없이 섹터만 유추할 때 쓰는 키워드 */
export const SECTOR_KEYWORDS: Record<Sector, string[]> = {
  semiconductor_ai: [
    '반도체',
    'HBM',
    '파운드리',
    'AI칩',
    '인공지능',
    'GPU',
    'D램',
    '낸드',
  ],
  battery: ['2차전지', '이차전지', '배터리', '양극재', '전고체'],
  bio_healthcare: ['바이오', '신약', '임상', '제약', 'FDA'],
  automotive: ['전기차', '자동차', '완성차', '자율주행'],
  finance: ['은행', '금융지주', '증권', '보험', '금리'],
  entertainment: ['엔터', 'K팝', '아이돌', '콘텐츠', '드라마', '웹툰'],
  defense_shipbuilding: [
    '방산',
    '방위산업',
    '조선',
    '수주잔고',
    '함정',
    '미사일',
  ],
  energy_chemical: ['정유', '석유화학', '에너지', '원유', '수소', '태양광'],
};

/** 호재 키워드 (제목 기준 감성 판단용) */
export const POSITIVE_KEYWORDS = [
  '수주',
  '호실적',
  '최대 실적',
  '어닝서프라이즈',
  '흑자',
  '흑자전환',
  '급등',
  '신고가',
  '상승',
  '증가',
  '확대',
  '성장',
  '돌파',
  '개선',
  '승인',
  '허가',
  '계약',
  '협력',
  '투자 유치',
  '배당 확대',
  '수출 호조',
  '점유율 확대',
  '기대감',
  '수혜',
];

/** 악재 키워드 */
export const NEGATIVE_KEYWORDS = [
  '적자',
  '적자전환',
  '급락',
  '하락',
  '감소',
  '축소',
  '부진',
  '악화',
  '리콜',
  '소송',
  '규제',
  '제재',
  '벌금',
  '파업',
  '중단',
  '연기',
  '취소',
  '유상증자',
  '신저가',
  '우려',
  '경고',
  '조사 착수',
  '횡령',
  '결함',
];
