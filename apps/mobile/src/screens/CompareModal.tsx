import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import type { StockComparison } from '@daily-stocks/shared';
import { MARKET_LABELS, SECTOR_LABELS } from '@daily-stocks/shared';
import { api, formatPrice } from '../api/client';
import { StockLogo } from '../components/StockLogo';
import { Card } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';
import { changeColor, changeMark, spacing } from '../theme/tokens';
import { StockDetailModal } from './StockDetailModal';

/** 감성 막대 최대 높이 */
const BAR_MAX_HEIGHT = 44;

/**
 * 종목 비교 (기획서 §4 기능 ③).
 *
 * 진입점은 MyStocksScreen 의 선택 모드 하나뿐이다.
 * `tickers` 가 null 이면 닫힌 상태, 2~3개가 담기면 열린다 (개수 검증은 서버가 한다).
 *
 * 한 화면에 숫자를 몰아넣지 않는다 — 비교 행은 4개뿐이고,
 * 더 자세한 내용은 종목을 눌러 개별 상세로 넘긴다.
 */
export function CompareModal({
  tickers,
  onClose,
}: {
  tickers: string[] | null;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [items, setItems] = useState<StockComparison[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailTicker, setDetailTicker] = useState<string | null>(null);

  // 배열 참조가 아니라 값으로 비교해야 부모 리렌더마다 다시 부르지 않는다
  const key = tickers?.join(',') ?? '';

  useEffect(() => {
    if (!key) return;
    setItems(null);
    setError(null);
    api
      .compareStocks(key.split(','))
      .then(res => setItems(res.data))
      .catch(e =>
        setError(
          e instanceof Error ? e.message : '비교 정보를 불러오지 못했어요.',
        ),
      );
  }, [key]);

  // 감성 막대는 비교 대상 전체의 최댓값으로 정규화한다 (종목끼리 높이를 비교하려면 같은 자)
  const sentimentMax = Math.max(
    1,
    ...(items ?? []).map(c =>
      Math.max(c.sentiment7d.positive, c.sentiment7d.negative),
    ),
  );

  return (
    <Modal
      visible={tickers !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.backgroundSoft }}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 17,
              fontWeight: '700',
            }}
          >
            나란히 보기
          </Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
        >
          {error && <Text style={{ color: colors.danger }}>{error}</Text>}

          {!items && !error && (
            <ActivityIndicator color={colors.primary} style={styles.loading} />
          )}

          {items && (
            <>
              <Card style={styles.table}>
                {/* 종목 머리 — 누르면 개별 상세로 */}
                <View style={styles.row}>
                  {items.map(item => (
                    <Pressable
                      key={item.ticker}
                      style={styles.column}
                      onPress={() => setDetailTicker(item.ticker)}
                    >
                      <StockLogo
                        ticker={item.ticker}
                        name={item.name}
                        size={32}
                      />
                      <Text
                        style={[styles.name, { color: colors.textPrimary }]}
                        numberOfLines={2}
                      >
                        {item.name}
                      </Text>
                      <Text
                        style={[styles.meta, { color: colors.textTertiary }]}
                      >
                        {MARKET_LABELS[item.market]} · {item.ticker}
                      </Text>
                      {/* 섹터 미분류 종목은 이 줄을 생략한다 */}
                      {item.sector && (
                        <Text style={[styles.meta, { color: colors.indigo }]}>
                          {SECTOR_LABELS[item.sector]}
                        </Text>
                      )}
                    </Pressable>
                  ))}
                </View>

                <MetricRow label="현재가">
                  {items.map(item => (
                    <View key={item.ticker} style={styles.column}>
                      {item.quote ? (
                        <Text
                          style={[styles.value, { color: colors.textPrimary }]}
                        >
                          {formatPrice(item.quote)}
                        </Text>
                      ) : (
                        <Text
                          style={[styles.note, { color: colors.textTertiary }]}
                        >
                          시세를 못 불러왔어요
                        </Text>
                      )}
                    </View>
                  ))}
                </MetricRow>

                <MetricRow label="전일 대비">
                  {items.map(item => (
                    <View key={item.ticker} style={styles.column}>
                      {/* 등락 색·기호는 반드시 헬퍼로 (국내 관례: 상승 빨강 ▲) */}
                      <Text
                        style={[
                          styles.value,
                          {
                            color: item.quote
                              ? changeColor(item.quote.changePct, colors)
                              : colors.textTertiary,
                          },
                        ]}
                      >
                        {item.quote
                          ? `${changeMark(item.quote.changePct)} ${Math.abs(
                              item.quote.changePct,
                            ).toFixed(2)}%`
                          : '—'}
                      </Text>
                    </View>
                  ))}
                </MetricRow>

                <MetricRow label="추천 점수">
                  {items.map(item => (
                    <View key={item.ticker} style={styles.column}>
                      {item.score === null ? (
                        <Text
                          style={[styles.note, { color: colors.textTertiary }]}
                        >
                          지금은 추천 목록에 없어요
                        </Text>
                      ) : (
                        <Text
                          style={[styles.value, { color: colors.textPrimary }]}
                        >
                          {item.score}점
                        </Text>
                      )}
                    </View>
                  ))}
                </MetricRow>

                <MetricRow label="최근 7일 뉴스">
                  {items.map((item, index) => (
                    <View key={item.ticker} style={styles.column}>
                      <SentimentBars
                        sentiment={item.sentiment7d}
                        max={sentimentMax}
                        index={index}
                      />
                    </View>
                  ))}
                </MetricRow>
              </Card>

              <Text style={[styles.caption, { color: colors.textTertiary }]}>
                종목을 누르면 자세히 볼 수 있어요 · 마지막 거래일 종가
                기준이에요.
              </Text>
              <Text style={[styles.caption, { color: colors.textDisabled }]}>
                점수는 뉴스 분위기를 숫자로 바꾼 참고값이에요. 투자 판단과
                책임은 언제나 본인에게 있어요.
              </Text>
            </>
          )}
        </ScrollView>

        <StockDetailModal
          ticker={detailTicker}
          onClose={() => setDetailTicker(null)}
        />
      </View>
    </Modal>
  );
}

/** 비교 행 하나 — 라벨 한 줄 + 종목 수만큼의 열 */
function MetricRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.metric, { borderTopColor: colors.divider }]}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <View style={styles.row}>{children}</View>
    </View>
  );
}

/**
 * 7일 감성 막대 — 모션 표 M (scaleY 0→1, 400ms, 항목당 30ms stagger).
 * 호재/악재 막대는 8px 중립 갭을 두어 빨강·파랑이 붙어 진동하지 않게 한다.
 */
function SentimentBars({
  sentiment,
  max,
  index,
}: {
  sentiment: StockComparison['sentiment7d'];
  max: number;
  index: number;
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const grow = useSharedValue(0);
  const { positive, negative } = sentiment;

  useEffect(() => {
    grow.value = reduced
      ? 1
      : withDelay(
          index * 30,
          withTiming(1, {
            duration: 400,
            easing: Easing.out(Easing.cubic),
          }),
        );
  }, [grow, reduced, index, positive, negative]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scaleY: grow.value }],
  }));

  if (positive === 0 && negative === 0) {
    return (
      <Text style={[styles.note, { color: colors.textTertiary }]}>
        최근 7일 뉴스가 없었어요
      </Text>
    );
  }

  const height = (count: number) =>
    count === 0 ? 2 : Math.max(4, Math.round((count / max) * BAR_MAX_HEIGHT));

  return (
    <View style={styles.sentiment}>
      <View style={styles.barRow}>
        <Animated.View
          style={[
            styles.bar,
            { height: height(positive), backgroundColor: colors.up },
            animated,
          ]}
        />
        <Animated.View
          style={[
            styles.bar,
            { height: height(negative), backgroundColor: colors.down },
            animated,
          ]}
        />
      </View>
      {/* 색만으로 방향을 전달하지 않는다 — 호재/악재 글자를 항상 붙인다 */}
      <View style={styles.barLabelRow}>
        <Text style={[styles.note, { color: colors.up }]}>호재 {positive}</Text>
        <Text style={[styles.note, { color: colors.down }]}>
          악재 {negative}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  loading: { marginTop: spacing.xxl },
  table: { gap: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.sm },
  column: { flex: 1, gap: 4, alignItems: 'flex-start' },
  metric: {
    gap: spacing.sm,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 12, fontWeight: '600' },
  name: { fontSize: 14, fontWeight: '700' },
  meta: { fontSize: 11 },
  value: { fontSize: 15, fontWeight: '700' },
  note: { fontSize: 11, lineHeight: 16 },
  sentiment: { gap: 6 },
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    height: BAR_MAX_HEIGHT,
  },
  barLabelRow: { flexDirection: 'row', gap: spacing.sm },
  bar: { width: 12, borderRadius: 4, transformOrigin: 'bottom' },
  caption: { fontSize: 11, textAlign: 'center', lineHeight: 17 },
});
