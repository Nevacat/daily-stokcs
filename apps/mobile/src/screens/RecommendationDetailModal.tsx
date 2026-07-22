import React, { useEffect, useState } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ExternalLink, X } from 'lucide-react-native';
import type { NewsItem, Recommendation } from '@daily-stocks/shared';
import { SECTOR_LABELS } from '@daily-stocks/shared';
import { api, formatKst } from '../api/client';
import { Card, ScorePill, SentimentBadge } from '../components/ui';
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recommendationId) return;
    setRecommendation(null);
    setError(null);
    api
      .recommendationDetail(recommendationId)
      .then(res => {
        setRecommendation(res.data.recommendation);
        setEvidence(res.data.evidence);
      })
      .catch(e =>
        setError(e instanceof Error ? e.message : '상세를 불러오지 못했습니다.'),
      );
  }, [recommendationId]);

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
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
          {error && <Text style={{ color: colors.danger }}>{error}</Text>}

          {recommendation && (
            <>
              <Card>
                <View style={styles.rowBetween}>
                  <View style={{ gap: 4, flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '800' }}>
                      {recommendation.stockName}
                    </Text>
                    <Text style={{ color: colors.indigo, fontSize: 12, fontWeight: '600' }}>
                      {SECTOR_LABELS[recommendation.sector]} · {recommendation.ticker}
                    </Text>
                    <Text style={{ color: colors.textDisabled, fontSize: 11 }}>
                      추천 시각 {formatKst(recommendation.recommendedAt)}
                    </Text>
                  </View>
                  <ScorePill score={recommendation.score} />
                </View>
              </Card>

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

              <View style={{ gap: spacing.sm }}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  근거 뉴스 {evidence.length}건
                </Text>
                {evidence.map(news => (
                  <Card
                    key={news.id}
                    onPress={() => void Linking.openURL(news.url)}
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
