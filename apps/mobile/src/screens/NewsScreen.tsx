import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NewsItem, Sector, Sentiment } from '@daily-stocks/shared';
import { SECTOR_LABELS, SECTORS } from '@daily-stocks/shared';
import { api, formatKst } from '../api/client';
import { Button, Card, Chip, SentimentBadge } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';
import { spacing } from '../theme/tokens';

const SENTIMENT_FILTERS: { value: Sentiment; label: string }[] = [
  { value: 'positive', label: '호재' },
  { value: 'negative', label: '악재' },
  { value: 'neutral', label: '중립' },
];

/** 뉴스 리스트 + 섹터/감성 필터 (기획서 §2.4) */
export function NewsScreen() {
  const { colors } = useTheme();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [sector, setSector] = useState<Sector | null>(null);
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.news({
        sector: sector ?? undefined,
        sentiment: sentiment ?? undefined,
      });
      setItems(res.data);
      setCursor(res.meta?.cursor);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '뉴스를 불러오지 못했습니다.');
    }
  }, [sector, sentiment]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await api.news({
        sector: sector ?? undefined,
        sentiment: sentiment ?? undefined,
        cursor,
      });
      setItems(prev => [...prev, ...res.data]);
      setCursor(res.meta?.cursor);
    } catch {
      // 다음 페이지 실패는 조용히 무시 (기존 목록 유지)
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xl, gap: spacing.md }}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>뉴스</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm }}
        >
          <Chip label="전체" active={sector === null} onPress={() => setSector(null)} />
          {SECTORS.map(s => (
            <Chip
              key={s}
              label={SECTOR_LABELS[s]}
              active={sector === s}
              onPress={() => setSector(sector === s ? null : s)}
            />
          ))}
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {SENTIMENT_FILTERS.map(f => (
            <Chip
              key={f.value}
              label={f.label}
              active={sentiment === f.value}
              onPress={() => setSentiment(sentiment === f.value ? null : f.value)}
            />
          ))}
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <Card>
            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
              {error ?? '표시할 뉴스가 없습니다. 홈에서 수집을 실행해보세요.'}
            </Text>
          </Card>
        }
        ListFooterComponent={
          cursor ? (
            <Button
              title="더 보기"
              variant="secondary"
              loading={loadingMore}
              onPress={() => void loadMore()}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <Card onPress={() => void Linking.openURL(item.url)} style={{ gap: 6 }}>
            <View style={styles.badgeRow}>
              <SentimentBadge sentiment={item.sentiment} />
              {item.sectors.slice(0, 2).map(s => (
                <Text key={s} style={{ color: colors.indigo, fontSize: 11, fontWeight: '600' }}>
                  #{SECTOR_LABELS[s]}
                </Text>
              ))}
            </View>
            <Text
              style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600', lineHeight: 20 }}
            >
              {item.title}
            </Text>
            <Text style={{ color: colors.textDisabled, fontSize: 11 }}>
              {item.press} · {formatKst(item.publishedAt)}
            </Text>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '800' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
