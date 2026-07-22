import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing } from '../theme/tokens';

/** 로딩 스켈레톤 — 은은한 펄스 애니메이션 */
export function Skeleton({
  height = 14,
  width = '100%',
  style,
}: {
  height?: number;
  width?: number | `${number}%`;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { height, width, opacity, backgroundColor: colors.surface, borderRadius: 8 },
        style,
      ]}
    />
  );
}

/** 추천/뉴스 카드 형태의 스켈레톤 */
export function SkeletonCard() {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.body}>
        <Skeleton width="45%" height={16} />
        <Skeleton width="30%" height={11} />
        <Skeleton width="90%" height={12} />
      </View>
      <Skeleton width={52} height={52} style={styles.circle} />
    </View>
  );
}

const styles = StyleSheet.create({
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
