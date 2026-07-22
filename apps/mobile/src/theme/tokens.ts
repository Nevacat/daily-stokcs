/**
 * DeTok Design System v1.0 → 코드 토큰 (docs/design-system.md)
 * 라이트가 기준. 다크는 "검정 배경 금지" 원칙에 따라 딥 네이비 계열로
 * Blue+Violet 아이덴티티를 유지한다.
 */

export const palette = {
  primary: '#5B5CFF', // Primary Blue — 모든 CTA
  primaryHover: '#4B4CFF',
  primaryPressed: '#3E40F7',
  violet: '#9D86FF', // Soft Violet — 선택 상태, 그라디언트 시작
  indigo: '#7B8CFF', // Sky Indigo — 아이콘, Tag, Badge
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
  backgroundSoft: '#F7F8FC',
  card: '#FFFFFF',
  surface: '#F2F4FF',
  textPrimary: '#171923',
  textSecondary: '#6B7280',
  textDisabled: '#B8BEC9',
  border: '#E8EBF5',
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
  textPrimary: '#F2F3F8',
  textSecondary: '#9AA1B5',
  textDisabled: '#4C5266',
  border: '#282D48',
  primary: '#6B6CFF', // 다크 배경에서 가독성 위해 한 단계 밝게
  primaryPressed: '#5B5CFF',
  violet: palette.violet,
  indigo: palette.indigo,
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
