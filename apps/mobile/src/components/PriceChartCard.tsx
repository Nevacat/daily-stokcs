import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import type { ChartRange, PriceChart } from '@daily-stocks/shared';
import { CHART_RANGE_LABELS, CHART_RANGES } from '@daily-stocks/shared';
import { api } from '../api/client';
import { Skeleton } from './Skeleton';
import { Card, Chip } from './ui';
import { useTheme } from '../theme/ThemeContext';
import { spacing } from '../theme/tokens';

const CHART_HEIGHT = 140;

/**
 * 주가 차트 카드 (토스 스타일) — 구간 선택 + 라인 차트.
 * 1일 구간은 전일 종가를 점선 기준선으로 표시하고,
 * 기준 대비 상승이면 빨강, 하락이면 파랑 (국내 관례).
 */
export function PriceChartCard({ ticker }: { ticker: string }) {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const [range, setRange] = useState<ChartRange>('1d');
  const [chart, setChart] = useState<PriceChart | null>(null);
  const [loading, setLoading] = useState(true);

  const chartWidth = screenWidth - spacing.xl * 2 - spacing.lg * 2;

  useEffect(() => {
    let stale = false;
    setLoading(true);
    api
      .priceChart(ticker, range)
      .then(res => {
        if (!stale) setChart(res.data);
      })
      .catch(() => {
        if (!stale) setChart(null);
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [ticker, range]);

  const rendered = useMemo(() => {
    if (!chart || chart.points.length < 2) return null;

    const prices = chart.points.map(p => p.price);
    // 1일: 전일 종가 기준, 그 외: 구간 첫 가격 기준
    const baseline =
      chart.range === '1d' && chart.previousClose !== null
        ? chart.previousClose
        : prices[0];
    const min = Math.min(...prices, baseline);
    const max = Math.max(...prices, baseline);
    const span = max - min || 1;

    const x = (i: number) => (i / (chart.points.length - 1)) * chartWidth;
    const y = (price: number) =>
      CHART_HEIGHT - ((price - min) / span) * (CHART_HEIGHT - 8) - 4;

    const path = chart.points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.price).toFixed(1)}`)
      .join(' ');

    const last = prices[prices.length - 1];
    const changePct = Math.round(((last - baseline) / baseline) * 10000) / 100;

    return { path, baselineY: y(baseline), last, changePct };
  }, [chart, chartWidth]);

  const up = (rendered?.changePct ?? 0) > 0;
  const flat = (rendered?.changePct ?? 0) === 0;
  const lineColor = flat ? colors.textSecondary : up ? colors.danger : colors.primary;

  return (
    <Card style={styles.card}>
      {loading ? (
        <Skeleton height={CHART_HEIGHT} />
      ) : !rendered ? (
        <Text style={[styles.empty, { color: colors.textSecondary }]}>
          차트 데이터를 불러오지 못했어요.
        </Text>
      ) : (
        <>
          <Text style={[styles.changeLabel, { color: lineColor }]}>
            {CHART_RANGE_LABELS[range]}{' '}
            {flat ? '보합' : `${up ? '+' : ''}${rendered.changePct}%`}
          </Text>
          <Svg width={chartWidth} height={CHART_HEIGHT}>
            <Line
              x1={0}
              y1={rendered.baselineY}
              x2={chartWidth}
              y2={rendered.baselineY}
              stroke={colors.border}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <Path d={rendered.path} stroke={lineColor} strokeWidth={2} fill="none" />
          </Svg>
        </>
      )}

      <View style={styles.rangeRow}>
        {CHART_RANGES.map(r => (
          <Chip
            key={r}
            label={CHART_RANGE_LABELS[r]}
            active={range === r}
            onPress={() => setRange(r)}
          />
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  changeLabel: { fontSize: 13, fontWeight: '700' },
  empty: { fontSize: 13, paddingVertical: spacing.xl, textAlign: 'center' },
  rangeRow: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
});
