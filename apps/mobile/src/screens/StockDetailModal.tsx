import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ExternalLink, X } from 'lucide-react-native';
import type { StockDetail } from '@daily-stocks/shared';
import { MARKET_LABELS, SECTOR_LABELS } from '@daily-stocks/shared';
import { api, formatKst, openExternalUrl } from '../api/client';
import { PriceChartCard } from '../components/PriceChartCard';
import { TrendChart } from '../components/TrendChart';
import { StockLogo } from '../components/StockLogo';
import { Card, QuoteLine, ScorePill, SentimentBadge } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';
import { spacing } from '../theme/tokens';

/**
 * 종목 상세 (기획서 §4 IA) — 추천 여부와 무관하게 종목 단위로 진입.
 * 뉴스 리스트의 종목 태그, 히스토리 행에서 열린다.
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

  useEffect(() => {
    if (!ticker) return;
    setDetail(null);
    setError(null);
    api
      .stockDetail(ticker)
      .then(res => setDetail(res.data))
      .catch(e =>
        setError(e instanceof Error ? e.message : '종목 정보를 불러오지 못했어요.'),
      );
  }, [ticker]);

  return (
    <Modal
      visible={ticker !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.flex, { backgroundColor: colors.backgroundSoft }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            종목 상세
          </Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {error && <Text style={{ color: colors.danger }}>{error}</Text>}

          {detail && (
            <>
              <Card>
                <View style={styles.rowBetween}>
                  <StockLogo ticker={detail.stock.ticker} name={detail.stock.name} size={40} />
                  <View style={styles.stockInfo}>
                    <Text style={[styles.stockName, { color: colors.textPrimary }]}>
                      {detail.stock.name}
                    </Text>
                    <Text style={[styles.stockMeta, { color: colors.indigo }]}>
                      {MARKET_LABELS[detail.stock.market]}
                      {detail.stock.sector
                        ? ` · ${SECTOR_LABELS[detail.stock.sector]}`
                        : ''}{' '}
                      · {detail.stock.ticker}
                    </Text>
                    {detail.quote && <QuoteLine quote={detail.quote} size={15} />}
                  </View>
                  {detail.recommendation && (
                    <ScorePill score={detail.recommendation.score} />
                  )}
                </View>
              </Card>

              {/* 주가 차트 (토스 스타일, 구간 선택) */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  주가 차트
                </Text>
                <PriceChartCard ticker={detail.stock.ticker} />
              </View>

              {detail.recommendation ? (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                    현재 추천 이유
                  </Text>
                  <Card>
                    <Text style={[styles.reason, { color: colors.textSecondary }]}>
                      {detail.recommendation.reason}
                    </Text>
                  </Card>
                </View>
              ) : (
                <Card>
                  <Text style={[styles.reason, { color: colors.textSecondary }]}>
                    지금 추천 중인 종목은 아니에요. 아래 뉴스 흐름을 참고해보세요.
                  </Text>
                </Card>
              )}

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  최근 7일 감성 트렌드
                </Text>
                <Card>
                  <TrendChart trend={detail.trend} />
                </Card>
              </View>

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  관련 뉴스 {detail.news.length}건
                </Text>
                {detail.news.length === 0 ? (
                  <Card>
                    <Text style={[styles.reason, { color: colors.textSecondary }]}>
                      최근 7일 동안은 관련 뉴스가 없었어요.
                    </Text>
                  </Card>
                ) : (
                  detail.news.map(item => (
                    <Card
                      key={item.id}
                      onPress={() => openExternalUrl(item.url)}
                      style={styles.newsCard}
                    >
                      <SentimentBadge sentiment={item.sentiment} />
                      <Text style={[styles.newsTitle, { color: colors.textPrimary }]}>
                        {item.title}
                      </Text>
                      <View style={styles.newsMetaRow}>
                        <Text style={[styles.newsMeta, { color: colors.textDisabled }]}>
                          {item.press} · {formatKst(item.publishedAt)}
                        </Text>
                        <ExternalLink size={13} color={colors.textDisabled} />
                      </View>
                    </Card>
                  ))
                )}
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
  newsCard: { gap: 6 },
  newsTitle: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  newsMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  newsMeta: { fontSize: 11 },
  disclaimer: { fontSize: 11, textAlign: 'center', marginVertical: spacing.md },
});
