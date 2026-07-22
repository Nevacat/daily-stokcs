import React, { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RefreshCw, Star } from 'lucide-react-native';
import type {
  CollectRun,
  DailyBriefing,
  Market,
  Recommendation,
  Sector,
} from '@daily-stocks/shared';
import { MARKET_LABELS, SECTOR_LABELS, SECTORS } from '@daily-stocks/shared';
import { api, formatKst } from '../api/client';
import { BriefingCard } from '../components/BriefingCard';
import { Button, Card, Chip, ScorePill } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';
import { spacing } from '../theme/tokens';
import { RecommendationDetailModal } from './RecommendationDetailModal';

function RecommendationCard({
  rec,
  favorite,
  onPress,
  onToggleFavorite,
}: {
  rec: Recommendation;
  favorite: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Card onPress={onPress}>
      <View style={styles.rowBetween}>
        <View style={styles.cardBody}>
          <View style={styles.row}>
            <Text style={[styles.stockName, { color: colors.textPrimary }]}>
              {rec.stockName}
            </Text>
            <Text style={[styles.ticker, { color: colors.textDisabled }]}>
              {rec.ticker}
            </Text>
            <Pressable onPress={onToggleFavorite} hitSlop={10}>
              <Star
                size={17}
                color={favorite ? colors.warning : colors.textDisabled}
                fill={favorite ? colors.warning : 'transparent'}
              />
            </Pressable>
          </View>
          <Text style={[styles.sectorLine, { color: colors.indigo }]}>
            {SECTOR_LABELS[rec.sector]} · 근거 뉴스 {rec.newsIds.length}건
          </Text>
          <Text
            style={[styles.reason, { color: colors.textSecondary }]}
            numberOfLines={2}
          >
            {rec.reason}
          </Text>
        </View>
        <ScorePill score={rec.score} />
      </View>
    </Card>
  );
}

export function HomeScreen() {
  const { colors } = useTheme();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [favoriteTickers, setFavoriteTickers] = useState<string[]>([]);
  const [sector, setSector] = useState<Sector | null>(null);
  const [market, setMarket] = useState<Market | null>(null);
  const [lastRun, setLastRun] = useState<CollectRun | undefined>();
  const [nextCollectAt, setNextCollectAt] = useState<string | undefined>();
  const [collecting, setCollecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [recs, status, favorites, brief] = await Promise.all([
        api.recommendations(),
        api.collectStatus(),
        api.favorites(),
        api.briefing(),
      ]);
      setRecommendations(recs.data);
      setLastRun(status.data.lastRun);
      setNextCollectAt(status.meta?.nextCollectAt);
      setFavoriteTickers(favorites.data.tickers);
      setBriefing(brief.data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '서버에 연결할 수 없습니다.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onCollect = async () => {
    setCollecting(true);
    try {
      await api.collect();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '수집에 실패했습니다.');
    } finally {
      setCollecting(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggleFavorite = async (ticker: string) => {
    // 낙관적 업데이트 후 실패 시 되돌림
    const prev = favoriteTickers;
    setFavoriteTickers(
      prev.includes(ticker) ? prev.filter(t => t !== ticker) : [...prev, ticker],
    );
    try {
      const res = await api.toggleFavorite(ticker);
      setFavoriteTickers(res.data.tickers);
    } catch {
      setFavoriteTickers(prev);
    }
  };

  // 시장 필터 — 구버전 데이터는 market이 없을 수 있어 KR로 간주
  const byMarket = recommendations.filter(
    r => market === null || (r.market ?? 'KR') === market,
  );
  const favoriteRecs = byMarket.filter(r => favoriteTickers.includes(r.ticker));
  const listRecs = (
    sector ? byMarket.filter(r => r.sector === sector) : byMarket
  ).filter(r => sector !== null || !favoriteTickers.includes(r.ticker));

  const renderCard = (rec: Recommendation) => (
    <RecommendationCard
      key={rec.id}
      rec={rec}
      favorite={favoriteTickers.includes(rec.ticker)}
      onPress={() => setDetailId(rec.id)}
      onToggleFavorite={() => void toggleFavorite(rec.ticker)}
    />
  );

  return (
    <View style={styles.flex}>
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
        {/* 헤더: 로고 + 서비스명 */}
        <View style={styles.header}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              DeTok
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              뉴스를 읽는 가장 스마트한 방법
            </Text>
          </View>
        </View>

        {/* 데일리 브리핑 (기획서 §3.4) */}
        {briefing && briefing.marketSummary.total > 0 && (
          <BriefingCard briefing={briefing} onPressPick={setDetailId} />
        )}

        {/* 수집 상태 카드 (기획서 §2.1) */}
        <Card>
          <View style={styles.rowBetween}>
            <View style={styles.statusText}>
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                마지막 수집 {formatKst(lastRun?.finishedAt)}
              </Text>
              <Text style={[styles.metaText, { color: colors.textDisabled }]}>
                다음 자동 수집 {formatKst(nextCollectAt)}
              </Text>
            </View>
            <Button
              title="지금 수집하기"
              onPress={() => void onCollect()}
              loading={collecting}
              icon={<RefreshCw size={16} color="#FFFFFF" />}
            />
          </View>
        </Card>

        {error && (
          <Card>
            <Text style={[styles.errorText, { color: colors.danger }]}>
              {error}
            </Text>
          </Card>
        )}

        {/* 관심 종목 추천 — 상단 고정 (기획서 §3.1) */}
        {sector === null && favoriteRecs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Star size={15} color={colors.warning} fill={colors.warning} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                관심 종목
              </Text>
            </View>
            {favoriteRecs.map(renderCard)}
          </View>
        )}

        {/* 시장 필터 (국내/미국) */}
        <View style={styles.marketRow}>
          <Chip label="전체 시장" active={market === null} onPress={() => setMarket(null)} />
          {(['KR', 'US'] as const).map(m => (
            <Chip
              key={m}
              label={MARKET_LABELS[m]}
              active={market === m}
              onPress={() => setMarket(market === m ? null : m)}
            />
          ))}
        </View>

        {/* 섹터 탭 (기획서 §2.2) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Chip label="전체" active={sector === null} onPress={() => setSector(null)} />
          {SECTORS.map(s => (
            <Chip
              key={s}
              label={SECTOR_LABELS[s]}
              active={sector === s}
              onPress={() => setSector(s)}
            />
          ))}
        </ScrollView>

        {/* 추천 카드 리스트 — 섹터 선택 시 해당 섹터가 비어도 안내 문구 표시 */}
        {listRecs.length === 0 && (sector !== null || favoriteRecs.length === 0) ? (
          <Card>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {sector !== null
                ? `${SECTOR_LABELS[sector]} 섹터의 추천이 아직 없습니다.`
                : '아직 추천이 없습니다. 지금 수집하기를 눌러 최신 뉴스를 분석해보세요.'}
            </Text>
          </Card>
        ) : (
          listRecs.map(renderCard)
        )}

        <Text style={[styles.disclaimer, { color: colors.textDisabled }]}>
          본 정보는 투자 참고용이며, 투자 판단의 책임은 이용자에게 있습니다.
        </Text>
      </ScrollView>

      <RecommendationDetailModal
        recommendationId={detailId}
        onClose={() => setDetailId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: { width: 44, height: 44, borderRadius: 12 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardBody: { flex: 1, gap: 4 },
  statusText: { gap: 2 },
  stockName: { fontSize: 17, fontWeight: '700' },
  ticker: { fontSize: 12 },
  sectorLine: { fontSize: 12, fontWeight: '600' },
  reason: { fontSize: 13, lineHeight: 19 },
  metaText: { fontSize: 12 },
  errorText: { fontSize: 13 },
  emptyText: { fontSize: 14 },
  section: { gap: spacing.md },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 4,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  chipRow: { gap: spacing.sm },
  marketRow: { flexDirection: 'row', gap: spacing.sm },
  disclaimer: { fontSize: 11, textAlign: 'center', marginTop: spacing.md },
});
