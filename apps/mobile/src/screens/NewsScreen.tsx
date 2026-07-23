import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NewsItem, Sector, Sentiment } from '@daily-stocks/shared';
import { SECTOR_LABELS, SECTORS, STOCKS } from '@daily-stocks/shared';
import { api, formatKst, openExternalUrl } from '../api/client';
import { ErrorCard } from '../components/ErrorCard';
import { SkeletonCard } from '../components/Skeleton';
import { Button, Card, Chip, SentimentBadge } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';
import { spacing } from '../theme/tokens';
import { SECTOR_ICONS } from '../components/sectorIcons';
import { StockDetailModal } from './StockDetailModal';

const STOCK_NAMES = new Map(STOCKS.map(s => [s.ticker, s.name]));

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  // 필터 변경 후 도착한 이전 요청 응답을 무시하기 위한 시퀀스 토큰
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setCursor(undefined); // 이전 필터의 커서로 loadMore가 나가는 것을 즉시 차단
    try {
      const res = await api.news({
        sector: sector ?? undefined,
        sentiment: sentiment ?? undefined,
      });
      if (seq !== requestSeq.current) return; // 이미 다른 필터로 재요청됨
      setItems(res.data);
      setCursor(res.meta?.cursor);
      setError(null);
    } catch (e) {
      if (seq !== requestSeq.current) return;
      setError(e instanceof Error ? e.message : '뉴스를 불러오지 못했어요.');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [sector, sentiment]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    const seq = requestSeq.current;
    setLoadingMore(true);
    try {
      const res = await api.news({
        sector: sector ?? undefined,
        sentiment: sentiment ?? undefined,
        cursor,
      });
      if (seq !== requestSeq.current) return; // 필터가 바뀐 뒤 도착한 응답은 버림
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
              Icon={SECTOR_ICONS[s]}
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
          loading ? (
            <View style={styles.skeletons}>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : error ? (
            <ErrorCard
              message={error}
              onRetry={() => {
                setLoading(true);
                void load();
              }}
            />
          ) : (
            <Card>
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                아직 보여드릴 뉴스가 없어요. 홈에서 수집을 실행해볼까요?
              </Text>
            </Card>
          )
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
          <Card onPress={() => openExternalUrl(item.url)} style={{ gap: 6 }}>
            <View style={styles.badgeRow}>
              <SentimentBadge sentiment={item.sentiment} />
              {item.sectors.slice(0, 2).map(s => (
                <Text key={s} style={{ color: colors.indigo, fontSize: 11, fontWeight: '600' }}>
                  #{SECTOR_LABELS[s]}
                </Text>
              ))}
              {/* 종목 태그 — 탭하면 종목 상세로 이동 */}
              {item.tickers.slice(0, 2).map(ticker => (
                <Pressable
                  key={ticker}
                  onPress={() => setSelectedTicker(ticker)}
                  hitSlop={6}
                >
                  <Text
                    style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}
                  >
                    ${STOCK_NAMES.get(ticker) ?? ticker}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.newsBody}>
              <View style={styles.newsTextCol}>
                <Text
                  style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600', lineHeight: 20 }}
                >
                  {item.title}
                </Text>
                <Text style={{ color: colors.textDisabled, fontSize: 11 }}>
                  {item.press} · {formatKst(item.publishedAt)}
                </Text>
              </View>
              {item.imageUrl && (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={[styles.thumbnail, { backgroundColor: colors.surface }]}
                />
              )}
            </View>
          </Card>
        )}
      />

      <StockDetailModal
        ticker={selectedTicker}
        onClose={() => setSelectedTicker(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '800' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  skeletons: { gap: spacing.md },
  newsBody: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  newsTextCol: { flex: 1, gap: 6 },
  thumbnail: { width: 64, height: 64, borderRadius: 12 },
});
