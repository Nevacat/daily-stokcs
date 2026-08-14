import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Check, ChevronRight } from 'lucide-react-native';
import type { PaperPortfolio, PaperPosition } from '@daily-stocks/shared';
import { api } from '../api/client';
import { ErrorCard } from '../components/ErrorCard';
import { EventTimeline } from '../components/EventTimeline';
import { SkeletonCard } from '../components/Skeleton';
import { StockLogo } from '../components/StockLogo';
import { Button, Card } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';
import { changeColor, changeMark, radius, spacing } from '../theme/tokens';
import { CompareModal } from './CompareModal';
import { StockDetailModal } from './StockDetailModal';

/** 한 번에 나란히 볼 수 있는 종목 수 (서버도 같은 값으로 검증한다) */
export const MAX_COMPARE = 3;

/**
 * 비교 선택 토글 — 이미 고른 종목은 해제하고, 상한을 넘으면 **같은 배열을 그대로** 돌려준다.
 * 호출부는 참조가 안 바뀐 것으로 "무시됐음"을 판단해 안내 문구를 띄운다.
 */
export function togglePicked(
  list: string[],
  ticker: string,
  max: number = MAX_COMPARE,
): string[] {
  if (list.includes(ticker)) return list.filter(t => t !== ticker);
  return list.length >= max ? list : [...list, ticker];
}

/**
 * 일정 조회에 한 번에 넘길 수 있는 종목 수 — 서버 상한과 같은 값이다.
 * 넘겨버리면 400 이 나고, EventTimeline 은 실패를 조용히 삼키므로
 * '다가오는 일정' 섹션이 안내도 없이 통째로 사라진다.
 */
export const MAX_EVENT_TICKERS = 20;

/** 일정 조회 대상 — 상한을 넘으면 앞에서부터 자른다 */
export const eventTickers = (positions: PaperPosition[]): string[] =>
  positions.slice(0, MAX_EVENT_TICKERS).map(p => p.ticker);

/** 일정 섹션 안내 한 줄 — 잘렸으면 그 사실을 먼저 알린다 */
export function eventNote(positions: PaperPosition[]): string | undefined {
  const lines = [
    positions.length > MAX_EVENT_TICKERS
      ? `종목이 많아서 일정은 먼저 담은 ${MAX_EVENT_TICKERS}개까지만 보여드려요.`
      : null,
    positions.some(p => p.currency === 'USD')
      ? '미국 종목은 배당 일정만 보여드릴 수 있어요.'
      : null,
  ].filter((line): line is string => line !== null);
  return lines.length > 0 ? lines.join(' ') : undefined;
}

/** 통화별 금액 표기 (client.formatPrice는 StockQuote 전용이라 숫자용으로 따로 둔다) */
function formatAmount(value: number, currency: string): string {
  return currency === 'USD'
    ? `$${value.toFixed(2)}`
    : `${Math.round(value).toLocaleString('ko-KR')}원`;
}

/** ISO(UTC) → `2026년 7월 2일` (KST 기준) */
function formatAddedDate(iso: string): string {
  const kst = new Date(new Date(iso).getTime() + 9 * 3_600_000);
  return `${kst.getUTCFullYear()}년 ${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`;
}

/** 등락률 표기 — 색만으로 방향을 전달하지 않도록 ▲▼ 를 항상 붙인다 (WCAG 1.4.1) */
function ChangeText({ pct, size = 15 }: { pct: number | null; size?: number }) {
  const { colors } = useTheme();
  if (pct === null) {
    return (
      <Text style={{ color: colors.textDisabled, fontSize: size }}>—</Text>
    );
  }
  return (
    <Text
      style={{
        color: changeColor(pct, colors),
        fontSize: size,
        fontWeight: '700',
      }}
    >
      {changeMark(pct)} {Math.abs(pct).toFixed(2)}%
    </Text>
  );
}

/**
 * 한 종목 행 — 접힌 상태에서는 숫자가 등락률 하나뿐이다.
 * 탭하면 담은 날짜와 두 가격이 한 줄로 펼쳐진다 (progressive disclosure).
 */
function PositionRow({
  position,
  expanded,
  onToggle,
  onOpenDetail,
  divider,
  selecting,
  selected,
}: {
  position: PaperPosition;
  expanded: boolean;
  onToggle: () => void;
  onOpenDetail: () => void;
  divider: boolean;
  /** 비교 선택 모드 — 행 탭이 아코디언 대신 체크 토글이 된다 */
  selecting: boolean;
  selected: boolean;
}) {
  const { colors } = useTheme();

  const detail =
    position.priceAtAdd === null || position.addedAt === null
      ? '담은 날 가격이 없어서 등락률은 다음에 담을 때부터 보여드릴게요.'
      : position.currentPrice === null
        ? '지금은 시세를 못 불러왔어요. 잠시 후 다시 볼까요?'
        : `${formatAddedDate(position.addedAt)}에 담았어요 · 그날 ${formatAmount(
            position.priceAtAdd,
            position.currency,
          )} → 지금 ${formatAmount(position.currentPrice, position.currency)}`;

  return (
    <View
      style={
        divider && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.divider,
        }
      }
    >
      <Pressable
        onPress={onToggle}
        accessibilityRole={selecting ? 'checkbox' : 'button'}
        accessibilityState={selecting ? { checked: selected } : { expanded }}
        style={styles.row}
      >
        {selecting && (
          <View
            style={[
              styles.checkbox,
              {
                backgroundColor: selected ? colors.primaryFill : 'transparent',
                borderColor: selected ? colors.primaryFill : colors.border,
              },
            ]}
          >
            {selected && <Check size={13} color={colors.onPrimaryFill} />}
          </View>
        )}
        <StockLogo
          ticker={position.ticker}
          name={position.stockName}
          size={30}
        />
        <Text style={[styles.stockName, { color: colors.textPrimary }]}>
          {position.stockName}
        </Text>
        <View style={styles.rowSpacer} />
        <ChangeText pct={position.changePct} />
      </Pressable>

      {expanded && !selecting && (
        <View style={styles.expanded}>
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>
            {detail}
          </Text>
          <Pressable
            onPress={onOpenDetail}
            accessibilityRole="button"
            style={styles.detailLink}
          >
            <Text style={[styles.detailLinkText, { color: colors.primary }]}>
              종목 상세
            </Text>
            <ChevronRight size={14} color={colors.primary} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

/**
 * 내 종목 (모의 포트폴리오) — 관심 종목을 담은 시점 가격 대비 등락률.
 * 실제 매매가 아니라 가상 계산이며, 화면 하단에 그 사실을 상시 노출한다.
 */
export function MyStocksScreen() {
  const { colors } = useTheme();
  const [portfolio, setPortfolio] = useState<PaperPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detailTicker, setDetailTicker] = useState<string | null>(null);
  // 비교: null 이면 선택 모드 꺼짐. 모달은 compareTickers 로 따로 연다
  const [picked, setPicked] = useState<string[] | null>(null);
  const [pickHint, setPickHint] = useState<string | null>(null);
  const [compareTickers, setCompareTickers] = useState<string[] | null>(null);

  const togglePick = (ticker: string) => {
    setPicked(prev => {
      const list = prev ?? [];
      const next = togglePicked(list, ticker);
      // 참조가 그대로면 상한에 걸려 무시된 것 — 4번째 탭은 먹지 않고 이유만 알려준다
      setPickHint(
        next === list ? `한 번에 ${MAX_COMPARE}개까지 볼 수 있어요.` : null,
      );
      return next;
    });
  };

  const load = useCallback(async () => {
    try {
      const res = await api.portfolio();
      setPortfolio(res.data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '내 종목을 불러오지 못했어요.');
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

  const average = portfolio?.averageChangePct ?? null;
  const measured = portfolio?.measuredCount ?? 0;
  const positions = portfolio?.positions ?? [];
  const selecting = picked !== null;
  // 1개 이하면 비교할 게 없다 — 버튼 자체를 그리지 않는다
  const canCompare = positions.length >= 2;

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
      <View style={styles.captionRow}>
        <Text style={[styles.caption, { color: colors.textSecondary }]}>
          {!selecting
            ? '담아둔 종목이 그동안 어떻게 됐는지 볼 수 있어요.'
            : (pickHint ??
              (picked?.length === 1
                ? '2개부터 나란히 볼 수 있어요.'
                : '비교할 종목을 2~3개 골라주세요.'))}
        </Text>
        {canCompare && (
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            onPress={() => {
              setPicked(selecting ? null : []);
              setPickHint(null);
              setExpanded(null);
            }}
          >
            <Text style={[styles.action, { color: colors.primary }]}>
              {selecting ? '취소' : '비교'}
            </Text>
          </Pressable>
        )}
      </View>

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
      ) : !portfolio || portfolio.positions.length === 0 ? (
        !error && (
          <Card>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              아직 담아둔 종목이 없어요. 마음에 드는 종목의 ⭐를 눌러
              담아보세요.
            </Text>
          </Card>
        )
      ) : (
        <>
          {/* 접힌 상태의 큰 숫자는 이것 하나뿐이다 */}
          <Card>
            <Text
              style={[styles.summaryLabel, { color: colors.textSecondary }]}
            >
              담은 날 대비 평균
            </Text>
            <ChangeText pct={average} size={34} />
            <Text style={[styles.summaryNote, { color: colors.textTertiary }]}>
              {measured > 0
                ? `${measured}종목 · 마지막 거래일 종가 기준이에요.`
                : '아직 계산할 수 있는 종목이 없어요.'}
            </Text>
          </Card>

          <Card style={styles.listCard}>
            {positions.map((position, index) => (
              <PositionRow
                key={position.ticker}
                position={position}
                divider={index > 0}
                selecting={selecting}
                selected={picked?.includes(position.ticker) ?? false}
                expanded={expanded === position.ticker}
                onToggle={() =>
                  selecting
                    ? togglePick(position.ticker)
                    : setExpanded(
                        expanded === position.ticker ? null : position.ticker,
                      )
                }
                onOpenDetail={() => setDetailTicker(position.ticker)}
              />
            ))}
          </Card>

          {selecting && (
            <Button
              title="나란히 보기"
              disabled={(picked?.length ?? 0) < 2}
              onPress={() => {
                setCompareTickers(picked);
                setPicked(null);
                setPickHint(null);
              }}
            />
          )}
        </>
      )}

      {/* 다가오는 실적·배당 (전부 추정치 — 캡션은 컴포넌트가 상시 노출한다) */}
      {portfolio && (
        <EventTimeline
          tickers={eventTickers(positions)}
          variant="section"
          note={eventNote(positions)}
          onSelectTicker={setDetailTicker}
        />
      )}

      <Text style={[styles.disclaimer, { color: colors.textDisabled }]}>
        실제로 사고판 게 아니라 담은 날 가격으로 계산한 가상 수치예요. 수수료와
        세금은 빠져 있고, 투자 판단과 책임은 언제나 본인에게 있어요.
      </Text>

      <CompareModal
        tickers={compareTickers}
        onClose={() => setCompareTickers(null)}
      />

      <StockDetailModal
        ticker={detailTicker}
        onClose={() => setDetailTicker(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, paddingTop: spacing.md, gap: spacing.lg },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  caption: { flex: 1, fontSize: 13, lineHeight: 19 },
  action: { fontSize: 13, fontWeight: '700' },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: radius.chip,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: { fontSize: 13, marginBottom: 2 },
  summaryNote: { fontSize: 12, marginTop: 6 },
  listCard: { paddingVertical: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowSpacer: { flex: 1 },
  stockName: { fontSize: 15, fontWeight: '600' },
  expanded: { paddingBottom: spacing.md, gap: spacing.sm },
  detailText: { fontSize: 12, lineHeight: 18 },
  detailLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  detailLinkText: { fontSize: 12, fontWeight: '700' },
  emptyText: { fontSize: 14, lineHeight: 20 },
  disclaimer: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
