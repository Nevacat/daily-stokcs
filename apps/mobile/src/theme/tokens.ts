/**
 * DeTok Design System v1.1 → 코드 토큰 (docs/design-system.md)
 * v1.1: 사용자 피드백으로 primary를 토스 계열의 차분한 블루로 완화하고,
 * 채도 높은 면적을 줄이기 위해 primarySoft(옅은 블루 배경)를 도입.
 * 라이트가 기준. 다크는 "검정 배경 금지" 원칙에 따라 딥 네이비 계열.
 */

export const palette = {
  primary: '#3182F6', // Calm Blue — CTA (토스 계열의 눈이 편한 블루)
  primaryHover: '#2272EB',
  primaryPressed: '#1B64DA',
  violet: '#9D86FF', // Soft Violet — 그라디언트·브랜드 포인트 (로고 유지)
  indigo: '#6C8CF5', // Soft Indigo — 아이콘, Tag, Badge (채도 완화)
  success: '#22C55E',
  danger: '#EF4444',
  warning: '#F59E0B',
  marketIndex: '#64748B',
  gradient: ['#A882FF', '#7F8CFF', '#5B5CFF'] as const,
} as const;

export interface ThemeColors {
  background: string;
  backgroundSoft: string;
  card: string;
  surface: string;
  /** 옅은 primary 배경 — 선택 칩·강조 배경 (큰 면적에 원색 대신 사용) */
  primarySoft: string;
  textPrimary: string;
  textSecondary: string;
  textDisabled: string;
  border: string;
  primary: string;
  primaryPressed: string;
  violet: string;
  indigo: string;
  success: string;
  danger: string;
  warning: string;
  shadow: string;
}

export const lightColors: ThemeColors = {
  background: '#FFFFFF',
  backgroundSoft: '#F7F8FA',
  card: '#FFFFFF',
  surface: '#F2F4F8',
  primarySoft: '#EAF2FE',
  textPrimary: '#191F28', // 토스 그레이 계열 — 순검정보다 부드럽게
  textSecondary: '#6B7684',
  textDisabled: '#B0B8C1',
  border: '#E5E8EB',
  primary: palette.primary,
  primaryPressed: palette.primaryPressed,
  violet: palette.violet,
  indigo: palette.indigo,
  success: palette.success,
  danger: palette.danger,
  warning: palette.warning,
  shadow: 'rgba(40,50,90,0.06)',
};

export const darkColors: ThemeColors = {
  background: '#141622', // 딥 네이비 (순수 검정 금지)
  backgroundSoft: '#1A1D2E',
  card: '#1D2032',
  surface: '#252A44',
  primarySoft: '#1F3252',
  textPrimary: '#F2F3F8',
  textSecondary: '#9AA1B5',
  textDisabled: '#4C5266',
  border: '#282D48',
  primary: '#4E93F8', // 다크 배경에서 가독성 위해 한 단계 밝게
  primaryPressed: '#3182F6',
  violet: palette.violet,
  indigo: '#7E9AF7',
  success: '#34D57B',
  danger: '#F87171',
  warning: '#FBBF24',
  shadow: 'rgba(0,0,0,0.35)',
};

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
