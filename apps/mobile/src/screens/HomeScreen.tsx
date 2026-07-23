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
import { RefreshCw, Search, Star } from 'lucide-react-native';
import type {
  CollectRun,
  DailyBriefing,
  Market,
  Recommendation,
  Sector,
  StockQuote,
} from '@daily-stocks/shared';
import { MARKET_LABELS, SECTOR_LABELS, SECTORS } from '@daily-stocks/shared';
import { api, formatKst } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { BriefingCard } from '../components/BriefingCard';
import { StockLogo } from '../components/StockLogo';
import { SECTOR_ICONS } from '../components/sectorIcons';
import { ErrorCard } from '../components/ErrorCard';
import { SkeletonCard } from '../components/Skeleton';
import { Button, Card, Chip, QuoteLine, ScorePill } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';
import { spacing } from '../theme/tokens';
import { RecommendationDetailModal } from './RecommendationDetailModal';
import { StockSearchModal } from './StockSearchModal';

function RecommendationCard({
  rec,
  quote,
  favorite,
  onPress,
  onToggleFavorite,
}: {
  rec: Recommendation;
  quote: StockQuote | null;
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
            <StockLogo ticker={rec.ticker} name={rec.stockName} size={28} />
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
          {quote && <QuoteLine quote={quote} />}
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

/** 시간대별 인사말 (뉴닉·토스 톤) */
function greeting(nickname?: string): string {
  const hour = Number(
    new Date().toLocaleString('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'Asia/Seoul',
    }),
  );
  const message =
    hour < 6
      ? '늦은 밤까지 수고가 많아요'
      : hour < 12
        ? '좋은 아침이에요'
        : hour < 18
          ? '좋은 오후예요'
          : '편안한 저녁이에요';
  return nickname ? `${nickname}님, ${message} 👋` : `${message} 👋`;
}

export function HomeScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [quotes, setQuotes] = useState<Record<string, StockQuote | null>>({});
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [favoriteTickers, setFavoriteTickers] = useState<string[]>([]);
  const [sector, setSector] = useState<Sector | null>(null);
  const [market, setMarket] = useState<Market | null>(null);
  const [lastRun, setLastRun] = useState<CollectRun | undefined>();
  const [nextCollectAt, setNextCollectAt] = useState<string | undefined>();
  const [collecting, setCollecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

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
      // 시세는 부가 정보 — 실패해도 추천 표시에는 영향 없음
      if (recs.data.length > 0) {
        api
          .quotes(recs.data.map(r => r.ticker))
          .then(q => setQuotes(q.data))
          .catch(() => {});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '서버에 연결하지 못했어요.');
    } finally {
      setLoading(false);
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
      setError(e instanceof Error ? e.message : '수집에 실패했어요. 잠시 후 다시 시도해주세요.');
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
      quote={quotes[rec.ticker] ?? null}
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
              {greeting(user ? user.nickname : undefined)}
            </Text>
          </View>
          <View style={styles.headerSpacer} />
          <Pressable
            onPress={() => setSearchOpen(true)}
            hitSlop={10}
            style={[styles.searchButton, { backgroundColor: colors.surface }]}
          >
            <Search size={19} color={colors.textSecondary} />
          </Pressable>
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
          <ErrorCard
            message={error}
            onRetry={() => {
              setLoading(true);
              void load();
            }}
          />
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
              Icon={SECTOR_ICONS[s]}
            />
          ))}
        </ScrollView>

        {/* 추천 카드 리스트 — 섹터 선택 시 해당 섹터가 비어도 안내 문구 표시 */}
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : listRecs.length === 0 &&
          !error &&
          (sector !== null || favoriteRecs.length === 0) ? (
          <Card>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {sector !== null
                ? `${SECTOR_LABELS[sector]} 섹터엔 아직 추천이 없어요. 다음 수집을 기다려주세요!`
                : "아직 추천이 없어요. '지금 수집하기'를 눌러 최신 뉴스를 분석해볼까요?"}
            </Text>
          </Card>
        ) : (
          listRecs.map(renderCard)
        )}

        <Text style={[styles.disclaimer, { color: colors.textDisabled }]}>
          DeTok은 참고 정보만 제공해요. 투자 판단과 책임은 언제나 본인에게 있어요.
        </Text>
      </ScrollView>

      <RecommendationDetailModal
        recommendationId={detailId}
        onClose={() => setDetailId(null)}
      />

      <StockSearchModal visible={searchOpen} onClose={() => setSearchOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerSpacer: { flex: 1 },
  searchButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 44, height: 44, borderRadius: 22 },
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
