import type { Market, Sector } from './index';

export interface StockEntry {
  ticker: string;
  name: string;
  sector: Sector;
  /** KR = 국내(KRX 6자리), US = 미국(심볼) */
  market: Market;
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
    market: 'KR',
    aliases: ['삼성전자'],
  },
  {
    ticker: '000660',
    name: 'SK하이닉스',
    sector: 'semiconductor_ai',
    market: 'KR',
    aliases: ['SK하이닉스', '하이닉스'],
  },
  {
    ticker: '042700',
    name: '한미반도체',
    sector: 'semiconductor_ai',
    market: 'KR',
    aliases: ['한미반도체'],
  },
  // 2차전지
  {
    ticker: '373220',
    name: 'LG에너지솔루션',
    sector: 'battery',
    market: 'KR',
    aliases: ['LG에너지솔루션', 'LG엔솔'],
  },
  {
    ticker: '006400',
    name: '삼성SDI',
    sector: 'battery',
    market: 'KR',
    aliases: ['삼성SDI'],
  },
  {
    ticker: '247540',
    name: '에코프로비엠',
    sector: 'battery',
    market: 'KR',
    aliases: ['에코프로비엠'],
  },
  // 바이오/헬스케어
  {
    ticker: '207940',
    name: '삼성바이오로직스',
    sector: 'bio_healthcare',
    market: 'KR',
    aliases: ['삼성바이오로직스', '삼성바이오'],
  },
  {
    ticker: '068270',
    name: '셀트리온',
    sector: 'bio_healthcare',
    market: 'KR',
    aliases: ['셀트리온'],
  },
  {
    ticker: '196170',
    name: '알테오젠',
    sector: 'bio_healthcare',
    market: 'KR',
    aliases: ['알테오젠'],
  },
  // 자동차
  {
    ticker: '005380',
    name: '현대차',
    sector: 'automotive',
    market: 'KR',
    aliases: ['현대차', '현대자동차'],
  },
  {
    ticker: '000270',
    name: '기아',
    sector: 'automotive',
    market: 'KR',
    aliases: ['기아차', '기아'],
  },
  {
    ticker: '012330',
    name: '현대모비스',
    sector: 'automotive',
    market: 'KR',
    aliases: ['현대모비스'],
  },
  // 금융
  {
    ticker: '105560',
    name: 'KB금융',
    sector: 'finance',
    market: 'KR',
    aliases: ['KB금융', 'KB국민은행'],
  },
  {
    ticker: '055550',
    name: '신한지주',
    sector: 'finance',
    market: 'KR',
    aliases: ['신한지주', '신한금융'],
  },
  {
    ticker: '323410',
    name: '카카오뱅크',
    sector: 'finance',
    market: 'KR',
    aliases: ['카카오뱅크'],
  },
  // 엔터/콘텐츠
  {
    ticker: '352820',
    name: '하이브',
    sector: 'entertainment',
    market: 'KR',
    aliases: ['하이브'],
  },
  {
    ticker: '035900',
    name: 'JYP엔터',
    sector: 'entertainment',
    market: 'KR',
    aliases: ['JYP엔터', 'JYP엔터테인먼트'],
  },
  {
    ticker: '041510',
    name: '에스엠',
    sector: 'entertainment',
    market: 'KR',
    aliases: ['에스엠', 'SM엔터테인먼트'],
  },
  // 방산/조선
  {
    ticker: '012450',
    name: '한화에어로스페이스',
    sector: 'defense_shipbuilding',
    market: 'KR',
    aliases: ['한화에어로스페이스', '한화에어로'],
  },
  {
    ticker: '329180',
    name: 'HD현대중공업',
    sector: 'defense_shipbuilding',
    market: 'KR',
    aliases: ['HD현대중공업', '현대중공업'],
  },
  {
    ticker: '047810',
    name: '한국항공우주',
    sector: 'defense_shipbuilding',
    market: 'KR',
    aliases: ['한국항공우주', 'KAI'],
  },
  // 에너지/화학
  {
    ticker: '051910',
    name: 'LG화학',
    sector: 'energy_chemical',
    market: 'KR',
    aliases: ['LG화학'],
  },
  {
    ticker: '096770',
    name: 'SK이노베이션',
    sector: 'energy_chemical',
    market: 'KR',
    aliases: ['SK이노베이션'],
  },
  {
    ticker: '010950',
    name: 'S-Oil',
    sector: 'energy_chemical',
    market: 'KR',
    aliases: ['S-Oil', '에쓰오일'],
  },

  // ===== 미국 시장 (US) =====
  // 반도체/AI·빅테크
  { ticker: 'NVDA', name: '엔비디아', sector: 'semiconductor_ai', market: 'US', aliases: ['엔비디아', 'Nvidia', 'NVDA'] },
  { ticker: 'AMD', name: 'AMD', sector: 'semiconductor_ai', market: 'US', aliases: ['AMD'] },
  { ticker: 'AAPL', name: '애플', sector: 'semiconductor_ai', market: 'US', aliases: ['애플', 'Apple', 'AAPL'] },
  { ticker: 'MSFT', name: '마이크로소프트', sector: 'semiconductor_ai', market: 'US', aliases: ['마이크로소프트', 'Microsoft', 'MSFT'] },
  { ticker: 'GOOGL', name: '알파벳', sector: 'semiconductor_ai', market: 'US', aliases: ['알파벳', '구글', 'Alphabet', 'Google', 'GOOGL'] },
  // 2차전지/배터리
  { ticker: 'ALB', name: '앨버말', sector: 'battery', market: 'US', aliases: ['앨버말', 'Albemarle', 'ALB'] },
  { ticker: 'QS', name: '퀀텀스케이프', sector: 'battery', market: 'US', aliases: ['퀀텀스케이프', 'QuantumScape'] },
  // 바이오/헬스케어
  { ticker: 'LLY', name: '일라이릴리', sector: 'bio_healthcare', market: 'US', aliases: ['일라이릴리', '릴리', 'Eli Lilly', 'LLY'] },
  { ticker: 'PFE', name: '화이자', sector: 'bio_healthcare', market: 'US', aliases: ['화이자', 'Pfizer', 'PFE'] },
  { ticker: 'MRNA', name: '모더나', sector: 'bio_healthcare', market: 'US', aliases: ['모더나', 'Moderna', 'MRNA'] },
  // 자동차
  { ticker: 'TSLA', name: '테슬라', sector: 'automotive', market: 'US', aliases: ['테슬라', 'Tesla', 'TSLA'] },
  { ticker: 'F', name: '포드', sector: 'automotive', market: 'US', aliases: ['포드', 'Ford'] },
  { ticker: 'GM', name: 'GM', sector: 'automotive', market: 'US', aliases: ['제너럴모터스', 'General Motors', 'GM'] },
  // 금융
  { ticker: 'JPM', name: 'JP모건', sector: 'finance', market: 'US', aliases: ['JP모건', 'JPMorgan', 'JPM'] },
  { ticker: 'GS', name: '골드만삭스', sector: 'finance', market: 'US', aliases: ['골드만삭스', 'Goldman Sachs'] },
  // 엔터/콘텐츠
  { ticker: 'DIS', name: '디즈니', sector: 'entertainment', market: 'US', aliases: ['디즈니', 'Disney', 'DIS'] },
  { ticker: 'NFLX', name: '넷플릭스', sector: 'entertainment', market: 'US', aliases: ['넷플릭스', 'Netflix', 'NFLX'] },
  // 방산
  { ticker: 'LMT', name: '록히드마틴', sector: 'defense_shipbuilding', market: 'US', aliases: ['록히드마틴', 'Lockheed Martin', 'LMT'] },
  { ticker: 'BA', name: '보잉', sector: 'defense_shipbuilding', market: 'US', aliases: ['보잉', 'Boeing'] },
  // 에너지
  { ticker: 'XOM', name: '엑슨모빌', sector: 'energy_chemical', market: 'US', aliases: ['엑슨모빌', 'Exxon', 'ExxonMobil', 'XOM'] },
  { ticker: 'CVX', name: '셰브론', sector: 'energy_chemical', market: 'US', aliases: ['셰브론', 'Chevron', 'CVX'] },
];
