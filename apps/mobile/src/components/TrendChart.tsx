import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SentimentTrend } from '@daily-stocks/shared';
import { useTheme } from '../theme/ThemeContext';
import { spacing } from '../theme/tokens';

const BAR_MAX_HEIGHT = 56;

/**
 * 최근 7일 감성 트렌드 미니 차트 (기획서 §3.5).
 * 날짜별로 호재(위·초록)/악재(아래·빨강) 건수를 쌓은 막대.
 */
export function TrendChart({ trend }: { trend: SentimentTrend }) {
  const { colors } = useTheme();
  const max = Math.max(
    1,
    ...trend.days.map(d => d.positive + d.negative),
  );
  const scale = BAR_MAX_HEIGHT / max;

  return (
    <View>
      <View style={styles.chartRow}>
        {trend.days.map(day => (
          <View key={day.date} style={styles.dayColumn}>
            <View style={styles.barArea}>
              {day.positive > 0 && (
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(3, day.positive * scale),
                      backgroundColor: colors.success,
                    },
                  ]}
                />
              )}
              {day.negative > 0 && (
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(3, day.negative * scale),
                      backgroundColor: colors.danger,
                    },
                  ]}
                />
              )}
              {day.positive === 0 && day.negative === 0 && (
                <View
                  style={[
                    styles.bar,
                    styles.emptyBar,
                    { backgroundColor: colors.border },
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
        <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
        <Text style={[styles.legendText, { color: colors.textSecondary }]}>호재</Text>
        <View style={[styles.legendDot, { backgroundColor: colors.danger }]} />
        <Text style={[styles.legendText, { color: colors.textSecondary }]}>악재</Text>
      </View>
    </View>
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
  bar: { width: 14, borderRadius: 4, alignSelf: 'center' },
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
