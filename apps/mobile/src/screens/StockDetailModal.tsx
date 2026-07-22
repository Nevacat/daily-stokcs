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
import { SECTOR_LABELS } from '@daily-stocks/shared';
import { api, formatKst, openExternalUrl } from '../api/client';
import { TrendChart } from '../components/TrendChart';
import { Card, ScorePill, SentimentBadge } from '../components/ui';
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
        setError(e instanceof Error ? e.message : '종목 정보를 불러오지 못했습니다.'),
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
                  <View style={styles.stockInfo}>
                    <Text style={[styles.stockName, { color: colors.textPrimary }]}>
                      {detail.stock.name}
                    </Text>
                    <Text style={[styles.stockMeta, { color: colors.indigo }]}>
                      {SECTOR_LABELS[detail.stock.sector]} · {detail.stock.ticker}
                    </Text>
                  </View>
                  {detail.recommendation && (
                    <ScorePill score={detail.recommendation.score} />
                  )}
                </View>
              </Card>

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
                    현재 추천 중인 종목은 아닙니다. 아래 뉴스 흐름을 참고하세요.
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
                      최근 7일 내 관련 뉴스가 없습니다.
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
                본 정보는 투자 참고용이며, 투자 판단의 책임은 이용자에게 있습니다.
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
