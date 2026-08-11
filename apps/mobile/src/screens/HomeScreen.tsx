import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Info, RefreshCw, Search, Star } from 'lucide-react-native';
import type {
  CollectRun,
  DailyBriefing,
  Market,
  NightBriefing,
  Recommendation,
  Sector,
  StockQuote,
} from '@daily-stocks/shared';
import { MARKET_LABELS, SECTOR_LABELS, SECTORS } from '@daily-stocks/shared';
import { api, formatKst } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { AuroraBackground } from '../components/AuroraBackground';
import { BriefingCard } from '../components/BriefingCard';
import { NightBriefingCard } from '../components/NightBriefingCard';
import { StockLogo } from '../components/StockLogo';
import { SECTOR_ICONS } from '../components/sectorIcons';
import { ErrorCard } from '../components/ErrorCard';
import { ScoreRing } from '../components/ScoreRing';
import { SkeletonCard } from '../components/Skeleton';
import { TiltCard, TILT_PAD } from '../components/TiltCard';
import { Stagger, useMotionReduced } from '../components/motion';
import { Card, Chip } from '../components/ui';
import { kstHour, useTheme } from '../theme/ThemeContext';
import { changeColor, changeMark, radius, spacing } from '../theme/tokens';
import { RecommendationDetailModal } from './RecommendationDetailModal';
import { StockSearchModal } from './StockSearchModal';

/** 홈 상단 섹터 칩 노출 개수 (전체 칩 제외). 나머지는 '더보기' 시트로 */
const VISIBLE_SECTORS = 3;
/** 진입 애니메이션을 적용할 상한 — 스크롤로 드러나는 카드는 최종 상태로 그린다 */
const ANIMATED_ITEMS = 8;
/**
 * 틸트 카드 판 높이 (고정).
 * ponytail: 내용이 로고 1줄 + 이유 1줄(numberOfLines=1)로 잠겨 있어 고정으로 충분하다.
 *           접근성 글꼴 확대에서 넘치면 onLayout 으로 재는 방식으로 올린다.
 */
const TILT_CARD_HEIGHT = 88;

const DISCLAIMER =
  'DeTok은 참고 정보만 제공해요. 투자 판단과 책임은 언제나 본인에게 있어요.';

/** 나이트 브리핑 구간 (KST 21:00~05:59) — 기획자 스펙 §2 */
const isNightHour = (hour: number): boolean => hour >= 21 || hour < 6;

/**
 * 관심 목록에서 **티커 하나의 포함 여부만** 바꾼다.
 *
 * 낙관적 업데이트의 롤백을 "토글 직전 스냅샷으로 통째 되돌리기"로 하면
 * 그 사이 성공한 다른 종목의 토글까지 같이 지워진다. 응답이 뒤바뀌어 도착할 때도 마찬가지다.
 * 그래서 성공·실패 어느 쪽이든 건드린 티커 하나만 반영한다.
 */
export function withFavorite(
  list: string[],
  ticker: string,
  on: boolean,
): string[] {
  if (!on) return list.filter(t => t !== ticker);
  return list.includes(ticker) ? list : [...list, ticker];
}

/** 홈 최상단 브리핑 슬롯 — 시간대로 카드를 교체한다 */
type BriefingSlot =
  { kind: 'day'; data: DailyBriefing } | { kind: 'night'; data: NightBriefing };

/** 시간대별 인사말 (뉴닉·토스 톤) */
function greeting(nickname?: string): string {
  const hour = kstHour(new Date());
  const message =
    hour < 6
      ? '늦은 밤까지 수고가 많아요'
      : hour < 12
        ? '좋은 아침이에요'
        : hour < 18
          ? '좋은 오후예요'
          : '편안한 저녁이에요';
  return nickname ? `${nickname}님, ${message}` : message;
}

/** 등락률 한 줄 — 색만으로 방향을 전달하지 않는다 (▲▼ + 부호 병기) */
function ChangeText({ pct, size = 13 }: { pct: number; size?: number }) {
  const { colors } = useTheme();
  return (
    <Text
      style={[
        styles.change,
        { color: changeColor(pct, colors), fontSize: size },
      ]}
    >
      {changeMark(pct)} {Math.abs(pct).toFixed(2)}%
    </Text>
  );
}

function IconButton({
  label,
  onPress,
  children,
}: React.PropsWithChildren<{ label: string; onPress: () => void }>) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.iconButton, { backgroundColor: colors.surface }]}
    >
      {children}
    </Pressable>
  );
}

/** 수집 버튼 — 수집 중에는 아이콘이 회전한다 (reduce motion 이면 스피너) */
function CollectButton({
  collecting,
  onPress,
}: {
  collecting: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const reduced = useMotionReduced();
  const spin = useSharedValue(0);

  useEffect(() => {
    if (collecting && !reduced) {
      spin.value = withRepeat(
        withTiming(1, { duration: 1000, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      cancelAnimation(spin);
      spin.value = 0;
    }
    return () => cancelAnimation(spin);
  }, [collecting, reduced, spin]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  return (
    <Pressable
      onPress={onPress}
      disabled={collecting}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="지금 수집하기"
      accessibilityState={{ busy: collecting }}
      style={[styles.iconButton, { backgroundColor: colors.surface }]}
    >
      {collecting && reduced ? (
        <ActivityIndicator size="small" color={colors.textSecondary} />
      ) : (
        <Animated.View style={spinStyle}>
          <RefreshCw size={18} color={colors.textSecondary} />
        </Animated.View>
      )}
    </Pressable>
  );
}

/** 시장 세그먼트 — '전체'는 아무것도 고르지 않은 상태로 흡수했다 */
function MarketSegment({
  market,
  onChange,
}: {
  market: Market | null;
  onChange: (next: Market | null) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: colors.surface }]}>
      {(['KR', 'US'] as const).map(m => {
        const active = market === m;
        return (
          <Pressable
            key={m}
            onPress={() => onChange(active ? null : m)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[
              styles.segmentCell,
              active && { backgroundColor: colors.primarySoft },
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                {
                  fontWeight: active ? '700' : '500',
                  color: active ? colors.primary : colors.textTertiary,
                },
              ]}
            >
              {MARKET_LABELS[m]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 섹터 8개 전체 — 홈에서 접어둔 나머지를 여기서 고른다 */
function SectorSheet({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: Sector | null;
  onSelect: (sector: Sector | null) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={[styles.sheetBackdrop, { backgroundColor: colors.scrim }]}
        onPress={onClose}
        accessibilityLabel="닫기"
      >
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={() => {}}
        >
          <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
            어떤 분야를 볼까요?
          </Text>
          <View style={styles.sheetChips}>
            <Chip
              label="전체"
              active={selected === null}
              onPress={() => onSelect(null)}
            />
            {SECTORS.map(s => (
              <Chip
                key={s}
                label={SECTOR_LABELS[s]}
                active={selected === s}
                onPress={() => onSelect(s)}
                Icon={SECTOR_ICONS[s]}
              />
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface CardProps {
  rec: Recommendation;
  quote: StockQuote | null;
  favorite: boolean;
  onPress: (id: string) => void;
  onToggleFavorite: (ticker: string) => void;
  /** 1순위 카드만 3D 틸트 판 위에 올린다. 폭은 호출부가 재준다 */
  tiltWidth?: number;
}

/** 표면에 남긴 4개: 로고+종목명 / 등락률 / 점수 링 / 이유 1줄 */
function CardContent({
  rec,
  quote,
  favorite,
  onToggleFavorite,
}: Omit<CardProps, 'onPress' | 'tiltWidth'>) {
  const { colors } = useTheme();
  return (
    <View style={styles.rowBetween}>
      <View style={styles.cardBody}>
        <View style={styles.row}>
          <StockLogo ticker={rec.ticker} name={rec.stockName} size={28} />
          <Text
            numberOfLines={1}
            style={[styles.stockName, { color: colors.textPrimary }]}
          >
            {rec.stockName}
          </Text>
          {quote && <ChangeText pct={quote.changePct} />}
          <Pressable
            onPress={() => onToggleFavorite(rec.ticker)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`${rec.stockName} 관심 종목 ${
              favorite ? '해제' : '담기'
            }`}
          >
            <Star
              size={17}
              color={favorite ? colors.warning : colors.textDisabled}
              fill={favorite ? colors.warning : 'transparent'}
            />
          </Pressable>
        </View>
        <Text
          numberOfLines={1}
          style={[styles.reason, { color: colors.textSecondary }]}
        >
          {rec.reason}
        </Text>
      </View>
      <ScoreRing score={rec.score} />
    </View>
  );
}

/**
 * 추천 카드 — 티커·섹터·근거 뉴스 수는 상세 모달로 내렸다.
 * `tiltWidth` 가 오면 3D 틸트 판(모션 표 D) 위에 올린다.
 */
/**
 * memo 비교자 — 시세 갱신이 리스트 전체를 다시 그리지 않게 한다.
 *
 * id 는 서버에서 티커로 고정된다(recommendation.service). 즉 수집이 다시 돌아도 id 는 그대로라
 * `reason` 을 빼면 점수가 같고 이유 문장만 바뀐 카드가 옛 문장을 계속 들고 있게 된다.
 */
export const isSameCard = (a: CardProps, b: CardProps): boolean =>
  a.rec.id === b.rec.id &&
  a.rec.score === b.rec.score &&
  a.rec.reason === b.rec.reason &&
  a.quote?.changePct === b.quote?.changePct &&
  a.favorite === b.favorite &&
  a.tiltWidth === b.tiltWidth;

const RecommendationCard = React.memo(function RecommendationCardView({
  tiltWidth,
  onPress,
  ...rest
}: CardProps) {
  if (tiltWidth === undefined) {
    return (
      <Card onPress={() => onPress(rest.rec.id)}>
        <CardContent {...rest} />
      </Card>
    );
  }
  // TiltCard 는 사방 TILT_PAD 만큼 투명 여백을 갖는다 — 음수 마진으로 다른 카드와 좌우를 맞춘다
  return (
    <View style={styles.tiltWrap}>
      <TiltCard width={tiltWidth} height={TILT_CARD_HEIGHT}>
        <Pressable
          style={styles.flex}
          onPress={() => onPress(rest.rec.id)}
          accessibilityRole="button"
          accessibilityLabel={`${rest.rec.stockName} 자세히 보기`}
        >
          <CardContent {...rest} />
        </Pressable>
      </TiltCard>
    </View>
  );
}, isSameCard);

export function HomeScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [quotes, setQuotes] = useState<Record<string, StockQuote | null>>({});
  const [slot, setSlot] = useState<BriefingSlot | null>(null);
  const [favoriteTickers, setFavoriteTickers] = useState<string[]>([]);
  const [favoriteSectors, setFavoriteSectors] = useState<Sector[]>([]);
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
  const [sectorSheetOpen, setSectorSheetOpen] = useState(false);

  // 낙관적 업데이트가 항상 최신 관심 목록을 보게 한다 (메모된 카드의 stale closure 방지)
  const favoritesRef = useRef<string[]>([]);
  favoritesRef.current = favoriteTickers;

  const load = useCallback(async () => {
    // 브리핑은 부가 정보 — 실패해도 카드만 빠지고 홈은 정상 동작한다
    const night = isNightHour(kstHour(new Date()));
    const briefingPromise: Promise<BriefingSlot | null> = night
      ? api
          .nightBriefing()
          .then(r => ({ kind: 'night', data: r.data }) as BriefingSlot)
          .catch(() => null)
      : api
          .briefing()
          .then(r => ({ kind: 'day', data: r.data }) as BriefingSlot)
          .catch(() => null);

    try {
      const [recs, status, favorites, briefing] = await Promise.all([
        api.recommendations(),
        api.collectStatus(),
        api.favorites(),
        briefingPromise,
      ]);
      setRecommendations(recs.data);
      setLastRun(status.data.lastRun);
      setNextCollectAt(status.meta?.nextCollectAt);
      setFavoriteTickers(favorites.data.tickers);
      setFavoriteSectors(favorites.data.sectors);
      setSlot(briefing);
      setError(null);
      // 시세도 부가 정보 — 실패해도 추천 표시에는 영향 없음
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
      setError(
        e instanceof Error
          ? e.message
          : '수집에 실패했어요. 잠시 후 다시 시도해주세요.',
      );
    } finally {
      setCollecting(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openDetail = useCallback((id: string) => setDetailId(id), []);

  const toggleFavorite = useCallback((ticker: string) => {
    const wasFavorite = favoritesRef.current.includes(ticker);
    // 낙관적 갱신·롤백·응답 반영 모두 이 티커 하나만 건드린다.
    // 배열을 통째로 교체하면 그 사이 성공한 다른 토글까지 되돌아가고,
    // 응답이 뒤바뀌어 도착하면 낡은 서버 상태가 화면을 덮는다.
    const apply = (on: boolean) =>
      setFavoriteTickers(cur =>
        on
          ? cur.includes(ticker)
            ? cur
            : [...cur, ticker]
          : cur.filter(t => t !== ticker),
      );
    apply(!wasFavorite);
    api
      .toggleFavorite(ticker)
      .then(res => apply(res.data.tickers.includes(ticker)))
      .catch(() => apply(wasFavorite));
  }, []);

  /** 종목 티커 → 추천 상세. 나이트 브리핑 칩이 쓴다 */
  const openByTicker = useCallback(
    (ticker: string) => {
      const found = recommendations.find(r => r.ticker === ticker);
      if (found) setDetailId(found.id);
    },
    [recommendations],
  );

  // 시장 필터 — 구버전 데이터는 market이 없을 수 있어 KR로 간주
  const byMarket = recommendations.filter(
    r => market === null || (r.market ?? 'KR') === market,
  );
  const favoriteRecs = byMarket.filter(r => favoriteTickers.includes(r.ticker));
  const listRecs = (
    sector ? byMarket.filter(r => r.sector === sector) : byMarket
  ).filter(r => sector !== null || !favoriteTickers.includes(r.ticker));

  // 홈에 남기는 섹터 3개: 관심 섹터 우선, 모자라면 추천이 많은 섹터로 채운다
  const visibleSectors = useMemo(() => {
    const counts = new Map<Sector, number>();
    for (const r of byMarket)
      counts.set(r.sector, (counts.get(r.sector) ?? 0) + 1);
    const picked = favoriteSectors.filter(s => SECTORS.includes(s));
    const rest = SECTORS.filter(s => !picked.includes(s)).sort(
      (a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0),
    );
    const top = [...picked, ...rest].slice(0, VISIBLE_SECTORS);
    // 시트에서 고른 섹터가 칩 줄에서 사라지지 않게 한다
    return sector && !top.includes(sector)
      ? [sector, ...top].slice(0, VISIBLE_SECTORS)
      : top;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favoriteSectors, sector, recommendations, market]);

  const renderCard = (rec: Recommendation, index: number) => (
    <Stagger key={rec.id} index={index} enabled={index < ANIMATED_ITEMS}>
      <RecommendationCard
        rec={rec}
        quote={quotes[rec.ticker] ?? null}
        favorite={favoriteTickers.includes(rec.ticker)}
        onPress={openDetail}
        onToggleFavorite={toggleFavorite}
        // 오늘의 1순위 하나에만 깊이를 준다 (한 번에 TiltCard 는 1개)
        tiltWidth={index === 0 ? screenWidth - spacing.xl * 2 : undefined}
      />
    </Stagger>
  );

  const summary = slot?.data.marketSummary;

  return (
    <View style={styles.flex}>
      {/* 화면 전체에 오로라 캔버스 딱 1개 (리스트 뒤).
          상단 인셋까지 덮어야 상태바 경계에 이음선이 생기지 않는다. */}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { top: -insets.top }]}
      >
        <AuroraBackground
          positive={summary?.positive}
          negative={summary?.negative}
          neutral={summary?.neutral}
          // 모달이 덮고 있는 동안엔 보이지 않으므로 매 프레임 셰이더를 돌릴 이유가 없다
          paused={detailId !== null || searchOpen}
        />
      </View>
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
        {/* 헤더 — 수집 상태 카드는 아이콘 버튼 + 캡션 한 줄로 접었다 */}
        <View style={styles.headerBlock}>
          <View style={styles.header}>
            <Image
              source={require('../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                DeTok
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.subtitle, { color: colors.textSecondary }]}
              >
                {greeting(user ? user.nickname : undefined)}
              </Text>
            </View>
            <IconButton label="종목 검색" onPress={() => setSearchOpen(true)}>
              <Search size={18} color={colors.textSecondary} />
            </IconButton>
            <CollectButton
              collecting={collecting}
              onPress={() => void onCollect()}
            />
            <IconButton
              label="안내"
              onPress={() => Alert.alert('안내', DISCLAIMER)}
            >
              <Info size={18} color={colors.textTertiary} />
            </IconButton>
          </View>

          <View style={styles.headerMeta}>
            <Text
              numberOfLines={1}
              style={[styles.caption, { color: colors.textTertiary }]}
            >
              마지막 수집 {formatKst(lastRun?.finishedAt)} · 다음{' '}
              {formatKst(nextCollectAt)}
            </Text>
            <MarketSegment market={market} onChange={setMarket} />
          </View>
        </View>

        {/* 브리핑 슬롯 — KST 21:00~05:59 는 나이트 카드로 교체된다 (기획자 스펙 §2) */}
        {slot?.kind === 'night' && (
          <NightBriefingCard briefing={slot.data} onPressWatch={openByTicker} />
        )}
        {slot?.kind === 'day' && slot.data.marketSummary.total > 0 && (
          <BriefingCard briefing={slot.data} onPressPick={openDetail} />
        )}

        {error && (
          <ErrorCard
            message={error}
            onRetry={() => {
              setLoading(true);
              void load();
            }}
          />
        )}

        {/* 관심 종목 — 가로 캐러셀 (세로로 쌓으면 아래 추천이 안 보인다) */}
        {sector === null && favoriteRecs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Star size={14} color={colors.warning} fill={colors.warning} />
              <Text
                style={[styles.sectionTitle, { color: colors.textPrimary }]}
              >
                관심 종목
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
            >
              {favoriteRecs.map(rec => {
                const quote = quotes[rec.ticker] ?? null;
                return (
                  <Pressable
                    key={rec.id}
                    onPress={() => openDetail(rec.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${rec.stockName} 자세히 보기`}
                    style={[
                      styles.favCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.borderSubtle,
                      },
                    ]}
                  >
                    <StockLogo
                      ticker={rec.ticker}
                      name={rec.stockName}
                      size={26}
                    />
                    <Text
                      numberOfLines={1}
                      style={[styles.favName, { color: colors.textPrimary }]}
                    >
                      {rec.stockName}
                    </Text>
                    {quote ? (
                      <ChangeText pct={quote.changePct} size={12} />
                    ) : (
                      <Text
                        style={[styles.change, { color: colors.textDisabled }]}
                      >
                        —
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* 섹터 — 칩 9개를 전체 + 3개 + 더보기로 접었다 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Chip
            label="전체"
            active={sector === null}
            onPress={() => setSector(null)}
          />
          {visibleSectors.map(s => (
            <Chip
              key={s}
              label={SECTOR_LABELS[s]}
              active={sector === s}
              onPress={() => setSector(s)}
              Icon={SECTOR_ICONS[s]}
            />
          ))}
          <Chip
            label="더보기"
            active={false}
            onPress={() => setSectorSheetOpen(true)}
          />
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
                : '아직 추천이 없어요. 위 새로고침 버튼을 눌러 최신 뉴스를 분석해볼까요?'}
            </Text>
          </Card>
        ) : (
          listRecs.map(renderCard)
        )}
      </ScrollView>

      <SectorSheet
        visible={sectorSheetOpen}
        selected={sector}
        onSelect={next => {
          setSector(next);
          setSectorSheetOpen(false);
        }}
        onClose={() => setSectorSheetOpen(false)}
      />

      <RecommendationDetailModal
        recommendationId={detailId}
        onClose={() => setDetailId(null)}
      />

      <StockSearchModal
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.lg },
  headerBlock: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerText: { flex: 1 },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 40, height: 40, borderRadius: 20 },
  title: { fontSize: 21, fontWeight: '800' },
  subtitle: { fontSize: 12 },
  caption: { flex: 1, fontSize: 11 },
  segment: { flexDirection: 'row', borderRadius: radius.chip, padding: 2 },
  segmentCell: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: radius.chip,
  },
  segmentLabel: { fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardBody: { flex: 1, gap: 6 },
  // TiltCard 의 캔버스 여백(TILT_PAD)을 상쇄해 다른 카드와 좌우·상하를 맞춘다
  tiltWrap: { marginHorizontal: -TILT_PAD, marginVertical: -TILT_PAD },
  stockName: { flex: 1, fontSize: 17, fontWeight: '700' },
  change: { fontWeight: '600', fontVariant: ['tabular-nums'] },
  reason: { fontSize: 13, lineHeight: 19 },
  emptyText: { fontSize: 14 },
  section: { gap: spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 4,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700' },
  carousel: { gap: spacing.sm, paddingVertical: 2 },
  favCard: {
    width: 108,
    gap: 4,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  favName: { fontSize: 12, fontWeight: '600' },
  chipRow: { gap: spacing.sm },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700' },
  sheetChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
