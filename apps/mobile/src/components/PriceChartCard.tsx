import React, { useEffect, useId, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { ChartRange, PriceChart } from '@daily-stocks/shared';
import { CHART_RANGE_LABELS, CHART_RANGES } from '@daily-stocks/shared';
import { api } from '../api/client';
import { Skeleton } from './Skeleton';
import { Card, Chip } from './ui';
import { useTheme } from '../theme/ThemeContext';
import { changeColor, changeMark, motion, spacing } from '../theme/tokens';
import { useMotionReduced } from './motion';

const CHART_HEIGHT = 140;
const AnimatedPath = Animated.createAnimatedComponent(Path);
const GRID_RATIOS = [0.25, 0.5, 0.75];
/** 크로스헤어가 잡히기 시작하는 가로 이동량 (px) */
const PAN_ACTIVE_X = 8;
/** 이만큼 세로로 먼저 움직이면 제스처를 포기하고 바깥 ScrollView 에 넘긴다 (px) */
const PAN_FAIL_Y = 12;

/**
 * 주가 차트 카드 (디자이너 스펙 PROMPT 9, 모션 표 L).
 * 라인 드로우온 + 하단 그라디언트 + 터치 크로스헤어.
 *
 * Skia 로 옮기지 않는다 — trim 하나 있는 정적 폴리라인이라
 * 상세 모달마다 네이티브 서피스를 하나 더 만들 이유가 없다.
 */
export function PriceChartCard({
  ticker,
  previewChart,
}: {
  ticker: string;
  /** 개발 갤러리 전용 — 주면 API 를 호출하지 않는다 */
  previewChart?: PriceChart;
}) {
  const { colors, theme } = useTheme();
  const reduced = useMotionReduced();
  const { width: screenWidth } = useWindowDimensions();
  const [range, setRange] = useState<ChartRange>(previewChart?.range ?? '1d');
  const [chart, setChart] = useState<PriceChart | null>(previewChart ?? null);
  const [loading, setLoading] = useState(!previewChart);
  const [cursor, setCursor] = useState(0);

  const chartWidth = screenWidth - spacing.xl * 2 - spacing.lg * 2;
  // SVG 그라디언트 id 는 문서 전역이다. React 19 의 useId 는 '«r0»' 형태라 url(#…) 참조를 깨뜨린다 — 영숫자만 남긴다. (Skeleton.tsx 와 같은 방식)
  const fillId = `pf${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  useEffect(() => {
    if (previewChart) return;
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
  }, [ticker, range, previewChart]);

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

    const coords = chart.points.map((p, i) => ({ x: x(i), y: y(p.price) }));
    const path = coords
      .map(
        (c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`,
      )
      .join(' ');
    // 라인 아래를 바닥까지 닫아 채움 영역을 만든다
    const areaPath = `${path} L${chartWidth.toFixed(1)} ${CHART_HEIGHT} L0 ${CHART_HEIGHT} Z`;

    // dash 애니메이션에 쓸 길이 — 세그먼트 길이 합으로 충분히 정확하다
    const length = coords.reduce(
      (sum, c, i) =>
        i === 0
          ? 0
          : sum + Math.hypot(c.x - coords[i - 1].x, c.y - coords[i - 1].y),
      0,
    );

    const last = prices[prices.length - 1];
    const changePct = Math.round(((last - baseline) / baseline) * 10000) / 100;

    return {
      path,
      areaPath,
      coords,
      length,
      baselineY: y(baseline),
      min,
      max,
      last,
      changePct,
    };
  }, [chart, chartWidth]);

  const lineColor = changeColor(rendered?.changePct ?? 0, colors);
  // 밝은 선은 어두운 배경에서 광학적으로 번진다 — 다크는 더 얇게
  const strokeWidth = theme === 'light' ? 2.5 : 2;

  // ── 모션 L: 라인 드로우온 ──────────────────────────────────────────────
  const draw = useSharedValue(1);
  const pathLength = rendered?.length ?? 0;

  useEffect(() => {
    if (!rendered) return;
    if (reduced) {
      draw.value = 1;
      return;
    }
    draw.value = 0;
    draw.value = withTiming(1, {
      duration: 550,
      easing: Easing.bezier(...motion.easing.standard),
    });
  }, [rendered, reduced, draw]);

  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: pathLength * (1 - draw.value),
  }));
  // 채움이 선보다 앞서 나타나지 않게 마지막 250ms 에 걸쳐 올라온다
  const areaProps = useAnimatedProps(() => ({
    opacity: Math.max(0, (draw.value - 0.55) / 0.45),
  }));

  // ── 크로스헤어 (누르고 있는 동안에만) ─────────────────────────────────
  const cursorOpacity = useSharedValue(0);
  const cursorIndex = useSharedValue(-1);
  const pointCount = rendered?.coords.length ?? 0;

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // 축 분리 — 이 카드는 상세 모달의 ScrollView 안에 있다.
        // 첫 움직임에 바로 활성화되면(minDistance(0)) 차트 위에서 손가락을 내렸을 때
        // 크로스헤어만 뜨고 모달이 스크롤되지 않는다.
        .activeOffsetX([-PAN_ACTIVE_X, PAN_ACTIVE_X])
        .failOffsetY([-PAN_FAIL_Y, PAN_FAIL_Y])
        // onBegin(터치 다운)이 아니라 활성화 시점에 띄운다 — 세로로 쓸어넘길 때 깜빡이지 않게
        .onStart(() => {
          cursorOpacity.value = withTiming(1, { duration: 120 });
        })
        .onUpdate(e => {
          if (pointCount < 2) return;
          const ratio = Math.min(1, Math.max(0, e.x / chartWidth));
          const next = Math.round(ratio * (pointCount - 1));
          // 인덱스가 바뀔 때만 JS 로 넘긴다 (매 프레임 setState 방지)
          if (next !== cursorIndex.value) {
            cursorIndex.value = next;
            runOnJS(setCursor)(next);
          }
        })
        .onFinalize(() => {
          cursorIndex.value = -1;
          cursorOpacity.value = withTiming(0, { duration: 180 });
        }),
    [chartWidth, pointCount, cursorIndex, cursorOpacity],
  );

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  const point = rendered?.coords[Math.min(cursor, pointCount - 1)];
  const cursorPoint = chart?.points[Math.min(cursor, pointCount - 1)];
  const currency = chart?.currency ?? 'KRW';

  const up = (rendered?.changePct ?? 0) > 0;
  const flat = (rendered?.changePct ?? 0) === 0;

  return (
    <Card style={styles.card}>
      {loading ? (
        <Skeleton height={CHART_HEIGHT} />
      ) : !rendered ? (
        <Text style={[styles.empty, { color: colors.textSecondary }]}>
          차트를 불러오지 못했어요. 잠시 후 다시 볼까요?
        </Text>
      ) : (
        <>
          <Text style={[styles.changeLabel, { color: lineColor }]}>
            {CHART_RANGE_LABELS[range]}{' '}
            {flat
              ? '보합'
              : `${changeMark(rendered.changePct)} ${Math.abs(
                  rendered.changePct,
                ).toFixed(2)}%`}
          </Text>

          <GestureDetector gesture={pan}>
            <View style={{ width: chartWidth, height: CHART_HEIGHT }}>
              <Svg
                width={chartWidth}
                height={CHART_HEIGHT}
                accessibilityLabel={`${CHART_RANGE_LABELS[range]} ${
                  up ? '상승' : flat ? '보합' : '하락'
                } ${Math.abs(rendered.changePct)}퍼센트`}
              >
                <Defs>
                  <LinearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={lineColor} stopOpacity="0.22" />
                    <Stop offset="1" stopColor={lineColor} stopOpacity="0" />
                  </LinearGradient>
                </Defs>

                {GRID_RATIOS.map(ratio => (
                  <Line
                    key={ratio}
                    x1={0}
                    y1={CHART_HEIGHT * ratio}
                    x2={chartWidth}
                    y2={CHART_HEIGHT * ratio}
                    stroke={colors.divider}
                    strokeWidth={1}
                  />
                ))}

                {/* 기준선 — 1일은 전일 종가 */}
                <Line
                  x1={0}
                  y1={rendered.baselineY}
                  x2={chartWidth}
                  y2={rendered.baselineY}
                  stroke={colors.borderStrong}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />

                <AnimatedPath
                  d={rendered.areaPath}
                  fill={`url(#${fillId})`}
                  animatedProps={areaProps}
                />
                <AnimatedPath
                  d={rendered.path}
                  stroke={lineColor}
                  strokeWidth={strokeWidth}
                  strokeLinejoin="round"
                  fill="none"
                  strokeDasharray={rendered.length}
                  animatedProps={lineProps}
                />
              </Svg>

              {/* 크로스헤어 — 누르고 있는 동안만 보인다 (자율 모션이 아니라 사용자 조작) */}
              {point && (
                <Animated.View
                  pointerEvents="none"
                  style={[StyleSheet.absoluteFill, cursorStyle]}
                >
                  <Svg width={chartWidth} height={CHART_HEIGHT}>
                    <Line
                      x1={point.x}
                      y1={0}
                      x2={point.x}
                      y2={CHART_HEIGHT}
                      stroke={colors.textSecondary}
                      strokeWidth={1}
                    />
                    <Circle
                      cx={point.x}
                      cy={point.y}
                      r={4}
                      fill={lineColor}
                      stroke={colors.card}
                      strokeWidth={2}
                    />
                  </Svg>
                </Animated.View>
              )}
            </View>
          </GestureDetector>

          {/* 최고·최저 축 라벨 */}
          <View style={styles.axisRow}>
            <Text style={[styles.axis, { color: colors.textTertiary }]}>
              최저 {formatMoney(rendered.min, currency)}
            </Text>
            <Text style={[styles.axis, { color: colors.textTertiary }]}>
              최고 {formatMoney(rendered.max, currency)}
            </Text>
          </View>

          {cursorPoint && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.tooltip,
                { backgroundColor: colors.surfaceHigh },
                cursorStyle,
              ]}
            >
              <Text
                style={[styles.tooltipPrice, { color: colors.textPrimary }]}
              >
                {formatMoney(cursorPoint.price, currency)}
              </Text>
              <Text
                style={[styles.tooltipTime, { color: colors.textTertiary }]}
              >
                {formatKst(cursorPoint.t, range)}
              </Text>
            </Animated.View>
          )}
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

const formatMoney = (value: number, currency: string): string =>
  currency === 'USD'
    ? `$${value.toFixed(2)}`
    : `${Math.round(value).toLocaleString('ko-KR')}원`;

/** 저장은 ISO 8601 UTC, 표시 시점에 KST 로 바꾼다 */
const formatKst = (iso: string, range: ChartRange): string =>
  new Date(iso).toLocaleString(
    'ko-KR',
    range === '1d'
      ? {
          timeZone: 'Asia/Seoul',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        }
      : { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' },
  );

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  // 숫자는 전부 고정폭 — 값이 바뀔 때 자리가 흔들리지 않는다
  changeLabel: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  empty: { fontSize: 13, paddingVertical: spacing.xl, textAlign: 'center' },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between' },
  axis: { fontSize: 10, fontVariant: ['tabular-nums'] },
  tooltip: {
    position: 'absolute',
    top: 0,
    right: 0,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'flex-end',
  },
  tooltipPrice: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  tooltipTime: { fontSize: 10, fontVariant: ['tabular-nums'] },
  rangeRow: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
});
