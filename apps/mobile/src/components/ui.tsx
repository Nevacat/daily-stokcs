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
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { Sentiment, StockQuote } from '@daily-stocks/shared';
import { formatPrice } from '../api/client';
import { useTheme } from '../theme/ThemeContext';
import {
  changeColor,
  changeMark,
  motion,
  radius,
  spacing,
} from '../theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * DeTok Card — 깊이는 표면 명도 + 알파 보더 + 상단 이너 하이라이트로 만든다.
 * 다크/심야에서 그림자는 "떠 있음"이 아니라 "얼룩"으로 읽히므로 라이트에서만 쓴다.
 */
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
  const { colors, isDark } = useTheme();
  const reduced = useReducedMotion();
  const press = useSharedValue(0);

  const baseBg = selected ? colors.primarySoft : colors.card;
  const pressedBg = selected ? colors.primarySoft : colors.cardPressed;

  const base: ViewStyle = {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
    ...(isDark
      ? null
      : {
          shadowColor: colors.shadow,
          shadowOpacity: 1,
          shadowRadius: 15,
          shadowOffset: { width: 0, height: 8 },
          elevation: 2,
        }),
  };

  // 상단 1px — 다크에서 그림자를 대신하는 깊이 단서 (라이트 토큰은 transparent)
  const highlight = (
    <View
      pointerEvents="none"
      style={[
        styles.innerHighlight,
        { backgroundColor: colors.innerHighlight },
      ]}
    />
  );

  // 모션 표 C: press-in 120ms, press-out spring. reduce motion 이면 배경색만 바꾼다.
  // (훅은 조건부 return 위에 있어야 한다)
  const animated = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(press.value, [0, 1], [baseBg, pressedBg]),
    transform: [{ scale: 1 - press.value * (reduced ? 0 : 0.025) }],
  }));

  if (!onPress) {
    return (
      <View style={[base, { backgroundColor: baseBg }, style]}>
        {highlight}
        {children}
      </View>
    );
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        press.value = withTiming(1, {
          duration: motion.duration.micro,
          easing: Easing.bezier(...motion.easing.press),
        });
      }}
      onPressOut={() => {
        press.value = reduced
          ? withTiming(0, { duration: motion.duration.micro })
          : withSpring(0, motion.spring.card);
      }}
      style={[base, animated, style]}
    >
      {highlight}
      {children}
    </AnimatedPressable>
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
    // primary 는 액센트(colors.primary)가 아니라 CTA 전용 채움색을 쓴다
    if (variant === 'primary')
      return pressed ? colors.primaryPressed : colors.primaryFill;
    if (variant === 'secondary') return colors.surface;
    return pressed ? colors.backgroundSoft : 'transparent';
  };
  // 심야 테마는 라벨이 어둡다 — 흰색 하드코딩 금지
  const textColor =
    variant === 'primary'
      ? colors.onPrimaryFill
      : variant === 'secondary'
        ? colors.primary
        : colors.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: background(pressed),
          opacity: isDisabled ? 0.55 : 1,
        },
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

/** 알약형 선택 칩 (섹터/필터/설정 공용) — 아이콘 옵션 지원 */
export function Chip({
  label,
  active,
  onPress,
  Icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  Icon?: React.ComponentType<{ size?: number; color?: string }>;
}) {
  const { colors } = useTheme();
  const textColor = active ? colors.primary : colors.textSecondary;
  // 선택 상태도 원색 채움 대신 옅은 액센트 배경 + 액센트 텍스트
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.primarySoft : colors.surface,
          borderColor: active ? colors.primarySoft : colors.borderSubtle,
        },
      ]}
    >
      {Icon && <Icon size={13} color={textColor} />}
      <Text
        style={{
          color: textColor,
          fontSize: 13,
          fontWeight: active ? '700' : '500',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const SENTIMENT_LABELS: Record<Sentiment, string> = {
  positive: '호재',
  negative: '악재',
  neutral: '중립',
};

/** 뉴스 감성 배지 — 호재는 up(빨강), 악재는 down(파랑). 시세 색과 의미를 통일한다. */
export function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  const { colors } = useTheme();
  const { color, background } =
    sentiment === 'positive'
      ? { color: colors.up, background: colors.upSoft }
      : sentiment === 'negative'
        ? { color: colors.down, background: colors.downSoft }
        : { color: colors.flat, background: colors.surface };
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={{ color, fontSize: 11, fontWeight: '700' }}>
        {SENTIMENT_LABELS[sentiment]}
      </Text>
    </View>
  );
}

/** 시세 한 줄: 가격 + 전일 대비 등락률 (국내 관례: 상승 빨강 ▲ / 하락 파랑 ▼) */
export function QuoteLine({
  quote,
  size = 13,
}: {
  quote: StockQuote;
  size?: number;
}) {
  const { colors } = useTheme();
  return (
    <Text style={{ fontSize: size }}>
      <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>
        {formatPrice(quote)}
      </Text>
      <Text
        style={{
          color: changeColor(quote.changePct, colors),
          fontWeight: '600',
        }}
      >
        {'  '}
        {changeMark(quote.changePct)} {Math.abs(quote.changePct).toFixed(2)}%
      </Text>
    </Text>
  );
}

// ScorePill 은 ScoreRing(components/ScoreRing.tsx)으로 대체됐다 — 링 + 카운트업 + 점수대별 색.

const styles = StyleSheet.create({
  // 라운드 코너와 싸우지 않게 좌우 20px 인셋
  innerHighlight: {
    position: 'absolute',
    top: 0,
    left: radius.card,
    right: radius.card,
    height: 1,
  },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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

/**
 * 0~100 추천 점수 (구형).
 *
 * ponytail: 다음 PR(`feature/motion-3d-core`)의 `ScoreRing` 이 링 게이지 + 카운트업으로
 * 이 역할을 대체하고 이 export 는 제거된다. 지금 남겨두는 이유는 이 PR 하나만 머지해도
 * HomeScreen·HistoryScreen·StockDetailModal·RecommendationDetailModal 이 컴파일되게
 * 하기 위해서다 — 스택 PR 의 중간 단계가 깨지면 되돌릴 지점이 사라진다.
 */
export function ScorePill({ score }: { score: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.score}>
      <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 16 }}>
        {score}
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 10 }}>점</Text>
    </View>
  );
}
