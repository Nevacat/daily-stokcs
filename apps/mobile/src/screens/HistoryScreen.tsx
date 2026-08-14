import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CalendarDays } from 'lucide-react-native';
import type { HistoryEntry } from '@daily-stocks/shared';
import { SECTOR_LABELS, SECTORS } from '@daily-stocks/shared';
import { api } from '../api/client';
import { ErrorCard } from '../components/ErrorCard';
import { SkeletonCard } from '../components/Skeleton';
import { ScoreRing } from '../components/ScoreRing';
import { Card } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';
import {
  changeColor,
  changeMark,
  sectorChartColor,
  spacing,
} from '../theme/tokens';
import { StockDetailModal } from './StockDetailModal';

function formatDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
}

/** 날짜별 과거 추천 (기획서 §3.3). 적중률은 주가 API 연동 후 제공 예정. */
export function HistoryScreen() {
  const { colors } = useTheme();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.history();
      setEntries(res.data);
      setError(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : '히스토리를 불러오지 못했어요.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {error && (
        <ErrorCard
          message={error}
          onRetry={() => {
            setLoading(true);
            void load();
          }}
        />
      )}

      {loading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : entries.length === 0 && !error ? (
        <Card>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            아직 기록된 추천이 없어요. 수집이 실행되면 날짜별로 차곡차곡 쌓여요.
          </Text>
        </Card>
      ) : (
        entries.map(entry => (
          <View key={entry.date} style={styles.section}>
            <View style={styles.sectionHeader}>
              <CalendarDays size={15} color={colors.indigo} />
              <Text
                style={[styles.sectionTitle, { color: colors.textPrimary }]}
              >
                {formatDate(entry.date)}
              </Text>
              <Text style={[styles.count, { color: colors.textDisabled }]}>
                {entry.recommendations.length}종목
              </Text>
            </View>
            <Card style={styles.entryCard}>
              {entry.recommendations.map((rec, index) => (
                <Pressable
                  key={rec.id}
                  onPress={() => setSelectedTicker(rec.ticker)}
                  style={[
                    styles.recRow,
                    index > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.recInfo}>
                    <Text
                      style={[styles.stockName, { color: colors.textPrimary }]}
                    >
                      {rec.stockName}
                    </Text>
                    {/* 홈 카드의 섹터 배지와 같은 색 체계 — 섹터마다 다른 색이어야
                        두 화면에서 같은 섹터가 같은 색으로 읽힌다 */}
                    <Text
                      style={[
                        styles.sectorText,
                        {
                          color: sectorChartColor(
                            SECTORS.indexOf(rec.sector),
                            colors,
                          ),
                        },
                      ]}
                    >
                      {SECTOR_LABELS[rec.sector]}
                    </Text>
                  </View>
                  <View style={styles.recRight}>
                    {/* 등락률 — 주가 API 키(KIS) 설정 시에만 내려옴 */}
                    {/* 여기만 미국식(상승=초록)이라 앱 안에서 의미가 뒤집혀 있었다.
                        changeColor/changeMark 로 국내 관례(상승=빨강 ▲)에 맞춘다. */}
                    {rec.changePct != null && (
                      <Text
                        style={[
                          styles.changePct,
                          { color: changeColor(rec.changePct, colors) },
                        ]}
                      >
                        {changeMark(rec.changePct)}{' '}
                        {Math.abs(rec.changePct).toFixed(2)}%
                      </Text>
                    )}
                    <ScoreRing score={rec.score} />
                  </View>
                </Pressable>
              ))}
            </Card>
          </View>
        ))
      )}

      <Text style={[styles.note, { color: colors.textDisabled }]}>
        등락률(적중률)은 추천 당시 주가가 기록된 날부터 보여드려요.
      </Text>

      <StockDetailModal
        ticker={selectedTicker}
        onClose={() => setSelectedTicker(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // 제목은 기록 탭(RecordsScreen) 헤더가 담당한다
  content: { padding: spacing.xl, paddingTop: spacing.md, gap: spacing.lg },
  section: { gap: spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 4,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  count: { fontSize: 12 },
  entryCard: { paddingVertical: 4 },
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  recInfo: { gap: 2 },
  recRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  changePct: { fontSize: 13, fontWeight: '700' },
  stockName: { fontSize: 15, fontWeight: '600' },
  sectorText: { fontSize: 12, fontWeight: '600' },
  errorText: { fontSize: 13 },
  emptyText: { fontSize: 14 },
  note: { fontSize: 11, textAlign: 'center', marginTop: spacing.sm },
});
