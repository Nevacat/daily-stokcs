/**
 * DeTok Design System v2.0 — Dark-first + Late-night Amber
 *
 * 기준 테마가 dark 로 바뀌었다. light 는 보조.
 * 모든 hex 는 APCA 0.1.9 / WCAG 2.x / OKLCH 로 실측 검증했다 (표는 docs/design-system.md).
 *
 * 설계 규칙 (어기지 말 것)
 *  1) 텍스트에 opacity 를 쓰지 않는다. 4단계 solid hex 만 쓴다.
 *     opacity 를 쓰면 표면이 바뀔 때마다 실효 대비가 예측 불가로 흔들린다.
 *  2) 보더는 알파다. 단일 hex 보더는 다층 다크에서 반드시 어느 한 층에서 소멸한다.
 *  3) 깊이 신호 우선순위: 표면 명도 > 알파 보더 > 상단 이너 하이라이트 > 그림자.
 *     다크에서 그림자는 "떠 있음"이 아니라 "얼룩"으로 읽힌다.
 *  4) 시세/감성은 한국 관례로 통일한다. 상승·호재 = up(빨강), 하락·악재 = down(파랑).
 *     색만으로 방향을 전달하지 않는다 — ▲▼ 와 부호를 항상 함께 쓴다 (WCAG 1.4.1).
 *  5) 텍스트 파랑은 "하락" 전용이다. 링크·CTA 에 파랑 텍스트를 쓰지 않는다.
 */

export type ThemeName = 'light' | 'dark' | 'night';

/** 브랜드 원색 — 로고·스플래시·앱 아이콘 등 테마 무관 자산 전용 */
export const palette = {
  primary: '#3182F6', // Calm Blue — 브랜드 원색 (UI 텍스트로 직접 쓰지 않는다)
  violet: '#9D86FF', // Soft Violet — 로고 그라디언트
  gradient: ['#A882FF', '#7F8CFF', '#5B5CFF'] as const,
} as const;

export interface ThemeColors {
  // ── 표면 (엘리베이션 사다리, OKLCH L 등간격 ~0.027) ──
  /** 앱 캔버스 / 스크롤 배경 */
  background: string;
  /** 헤더·탭바·섹션 배경 (구 backgroundSoft, 이름 유지) */
  backgroundSoft: string;
  /** 종목 카드, 뉴스 아이템 */
  card: string;
  /** 카드 press 상태 배경 */
  cardPressed: string;
  /** 모달·바텀시트·칩 */
  surface: string;
  /** 팝오버·툴팁·스낵바 */
  surfaceHigh: string;
  /** 모달 뒤 딤 (순검정 아님) */
  scrim: string;

  // ── 텍스트 (solid 4단계, opacity 금지) ──
  textPrimary: string;
  textSecondary: string;
  /** 캡션·타임스탬프 */
  textTertiary: string;
  textDisabled: string;

  // ── 보더 (전부 알파) ──
  /** 카드 기본 보더 */
  borderSubtle: string;
  /** 기존 이름 유지 — 시트·인풋 등 확실히 보여야 하는 경계 */
  border: string;
  /** 포커스·선택 경계 */
  borderStrong: string;
  /** 리스트 구분선 */
  divider: string;
  /** 카드 상단 1px — 다크에서 "그림자" 역할을 대신한다 */
  innerHighlight: string;

  // ── 브랜드 / 인터랙션 ──
  /** 액센트: 아이콘·활성 탭·활성 칩 텍스트·포커스 링. CTA 배경으로 쓰지 말 것 */
  primary: string;
  /** CTA 버튼 배경 */
  primaryFill: string;
  /** CTA 버튼 press 배경 (기존 이름 유지) */
  primaryPressed: string;
  /** CTA 버튼 라벨 색 — night 는 어두운 라벨이다 */
  onPrimaryFill: string;
  /** 선택 칩·정보 배너 배경 */
  primarySoft: string;
  /** 브랜드 포인트·그라디언트 상단. 값 표현에 쓰지 말 것 */
  violet: string;
  /** 섹터 태그 — primary 와 같은 값 (블루 계열 3개 혼용 금지) */
  indigo: string;

  // ── 시세·감성 세만틱 ──
  /** 상승 / 호재 (한국 관례 = 빨강) */
  up: string;
  /** 하락 / 악재 (한국 관례 = 파랑) */
  down: string;
  /** 보합 / 중립 */
  flat: string;
  /** 호재 칩 배경 */
  upSoft: string;
  /** 악재 칩 배경 */
  downSoft: string;

  // ── 상태 ──
  /** 저장 완료 등 순수 성공 피드백 전용. 시세·감성에 쓰지 말 것 */
  success: string;
  /** 오류·파괴적 액션. up 과 같은 빨강 — 맥락(아이콘·레이아웃)으로 구분한다 */
  danger: string;
  /** 수집 실패·지연 */
  warning: string;

  // ── 그래픽 ──
  /** 다층 카테고리 차트 (최대 6계열). 8섹터는 아이콘+라벨로 식별 */
  chart: readonly string[];
  /** 오로라 배경 blob 피크색 3개. 값이 곧 최댓값이라 카드보다 밝아질 수 없다 */
  aurora: readonly [string, string, string];
  /** 떠 있는 요소 전용 (FAB·시트·스낵바). 엘리베이션 랭킹에는 쓰지 말 것 */
  shadow: string;
}

/**
 * DARK (기본) — 중립 램프 OKLCH H=265, C=0.030 고정.
 * 엘리베이션이 올라도 채도는 오르지 않는다 (야간에 화면이 파랗게 뜨는 것 방지).
 */
export const darkColors: ThemeColors = {
  background: '#0E1422', //  L .193  캔버스
  backgroundSoft: '#141A29', //  L .220  vs bg 1.06
  card: '#1A2130', //  L .248  vs bg 1.14
  cardPressed: '#202736', //  L .273  vs bg 1.23
  surface: '#262E3D', //  L .300  vs bg 1.35
  surfaceHigh: '#323949', //  L .345  vs bg 1.59
  scrim: 'rgba(6,11,24,0.72)',

  textPrimary: '#DADEE7', // vs bg 13.65:1  APCA -85.8  (상한 -90 아래)
  textSecondary: '#AFB7C5', // vs bg  9.11:1  APCA -62.4
  textTertiary: '#9199A9', // vs bg  6.42:1  APCA -46.2
  textDisabled: '#6F7888', // vs bg  4.13:1  APCA -30.0  (APCA 최소치)

  borderSubtle: 'rgba(255,255,255,0.06)', // card 위 #282E3C (1.19)
  border: 'rgba(255,255,255,0.10)', // card 위 #313745 (1.35)
  borderStrong: 'rgba(255,255,255,0.16)', // card 위 #3F4551 (1.67)
  divider: 'rgba(255,255,255,0.07)',
  innerHighlight: 'rgba(255,255,255,0.07)',

  primary: '#A6B0FF', // vs bg 9.00:1  APCA -61.8  H=278 (블루-바이올렛)
  primaryFill: '#1B6FE1', // 흰 라벨 4.76:1  APCA 77.9  ← 다크 CTA 는 오히려 어둡게
  primaryPressed: '#1560C8', // 흰 라벨 5.93:1
  onPrimaryFill: '#FFFFFF',
  primarySoft: '#1E3150', // #3182F6 16% over card
  violet: '#D2A3FF', // vs bg 9.13:1  H=307  그라디언트·브랜드 포인트 전용
  indigo: '#A6B0FF', // = primary

  up: '#FF9A8C', // vs bg 8.98:1  APCA -61.9  H=29  C=0.124
  down: '#69B2F7', // vs bg 8.16:1  APCA -57.1  H=249 C=0.124
  flat: '#B0B6C3', // vs bg 9.04:1  APCA -62.0
  upSoft: '#3F343F', // up 16% over card — 칩 위 up 텍스트 5.78:1
  downSoft: '#273850', // down 16% over card — 칩 위 down 텍스트 5.27:1

  success: '#94C18E', // H=142 (민트 아님) — 완료 피드백 전용
  danger: '#FF9A8C', // = up
  warning: '#E8B45C', // vs bg 9.73:1

  chart: ['#85BCFF', '#A090E3', '#EFA9E8', '#EE8676', '#FCC176', '#8594A4'],
  aurora: ['#02193D', '#211136', '#121834'], // 전부 L≈0.221 < card L 0.248
  shadow: 'rgba(4,7,14,0.55)',
};

/**
 * NIGHT (심야) — OKLCH H=62~78, 웜 시프트.
 * textPrimary CCT 는 7111K → 5321K, 액센트는 3112K (iOS Night Shift 최난색과 동급).
 * 브랜드 블루는 violet(#B9A6E0) 로 살아남는다 — 로고·그라디언트·섹터 태그.
 */
export const nightColors: ThemeColors = {
  background: '#16100A', //  L .178
  backgroundSoft: '#1D160F', //  L .206
  card: '#251C14', //  L .235
  cardPressed: '#2B2119', //  L .257
  surface: '#32281F', //  L .285
  surfaceHigh: '#3E3329', //  L .330
  scrim: 'rgba(10,6,3,0.74)',

  textPrimary: '#E0D3BF', // vs bg 12.80:1  APCA -80.3 (다크보다 의도적으로 낮춤)
  textSecondary: '#BCAC94', // vs bg  8.51:1  APCA -57.9
  textTertiary: '#A39278', // vs bg  6.24:1  APCA -44.2
  textDisabled: '#86755A', // vs bg  4.23:1  APCA -30.2

  // 알파 베이스가 흰색이 아닌 웜 화이트 — 보더에서도 청색 채널을 억제한다
  borderSubtle: 'rgba(255,214,170,0.06)', // card 위 #32271D (1.15)
  border: 'rgba(255,214,170,0.10)', // card 위 #3B2F23 (1.29)
  borderStrong: 'rgba(255,214,170,0.16)', // card 위 #483A2C (1.53)
  divider: 'rgba(255,214,170,0.07)',
  innerHighlight: 'rgba(255,214,170,0.08)',

  primary: '#E0A75B', // vs bg 8.85:1  APCA -60.0  ≈3112K
  primaryFill: '#D59741', // 어두운 라벨 7.49:1  APCA 54.1
  primaryPressed: '#BC8433', // 어두운 라벨 5.83:1
  onPrimaryFill: '#16100A', // ← night 만 어두운 라벨
  primarySoft: '#43321F', // #E0A75B 16% over card
  violet: '#B9A6E0', // vs bg 8.62:1  H=299 — 심야에 남는 브랜드 아이덴티티
  indigo: '#B9A6E0',

  up: '#F89884', // vs bg 8.82:1  APCA -60.0
  down: '#8EB6DC', // vs bg 8.88:1  C=0.070 저채도 더스티 블루 (눈편함 우선)
  flat: '#BAB0A6', // vs bg 8.85:1
  upSoft: '#473026', // 칩 위 up 텍스트 5.71:1
  downSoft: '#363534', // 칩 위 down 텍스트 5.76:1

  success: '#A9BE8A',
  danger: '#F89884',
  warning: '#DCC97A', // primary 와 OKLab 거리 0.10 — 아이콘 병용 필수

  chart: ['#FDBD69', '#E28A6F', '#FEA9AF', '#C588B0', '#C6B2ED', '#7196BC'],
  aurora: ['#271202', '#2A0F0B', '#1F1704'], // 전부 L≈0.210 < card L 0.235
  shadow: 'rgba(8,4,1,0.60)',
};

/** LIGHT (보조) — 라이트는 그림자로 깊이를 만든다. 표면 사다리를 쓰지 않는다. */
export const lightColors: ThemeColors = {
  background: '#FFFFFF',
  backgroundSoft: '#F7F8FA',
  card: '#FFFFFF',
  cardPressed: '#EDF0F3',
  surface: '#F2F4F6',
  surfaceHigh: '#FFFFFF',
  scrim: 'rgba(23,28,40,0.45)',

  textPrimary: '#191F28', // 16.56:1  APCA 103.5
  textSecondary: '#4E5968', //  7.11:1  APCA  84.7
  textTertiary: '#727D8B', //  4.18:1  APCA  68.8
  textDisabled: '#AAB2BC', //  2.14:1  APCA  42.1

  borderSubtle: 'rgba(23,28,40,0.06)',
  border: '#E5E8EB',
  borderStrong: 'rgba(23,28,40,0.16)',
  divider: 'rgba(23,28,40,0.07)',
  innerHighlight: 'transparent', // 라이트에는 이너 하이라이트가 필요 없다

  primary: '#5B58D6', //  5.51:1  APCA 77.1  H=279
  primaryFill: '#1D5FD8', // 흰 라벨 5.71:1  (기존 #3182F6 은 3.71:1 로 AA 실패였다)
  primaryPressed: '#1A50BC', // 흰 라벨 7.20:1
  onPrimaryFill: '#FFFFFF',
  primarySoft: '#EFEFF9',
  violet: '#7B3FE4',
  indigo: '#5B58D6',

  up: '#C62633', //  5.64:1  칩 위 4.66:1
  down: '#0F5FB8', //  6.27:1  칩 위 5.24:1
  flat: '#6B7684', //  4.62:1
  upSoft: '#F8E5E7',
  downSoft: '#E2ECF6',

  success: '#137A45',
  danger: '#C62633',
  warning: '#A8690F',

  chart: ['#2F7BD6', '#6C5BC4', '#B65AA8', '#C9614C', '#B0821F', '#5C6B7A'],
  aurora: ['#EFF3FE', '#F4EFFC', '#FBF1F4'],
  shadow: 'rgba(40,50,90,0.06)',
};

export const themes: Record<ThemeName, ThemeColors> = {
  light: lightColors,
  dark: darkColors,
  night: nightColors,
};

/**
 * 등락 색 단일 진입점.
 * ui.tsx / PriceChartCard.tsx / HistoryScreen.tsx 에 흩어진 삼항식을 전부 이걸로 교체한다.
 * HistoryScreen 은 현재 미국식(상승=녹색)으로 반대이므로 이 교체가 곧 버그 수정이다.
 */
export const changeColor = (pct: number, c: ThemeColors): string =>
  pct > 0 ? c.up : pct < 0 ? c.down : c.flat;

/** 색만으로 방향을 전달하지 않기 위한 기호 (WCAG 1.4.1) */
export const changeMark = (pct: number): string =>
  pct > 0 ? '▲' : pct < 0 ? '▼' : '—';

/** 섹터 8개 → 차트 6계열 매핑. 색이 겹치는 2쌍은 아이콘+라벨로 식별한다. */
export const sectorChartColor = (sectorIndex: number, c: ThemeColors): string =>
  c.chart[sectorIndex % c.chart.length];

export const radius = {
  card: 20,
  button: 14,
  chip: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

/**
 * 다크 타이포 보정 — 다크 배경에서 글리프는 광학적으로 굵어 보인다(irradiation).
 * 한글은 라틴보다 획 밀도가 높아 헤일레이션에 더 취약하다.
 */
export const typography = {
  /** 라이트에서 600 이던 것을 다크/심야에서는 500 으로 내린다 */
  bodyWeight: { light: '600', dark: '500', night: '500' },
  /** Raycast 가 명시적으로 채택한 값 */
  letterSpacing: { light: 0, dark: 0.2, night: 0.3 },
  /** 야간 독서 기준 */
  lineHeightRatio: 1.6,
  /** 다크에서 금지: 12px 이하 + weight 300 이하 조합 */
  minSizeForLightWeight: 13,
} as const;

/** 모션 스펙 단일 소스 (§3 모션 표와 1:1) */
export const motion = {
  duration: {
    micro: 120, // press in/out
    fast: 180, // 칩·탭 전환
    base: 260, // 카드 진입, 페이드
    slow: 420, // 모달·시트
    theme: 600, // 테마 크로스페이드
  },
  /** cubic-bezier — Easing.bezier(...) 인자와 동일 순서 */
  easing: {
    standard: [0.22, 1, 0.36, 1], // easeOutQuint — 진입 기본
    exit: [0.4, 0, 1, 1], // easeIn — 퇴장
    press: [0.2, 0, 0, 1],
  },
  spring: {
    card: { damping: 18, stiffness: 180, mass: 0.9 },
    tilt: { damping: 14, stiffness: 120 },
    sheet: { damping: 22, stiffness: 200 },
  },
  stagger: 45, // 리스트 아이템 간 지연 (ms), 최대 6개까지만 적용
} as const;
