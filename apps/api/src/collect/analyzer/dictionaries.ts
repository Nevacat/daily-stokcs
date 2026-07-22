import type { Sector } from '@daily-stocks/shared';

// 종목 사전은 앱에서도 쓰므로 shared로 이동 — 여기서 재수출
export { STOCKS, type StockEntry } from '@daily-stocks/shared';

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
