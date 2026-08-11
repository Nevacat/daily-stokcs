import React, { useEffect, useId, useState } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing } from '../theme/tokens';
import { useMotionReduced } from './motion';

/**
 * 로딩 스켈레톤 — shimmer 스윕 (디자이너 스펙 PROMPT 6, 모션 표 G).
 *
 * 기존 opacity 0.4↔1.0 펄스를 버렸다: 새 다크 팔레트에서 surface 는 배경 대비 1.35:1 라
 * 그 진폭의 펄스가 "로딩"이 아니라 "카드가 깜빡인다"로 읽힌다.
 */

/** 스윕 하이라이트 — 보더 알파 단계와 같은 세기 */
const highlightOf = (theme: 'light' | 'dark' | 'night'): string =>
  theme === 'night'
    ? 'rgba(255,214,170,0.10)'
    : theme === 'light'
      ? 'rgba(255,255,255,0.85)'
      : 'rgba(255,255,255,0.10)';

export function Skeleton({
  height = 14,
  width = '100%',
  index = 0,
  style,
}: {
  height?: number;
  width?: number | `${number}%`;
  /** 그룹 안 순번 — 120ms 씩 밀어 순차로 쓸고 지나가게 한다 */
  index?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, theme } = useTheme();
  const reduced = useMotionReduced();
  const [measured, setMeasured] = useState(0);
  // SVG 그라디언트 id 는 문서 전역이다. React 19 의 useId 는 '«r0»' 형태라 url(#…) 참조를 깨뜨린다 — 영숫자만 남긴다.
  const gradientId = `sk${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const progress = useSharedValue(0);
  const pulse = useSharedValue(0.55);

  useEffect(() => {
    if (reduced) {
      // 편안한 명도 밴드 안에서만 움직인다 (0.4↔1.0 은 너무 넓다)
      pulse.value = withRepeat(
        withTiming(0.8, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
      return () => cancelAnimation(pulse);
    }
    if (measured === 0) return;
    progress.value = withDelay(
      index * 120,
      withRepeat(
        withTiming(1, { duration: 1200, easing: Easing.linear }),
        -1,
        false,
      ),
    );
    // 루프 도중 언마운트되면 애니메이션이 남는다 — 반드시 취소한다
    return () => cancelAnimation(progress);
  }, [reduced, measured, index, progress, pulse]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -measured + progress.value * measured * 2 }],
  }));
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width);
    if (next !== measured) setMeasured(next);
  };

  const bandWidth = Math.max(1, Math.round(measured * 0.4));
  const highlight = highlightOf(theme);

  return (
    <Animated.View
      onLayout={onLayout}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="불러오는 중"
      style={[
        styles.base,
        { height, width, backgroundColor: colors.surface },
        reduced ? pulseStyle : null,
        style,
      ]}
    >
      {!reduced && measured > 0 && (
        <Animated.View
          style={[styles.sweep, { width: bandWidth }, sweepStyle]}
          pointerEvents="none"
        >
          <Svg width={bandWidth} height={height}>
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={highlight} stopOpacity={0} />
                <Stop offset="0.5" stopColor={highlight} stopOpacity={1} />
                <Stop offset="1" stopColor={highlight} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect
              width={bandWidth}
              height={height}
              fill={`url(#${gradientId})`}
            />
          </Svg>
        </Animated.View>
      )}
    </Animated.View>
  );
}

/** 추천/뉴스 카드 형태의 스켈레톤 — index 를 주면 카드끼리 순차로 반짝인다 */
export function SkeletonCard({ index = 0 }: { index?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.borderSubtle },
      ]}
    >
      <View style={styles.body}>
        <Skeleton width="45%" height={16} index={index} />
        <Skeleton width="30%" height={11} index={index} />
        <Skeleton width="90%" height={12} index={index} />
      </View>
      <Skeleton width={52} height={52} index={index} style={styles.circle} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: 8, overflow: 'hidden' },
  sweep: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
  },
  body: { flex: 1, gap: spacing.sm },
  circle: { borderRadius: 26 },
});
