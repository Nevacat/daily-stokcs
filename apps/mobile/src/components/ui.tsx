import React, { type PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { Sentiment } from '@daily-stocks/shared';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing } from '../theme/tokens';

/** DeTok Card — radius 20, 은은한 그림자 */
export function Card({
  children,
  style,
  onPress,
  selected,
}: PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  selected?: boolean;
}>) {
  const { colors } = useTheme();
  const base: ViewStyle = {
    backgroundColor: selected ? colors.surface : colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [base, pressed && { opacity: 0.85 }, style]}
    >
      {children}
    </Pressable>
  );
}

/** Primary / Secondary / Ghost 버튼 (디자인 시스템 §Button) */
export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const background = (pressed: boolean): string => {
    if (variant === 'primary')
      return pressed ? colors.primaryPressed : colors.primary;
    if (variant === 'secondary') return colors.surface;
    return pressed ? colors.backgroundSoft : 'transparent';
  };
  const textColor =
    variant === 'primary'
      ? '#FFFFFF'
      : variant === 'secondary'
        ? colors.primary
        : colors.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background(pressed), opacity: isDisabled ? 0.55 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

/** 알약형 선택 칩 (섹터/필터/설정 공용) */
export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.primary : colors.surface,
          borderColor: active ? colors.primary : colors.border,
        },
      ]}
    >
      <Text
        style={{
          color: active ? '#FFFFFF' : colors.textSecondary,
          fontSize: 13,
          fontWeight: active ? '700' : '500',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const SENTIMENT_META: Record<Sentiment, { label: string }> = {
  positive: { label: '호재' },
  negative: { label: '악재' },
  neutral: { label: '중립' },
};

/** 뉴스 감성 배지 */
export function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  const { colors } = useTheme();
  const color =
    sentiment === 'positive'
      ? colors.success
      : sentiment === 'negative'
        ? colors.danger
        : colors.textSecondary;
  return (
    <View style={[styles.badge, { backgroundColor: `${color}1A` }]}>
      <Text style={{ color, fontSize: 11, fontWeight: '700' }}>
        {SENTIMENT_META[sentiment].label}
      </Text>
    </View>
  );
}

/** 0~100 추천 점수 */
export function ScorePill({ score }: { score: number }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.score, { backgroundColor: colors.surface }]}>
      <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 16 }}>
        {score}
      </Text>
      <Text style={{ color: colors.textDisabled, fontSize: 10 }}>점</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.button,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
  },
  buttonText: { fontSize: 15, fontWeight: '700' },
  chip: {
    borderRadius: radius.chip,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  badge: {
    borderRadius: radius.chip,
    paddingVertical: 3,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
  },
  score: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.chip,
    width: 52,
    height: 52,
  },
});
