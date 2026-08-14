import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { ChevronDown, ChevronUp, Moon } from 'lucide-react-native';
import type { NightBriefing } from '@daily-stocks/shared';
import { SECTOR_LABELS } from '@daily-stocks/shared';
import { StockLogo } from './StockLogo';
import { Card } from './ui';
import { useTheme } from '../theme/ThemeContext';
import { motion, spacing } from '../theme/tokens';

/**
 * 나이트 브리핑 카드 — KST 21:00~05:59 홈 최상단 슬롯.
 * 아침 BriefingCard 와 구조·톤은 같지만 밤에 보는 카드라 숫자를 최대한 걷어냈다.
 * 접힘: 3줄 요약만. 펼침: 감성 분포 + 내일 눈여겨볼 종목.
 */
export function NightBriefingCard({
  briefing,
  onPressWatch,
}: {
  briefing: NightBriefing;
  /** 종목 칩 탭 — 기존 상세 모달을 그대로 연다 */
  onPressWatch: (ticker: string) => void;
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [, month, day] = briefing.date.split('-');
  const summary = briefing.marketSummary;
  const Chevron = expanded ? ChevronUp : ChevronDown;

  return (
    <Card style={styles.card}>
      <Pressable
        onPress={() => setExpanded(v => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${Number(month)}월 ${Number(day)}일 밤 브리핑, ${
          expanded ? '접기' : '펼치기'
        }`}
        style={styles.summaryBlock}
      >
        <View style={styles.headerRow}>
          <Moon size={16} color={colors.primary} />
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {Number(month)}월 {Number(day)}일 밤 브리핑
          </Text>
          <View style={styles.spacer} />
          <Chevron size={16} color={colors.textTertiary} />
        </View>

        <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
          늦은 밤까지 수고가 많아요. 오늘 시장은 이랬어요.
        </Text>

        {briefing.lines.map(line => (
          <Text
            key={line}
            style={[styles.line, { color: colors.textSecondary }]}
          >
            {line}
          </Text>
        ))}
      </Pressable>

      {expanded && (
        <Animated.View
          entering={FadeIn.duration(
            reduced ? motion.duration.micro : motion.duration.fast,
          )}
          style={styles.details}
        >
          {summary.total > 0 && (
            <View style={styles.distribution}>
              {/* 호재·악재 사이 8px 중립 갭 — 빨강/파랑 인접 시 색 진동을 막는다 */}
              <View style={styles.barRow}>
                {summary.positive > 0 && (
                  <View
                    style={[
                      styles.bar,
                      { flex: summary.positive, backgroundColor: colors.up },
                    ]}
                  />
                )}
                {summary.negative > 0 && (
                  <View
                    style={[
                      styles.bar,
                      { flex: summary.negative, backgroundColor: colors.down },
                    ]}
                  />
                )}
                {summary.neutral > 0 && (
                  <View
                    style={[
                      styles.bar,
                      { flex: summary.neutral, backgroundColor: colors.flat },
                    ]}
                  />
                )}
              </View>
              <Text style={styles.legend}>
                <Text style={{ color: colors.up }}>
                  호재 {summary.positive}
                </Text>
                <Text style={{ color: colors.textTertiary }}> · </Text>
                <Text style={{ color: colors.down }}>
                  악재 {summary.negative}
                </Text>
                <Text style={{ color: colors.textTertiary }}> · </Text>
                <Text style={{ color: colors.flat }}>
                  중립 {summary.neutral}
                </Text>
              </Text>
            </View>
          )}

          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            내일 눈여겨볼 종목
          </Text>

          {briefing.watchlist.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textTertiary }]}>
              오늘은 특별히 눈에 띄는 종목이 없었어요. 푹 쉬어요!
            </Text>
          ) : (
            <View style={styles.picksRow}>
              {briefing.watchlist.map(item => (
                <Pressable
                  key={item.ticker}
                  onPress={() => onPressWatch(item.ticker)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.stockName} 자세히 보기`}
                  style={[styles.pick, { backgroundColor: colors.surface }]}
                >
                  <StockLogo
                    ticker={item.ticker}
                    name={item.stockName}
                    size={24}
                  />
                  <Text
                    numberOfLines={1}
                    style={[styles.pickName, { color: colors.textPrimary }]}
                  >
                    {item.stockName}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[styles.pickSector, { color: colors.textTertiary }]}
                  >
                    {SECTOR_LABELS[item.sector]}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </Animated.View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  summaryBlock: { gap: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  spacer: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700' },
  subtitle: { fontSize: 12 },
  line: { fontSize: 13, lineHeight: 21 },
  details: { gap: spacing.md },
  distribution: { gap: 6 },
  barRow: { flexDirection: 'row', gap: spacing.sm, height: 6 },
  bar: { height: 6, borderRadius: 3 },
  legend: { fontSize: 12, fontWeight: '600' },
  sectionLabel: { fontSize: 13, fontWeight: '700' },
  empty: { fontSize: 13, lineHeight: 19 },
  picksRow: { flexDirection: 'row', gap: spacing.sm },
  pick: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 3,
  },
  pickName: { fontSize: 12, fontWeight: '600' },
  pickSector: { fontSize: 10 },
});
