import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import type { DailyBriefing } from '@daily-stocks/shared';
import { SECTOR_LABELS } from '@daily-stocks/shared';
import { StockLogo } from './StockLogo';
import { Card } from './ui';
import { useTheme } from '../theme/ThemeContext';
import { spacing } from '../theme/tokens';

/** 데일리 브리핑 카드 (기획서 §3.4) — 홈 최상단 */
export function BriefingCard({
  briefing,
  onPressPick,
}: {
  briefing: DailyBriefing;
  onPressPick: (id: string) => void;
}) {
  const { colors } = useTheme();
  const { marketSummary: summary, topSectors, topPicks } = briefing;
  const [, month, day] = briefing.date.split('-');

  return (
    <Card style={styles.card} selected>
      <View style={styles.headerRow}>
        <Sparkles size={16} color={colors.primary} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {Number(month)}월 {Number(day)}일 브리핑
        </Text>
      </View>

      <Text style={[styles.summary, { color: colors.textSecondary }]}>
        오늘 뉴스 {summary.total}건 —{' '}
        <Text style={{ color: colors.success }}>호재 {summary.positive}</Text> ·{' '}
        <Text style={{ color: colors.danger }}>악재 {summary.negative}</Text> ·
        중립 {summary.neutral}
      </Text>

      {topSectors.length > 0 && (
        <Text style={[styles.sectors, { color: colors.indigo }]}>
          주목 섹터{' '}
          {topSectors
            .map(s => `${SECTOR_LABELS[s.sector]}(+${s.positiveCount})`)
            .join(' · ')}
        </Text>
      )}

      {topPicks.length > 0 && (
        <View style={styles.picksRow}>
          {topPicks.map(pick => (
            <Pressable
              key={pick.id}
              onPress={() => onPressPick(pick.id)}
              style={[styles.pick, { backgroundColor: colors.card }]}
            >
              <StockLogo ticker={pick.ticker} name={pick.stockName} size={24} />
              <Text style={[styles.pickName, { color: colors.textPrimary }]}>
                {pick.stockName}
              </Text>
              <Text style={[styles.pickScore, { color: colors.primary }]}>
                {pick.score}점
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 15, fontWeight: '700' },
  summary: { fontSize: 13, lineHeight: 19 },
  sectors: { fontSize: 12, fontWeight: '600' },
  picksRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 2 },
  pick: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  pickName: { fontSize: 12, fontWeight: '600' },
  pickScore: { fontSize: 13, fontWeight: '800' },
});
