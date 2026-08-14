import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import type { SentimentTrend } from '@daily-stocks/shared';
import { useTheme } from '../theme/ThemeContext';
import { spacing } from '../theme/tokens';
import { useMotionReduced } from './motion';

const BAR_MAX_HEIGHT = 56;

/**
 * 최근 7일 감성 트렌드 미니 차트 (기획서 §3.5).
 * 색은 시세와 같은 한국 관례로 통일한다 — 호재 = up(빨강), 악재 = down(파랑).
 * (예전엔 호재가 success 초록이라 "빨강이 상승과 악재를 동시에 뜻하는" 상태였다)
 */
export function TrendChart({ trend }: { trend: SentimentTrend }) {
  const { colors } = useTheme();
  const max = Math.max(1, ...trend.days.map(d => d.positive + d.negative));
  const scale = BAR_MAX_HEIGHT / max;

  return (
    <View>
      <View style={styles.chartRow}>
        {trend.days.map((day, i) => (
          <View key={day.date} style={styles.dayColumn}>
            <View style={styles.barArea}>
              {day.positive > 0 && (
                <Bar
                  index={i}
                  height={Math.max(3, day.positive * scale)}
                  color={colors.up}
                />
              )}
              {day.negative > 0 && (
                <Bar
                  index={i}
                  height={Math.max(3, day.negative * scale)}
                  color={colors.down}
                />
              )}
              {day.positive === 0 && day.negative === 0 && (
                <View
                  style={[
                    styles.bar,
                    styles.emptyBar,
                    { backgroundColor: colors.divider },
                  ]}
                />
              )}
            </View>
            <Text style={[styles.dayLabel, { color: colors.textDisabled }]}>
              {Number(day.date.slice(8, 10))}일
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.legendRow}>
        <View style={[styles.legendDot, { backgroundColor: colors.up }]} />
        <Text style={[styles.legendText, { color: colors.textSecondary }]}>
          호재
        </Text>
        <View style={[styles.legendDot, { backgroundColor: colors.down }]} />
        <Text style={[styles.legendText, { color: colors.textSecondary }]}>
          악재
        </Text>
      </View>
    </View>
  );
}

/** 모션 표 M — 아래에서 자라나는 막대. 400ms, 날짜별 30ms stagger. */
function Bar({
  height,
  color,
  index,
}: {
  height: number;
  color: string;
  index: number;
}) {
  const reduced = useMotionReduced();
  const progress = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    // reduce motion 이면 최종 상태로 즉시 — 정보를 담은 그래픽은 없애지 않는다
    progress.value = reduced
      ? 1
      : withDelay(
          index * 30,
          withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }),
        );
  }, [reduced, index, progress, height]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scaleY: progress.value }],
  }));

  return (
    <Animated.View
      style={[styles.bar, { height, backgroundColor: color }, animated]}
    />
  );
}

const styles = StyleSheet.create({
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  dayColumn: { flex: 1, alignItems: 'center', gap: 4 },
  barArea: {
    height: BAR_MAX_HEIGHT + 6,
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'stretch',
  },
  // 바닥을 기준으로 자란다 — 기본값(center)이면 위아래로 벌어진다
  bar: {
    width: 14,
    borderRadius: 4,
    alignSelf: 'center',
    transformOrigin: 'bottom',
  },
  emptyBar: { height: 3 },
  dayLabel: { fontSize: 10 },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.sm,
    justifyContent: 'flex-end',
  },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, marginRight: spacing.sm },
});
