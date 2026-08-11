import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  X,
} from 'lucide-react-native';
import type { SentimentTrend, StockDetail } from '@daily-stocks/shared';
import { MARKET_LABELS, SECTOR_LABELS } from '@daily-stocks/shared';
import { api, formatKst, openExternalUrl } from '../api/client';
import { EventTimeline } from '../components/EventTimeline';
import { PriceChartCard } from '../components/PriceChartCard';
import { TrendChart } from '../components/TrendChart';
import { StockLogo } from '../components/StockLogo';
import { ScoreRing } from '../components/ScoreRing';
import { Card, QuoteLine, SentimentBadge } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';
import { spacing } from '../theme/tokens';

/** 처음에 펼쳐두는 관련 뉴스 건수 — 나머지는 '모두 보기'로 (기획서 §2.4 스캔 우선) */
const NEWS_PREVIEW = 3;

/** 7일 감성 합계 — 트렌드 차트를 접어둔 상태에서 한 줄로 요약한다 */
function trendTotals(trend: SentimentTrend): {
  positive: number;
  negative: number;
} {
  return trend.days.reduce(
    (acc, d) => ({
      positive: acc.positive + d.positive,
      negative: acc.negative + d.negative,
    }),
    { positive: 0, negative: 0 },
  );
}

/**
 * 종목 상세 (기획서 §4 IA) — 추천 여부와 무관하게 종목 단위로 진입.
 * 뉴스 리스트의 종목 태그, 히스토리 행에서 열린다.
 *
 * 정보 순서는 사용자의 질문 순서를 따른다:
 * 무슨 종목인가 → 왜 추천했나 → 주가는 → 앞으로 일정은 → 분위기는 → 근거 뉴스는.
 */
export function StockDetailModal({
  ticker,
  onClose,
}: {
  ticker: string | null;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllNews, setShowAllNews] = useState(false);
  const [showTrend, setShowTrend] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const newsY = useRef(0);

  useEffect(() => {
    if (!ticker) return;
    setDetail(null);
    setError(null);
    setShowAllNews(false);
    setShowTrend(false);
    api
      .stockDetail(ticker)
      .then(res => setDetail(res.data))
      .catch(e =>
        setError(
          e instanceof Error ? e.message : '종목 정보를 불러오지 못했어요.',
        ),
      );
  }, [ticker]);

  // 판단 로직 공개 (기획서 §2.3) — 추천의 근거 뉴스만 센다
  const evidence = detail?.recommendation
    ? detail.news.filter(n => detail.recommendation!.newsIds.includes(n.id))
    : [];
  const positive = evidence.filter(n => n.sentiment === 'positive').length;
  const negative = evidence.filter(n => n.sentiment === 'negative').length;
  const neutral = evidence.length - positive - negative;

  const totals = detail
    ? trendTotals(detail.trend)
    : { positive: 0, negative: 0 };
  const trendSummary =
    totals.positive > totals.negative
      ? { mark: '▲', text: '호재 우세', color: colors.up }
      : totals.negative > totals.positive
        ? { mark: '▼', text: '악재 우세', color: colors.down }
        : { mark: '—', text: '호재·악재 비슷', color: colors.flat };

  const visibleNews = showAllNews
    ? (detail?.news ?? [])
    : (detail?.news ?? []).slice(0, NEWS_PREVIEW);

  return (
    <Modal
      visible={ticker !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.flex, { backgroundColor: colors.backgroundSoft }]}>
        <View
          style={[styles.header, { borderBottomColor: colors.borderSubtle }]}
        >
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            종목 상세
          </Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
          {error && <Text style={{ color: colors.danger }}>{error}</Text>}

          {detail && (
            <>
              <Card>
                <View style={styles.rowBetween}>
                  <StockLogo
                    ticker={detail.stock.ticker}
                    name={detail.stock.name}
                    size={40}
                  />
                  <View style={styles.stockInfo}>
                    <Text
                      style={[styles.stockName, { color: colors.textPrimary }]}
                    >
                      {detail.stock.name}
                    </Text>
                    <Text style={[styles.stockMeta, { color: colors.indigo }]}>
                      {MARKET_LABELS[detail.stock.market]}
                      {detail.stock.sector
                        ? ` · ${SECTOR_LABELS[detail.stock.sector]}`
                        : ''}{' '}
                      · {detail.stock.ticker}
                    </Text>
                    {detail.quote && (
                      <QuoteLine quote={detail.quote} size={15} />
                    )}
                  </View>
                  {detail.recommendation && (
                    <ScoreRing score={detail.recommendation.score} />
                  )}
                </View>
              </Card>

              {/* 사용자가 종목을 누른 이유 1순위 — 차트보다 먼저 답한다 */}
              {detail.recommendation ? (
                <View style={styles.section}>
                  <Text
                    style={[styles.sectionTitle, { color: colors.textPrimary }]}
                  >
                    현재 추천 이유
                  </Text>
                  <Card>
                    <Text
                      style={[styles.reason, { color: colors.textSecondary }]}
                    >
                      {detail.recommendation.reason}
                    </Text>

                    {evidence.length > 0 && (
                      <Pressable
                        onPress={() =>
                          scrollRef.current?.scrollTo({
                            y: Math.max(newsY.current - spacing.md, 0),
                            animated: true,
                          })
                        }
                        style={styles.logic}
                      >
                        {/* 산출 과정 공개 — 사이 8px 중립 갭으로 색 진동을 막는다 */}
                        <View style={styles.stack}>
                          {[
                            { n: positive, color: colors.up },
                            { n: negative, color: colors.down },
                            { n: neutral, color: colors.flat },
                          ]
                            .filter(seg => seg.n > 0)
                            .map(seg => (
                              <View
                                key={seg.color}
                                style={[
                                  styles.stackSegment,
                                  { flex: seg.n, backgroundColor: seg.color },
                                ]}
                              />
                            ))}
                        </View>
                        <Text
                          style={[
                            styles.logicText,
                            { color: colors.textTertiary },
                          ]}
                        >
                          호재 {positive} · 악재 {negative} →{' '}
                          {detail.recommendation.score}점
                        </Text>
                      </Pressable>
                    )}
                  </Card>
                </View>
              ) : (
                <Card>
                  <Text
                    style={[styles.reason, { color: colors.textSecondary }]}
                  >
                    지금 추천 중인 종목은 아니에요. 아래 뉴스 흐름을
                    참고해보세요.
                  </Text>
                </Card>
              )}

              {/* 주가 차트 (토스 스타일, 구간 선택) */}
              <View style={styles.section}>
                <Text
                  style={[styles.sectionTitle, { color: colors.textPrimary }]}
                >
                  주가 차트
                </Text>
                <PriceChartCard ticker={detail.stock.ticker} />
              </View>

              {/* 예정된 일정 — 전부 추정치라 컴포넌트가 '예상' 캡션을 항상 붙인다 */}
              <View style={styles.section}>
                <Text
                  style={[styles.sectionTitle, { color: colors.textPrimary }]}
                >
                  예정된 일정
                </Text>
                <EventTimeline
                  tickers={[detail.stock.ticker]}
                  variant="inline"
                  note={
                    detail.stock.market === 'US'
                      ? '미국 종목은 배당 일정만 보여드릴 수 있어요.'
                      : undefined
                  }
                />
              </View>

              {/* 감성 트렌드는 기본 접힘 — 한 줄 요약이면 대부분 충분하다 */}
              <View style={styles.section}>
                <Text
                  style={[styles.sectionTitle, { color: colors.textPrimary }]}
                >
                  최근 7일 감성 트렌드
                </Text>
                <Card onPress={() => setShowTrend(o => !o)}>
                  <View style={styles.rowBetween}>
                    <Text
                      style={[
                        styles.trendSummary,
                        { color: trendSummary.color },
                      ]}
                    >
                      {trendSummary.mark} {trendSummary.text}
                      <Text style={{ color: colors.textTertiary }}>
                        {'  '}호재 {totals.positive} · 악재 {totals.negative}
                      </Text>
                    </Text>
                    {showTrend ? (
                      <ChevronDown size={16} color={colors.textTertiary} />
                    ) : (
                      <ChevronRight size={16} color={colors.textTertiary} />
                    )}
                  </View>
                  {showTrend && (
                    <View style={styles.trendChart}>
                      <TrendChart trend={detail.trend} />
                    </View>
                  )}
                </Card>
              </View>

              <View
                style={styles.section}
                onLayout={e => (newsY.current = e.nativeEvent.layout.y)}
              >
                <Text
                  style={[styles.sectionTitle, { color: colors.textPrimary }]}
                >
                  관련 뉴스 {detail.news.length}건
                </Text>
                {detail.news.length === 0 ? (
                  <Card>
                    <Text
                      style={[styles.reason, { color: colors.textSecondary }]}
                    >
                      최근 7일 동안은 관련 뉴스가 없었어요.
                    </Text>
                  </Card>
                ) : (
                  <>
                    {visibleNews.map(item => (
                      <Card
                        key={item.id}
                        onPress={() => openExternalUrl(item.url)}
                        style={styles.newsCard}
                      >
                        <SentimentBadge sentiment={item.sentiment} />
                        <Text
                          style={[
                            styles.newsTitle,
                            { color: colors.textPrimary },
                          ]}
                        >
                          {item.title}
                        </Text>
                        <View style={styles.newsMetaRow}>
                          <Text
                            style={[
                              styles.newsMeta,
                              { color: colors.textTertiary },
                            ]}
                          >
                            {item.press} · {formatKst(item.publishedAt)}
                          </Text>
                          <ExternalLink size={13} color={colors.textTertiary} />
                        </View>
                      </Card>
                    ))}
                    {!showAllNews && detail.news.length > NEWS_PREVIEW && (
                      <Pressable
                        onPress={() => setShowAllNews(true)}
                        style={styles.moreNews}
                      >
                        <Text
                          style={[
                            styles.moreNewsText,
                            { color: colors.primary },
                          ]}
                        >
                          관련 뉴스 {detail.news.length}건 모두 보기
                        </Text>
                      </Pressable>
                    )}
                  </>
                )}
              </View>

              <Text style={[styles.disclaimer, { color: colors.textTertiary }]}>
                DeTok은 참고 정보만 제공해요. 투자 판단과 책임은 언제나 본인에게
                있어요.
              </Text>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  content: { padding: spacing.xl, gap: spacing.lg },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  stockInfo: { gap: 4, flex: 1 },
  stockName: { fontSize: 20, fontWeight: '800' },
  stockMeta: { fontSize: 12, fontWeight: '600' },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginLeft: 4 },
  reason: { fontSize: 14, lineHeight: 21 },
  logic: { marginTop: spacing.md, gap: 6 },
  stack: { flexDirection: 'row', gap: spacing.sm, height: 6 },
  stackSegment: { height: 6, borderRadius: 3 },
  logicText: { fontSize: 12, fontWeight: '600' },
  trendSummary: { flex: 1, fontSize: 13, fontWeight: '700' },
  trendChart: { marginTop: spacing.md },
  newsCard: { gap: 6 },
  newsTitle: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  newsMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  newsMeta: { fontSize: 11 },
  moreNews: { alignItems: 'center', paddingVertical: spacing.md },
  moreNewsText: { fontSize: 13, fontWeight: '700' },
  disclaimer: { fontSize: 11, textAlign: 'center', marginVertical: spacing.md },
});
