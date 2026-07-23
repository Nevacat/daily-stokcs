import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ExternalLink, Share2, X } from 'lucide-react-native';
import type {
  NewsItem,
  Recommendation,
  SentimentTrend,
  StockQuote,
} from '@daily-stocks/shared';
import { SECTOR_LABELS } from '@daily-stocks/shared';
import { api, formatKst, openExternalUrl } from '../api/client';
import { PriceChartCard } from '../components/PriceChartCard';
import { TrendChart } from '../components/TrendChart';
import { StockLogo } from '../components/StockLogo';
import { Card, QuoteLine, ScorePill, SentimentBadge } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing } from '../theme/tokens';

/** 추천 상세: 추천 이유 + 근거 뉴스 (기획서 §2.3) */
export function RecommendationDetailModal({
  recommendationId,
  onClose,
}: {
  recommendationId: string | null;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [evidence, setEvidence] = useState<NewsItem[]>([]);
  const [trend, setTrend] = useState<SentimentTrend | null>(null);
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recommendationId) return;
    setRecommendation(null);
    setTrend(null);
    setQuote(null);
    setError(null);
    api
      .recommendationDetail(recommendationId)
      .then(res => {
        setRecommendation(res.data.recommendation);
        setEvidence(res.data.evidence);
        // 트렌드·시세는 부가 정보 — 실패해도 상세는 그대로 보여준다
        const ticker = res.data.recommendation.ticker;
        api
          .tickerTrend(ticker)
          .then(t => setTrend(t.data))
          .catch(() => {});
        api
          .quotes([ticker])
          .then(q => setQuote(q.data[ticker] ?? null))
          .catch(() => {});
      })
      .catch(e =>
        setError(e instanceof Error ? e.message : '상세를 불러오지 못했어요.'),
      );
  }, [recommendationId]);

  /** 추천 카드 공유 (기획서 §3.6) — 종목·이유·근거 뉴스 + 면책 문구 */
  const onShare = async () => {
    if (!recommendation) return;
    const evidenceLines = evidence
      .slice(0, 2)
      .map(n => `- ${n.title}\n  ${n.url}`)
      .join('\n');
    const message = [
      `[DeTok] ${recommendation.stockName} (${recommendation.ticker}) — 종합 ${recommendation.score}점`,
      recommendation.reason,
      evidenceLines ? `근거 뉴스\n${evidenceLines}` : null,
      '※ DeTok은 참고 정보만 제공해요. 투자 판단과 책임은 언제나 본인에게 있어요.',
    ]
      .filter(Boolean)
      .join('\n\n');
    try {
      await Share.share({ message });
    } catch {
      // 사용자가 공유 시트를 닫은 경우 등 — 무시
    }
  };

  return (
    <Modal
      visible={recommendationId !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.backgroundSoft }}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '700' }}>
            추천 상세
          </Text>
          <View style={styles.headerActions}>
            {recommendation && (
              <Pressable onPress={() => void onShare()} hitSlop={12}>
                <Share2 size={20} color={colors.textSecondary} />
              </Pressable>
            )}
            <Pressable onPress={onClose} hitSlop={12}>
              <X size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
          {error && <Text style={{ color: colors.danger }}>{error}</Text>}

          {recommendation && (
            <>
              <Card>
                <View style={styles.rowBetween}>
                  <StockLogo ticker={recommendation.ticker} size={40} />
                  <View style={{ gap: 4, flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '800' }}>
                      {recommendation.stockName}
                    </Text>
                    <Text style={{ color: colors.indigo, fontSize: 12, fontWeight: '600' }}>
                      {SECTOR_LABELS[recommendation.sector]} · {recommendation.ticker}
                    </Text>
                    {quote && <QuoteLine quote={quote} size={15} />}
                    <Text style={{ color: colors.textDisabled, fontSize: 11 }}>
                      추천 시각 {formatKst(recommendation.recommendedAt)}
                    </Text>
                  </View>
                  <ScorePill score={recommendation.score} />
                </View>
              </Card>

              {/* 주가 차트 (토스 스타일, 구간 선택) */}
              <View style={{ gap: spacing.sm }}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  주가 차트
                </Text>
                <PriceChartCard ticker={recommendation.ticker} />
              </View>

              <View style={{ gap: spacing.sm }}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  왜 추천하나요?
                </Text>
                <Card>
                  <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 21 }}>
                    {recommendation.reason}
                  </Text>
                </Card>
              </View>

              {trend && (
                <View style={{ gap: spacing.sm }}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                    최근 7일 감성 트렌드
                  </Text>
                  <Card>
                    <TrendChart trend={trend} />
                  </Card>
                </View>
              )}

              <View style={{ gap: spacing.sm }}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  근거 뉴스 {evidence.length}건
                </Text>
                {evidence.map(news => (
                  <Card
                    key={news.id}
                    onPress={() => openExternalUrl(news.url)}
                    style={{ gap: 6 }}
                  >
                    <SentimentBadge sentiment={news.sentiment} />
                    <Text
                      style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600', lineHeight: 20 }}
                    >
                      {news.title}
                    </Text>
                    <View style={styles.newsMetaRow}>
                      <Text style={{ color: colors.textDisabled, fontSize: 11 }}>
                        {news.press} · {formatKst(news.publishedAt)}
                      </Text>
                      <ExternalLink size={13} color={colors.textDisabled} />
                    </View>
                  </Card>
                ))}
              </View>

              <Text style={[styles.disclaimer, { color: colors.textDisabled }]}>
                DeTok은 참고 정보만 제공해요. 투자 판단과 책임은 언제나 본인에게 있어요.
              </Text>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginLeft: 4 },
  newsMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  disclaimer: {
    fontSize: 11,
    textAlign: 'center',
    marginVertical: spacing.md,
    borderRadius: radius.chip,
  },
});
