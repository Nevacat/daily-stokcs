import React, { useCallback, useEffect, useState } from 'react';
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import type { CollectRun, Recommendation, Sector } from '@daily-stocks/shared';
import { SECTOR_LABELS, SECTORS } from '@daily-stocks/shared';
import { api, formatKst } from '../api/client';
import { Button, Card, Chip, ScorePill } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';
import { spacing } from '../theme/tokens';
import { RecommendationDetailModal } from './RecommendationDetailModal';

export function HomeScreen() {
  const { colors } = useTheme();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [sector, setSector] = useState<Sector | null>(null);
  const [lastRun, setLastRun] = useState<CollectRun | undefined>();
  const [nextCollectAt, setNextCollectAt] = useState<string | undefined>();
  const [collecting, setCollecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [recs, status] = await Promise.all([
        api.recommendations(),
        api.collectStatus(),
      ]);
      setRecommendations(recs.data);
      setLastRun(status.data.lastRun);
      setNextCollectAt(status.meta?.nextCollectAt);
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

  const visible = sector
    ? recommendations.filter(r => r.sector === sector)
    : recommendations;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
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
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              뉴스를 읽는 가장 스마트한 방법
            </Text>
          </View>
        </View>

        {/* 수집 상태 카드 (기획서 §2.1) */}
        <Card>
          <View style={styles.rowBetween}>
            <View style={{ gap: 2 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                마지막 수집 {formatKst(lastRun?.finishedAt)}
              </Text>
              <Text style={{ color: colors.textDisabled, fontSize: 12 }}>
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
            <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text>
          </Card>
        )}

        {/* 섹터 탭 (기획서 §2.2) */}
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
              onPress={() => setSector(s)}
            />
          ))}
        </ScrollView>

        {/* 추천 카드 리스트 */}
        {visible.length === 0 ? (
          <Card>
            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
              아직 추천이 없습니다. 지금 수집하기를 눌러 최신 뉴스를 분석해보세요.
            </Text>
          </Card>
        ) : (
          visible.map(rec => (
            <Card key={rec.id} onPress={() => setDetailId(rec.id)}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.row}>
                    <Text style={[styles.stockName, { color: colors.textPrimary }]}>
                      {rec.stockName}
                    </Text>
                    <Text style={{ color: colors.textDisabled, fontSize: 12 }}>
                      {rec.ticker}
                    </Text>
                  </View>
                  <Text style={{ color: colors.indigo, fontSize: 12, fontWeight: '600' }}>
                    {SECTOR_LABELS[rec.sector]} · 근거 뉴스 {rec.newsIds.length}건
                  </Text>
                  <Text
                    style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19 }}
                    numberOfLines={2}
                  >
                    {rec.reason}
                  </Text>
                </View>
                <ScorePill score={rec.score} />
              </View>
            </Card>
          ))
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
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: { width: 44, height: 44, borderRadius: 12 },
  title: { fontSize: 22, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  stockName: { fontSize: 17, fontWeight: '700' },
  disclaimer: { fontSize: 11, textAlign: 'center', marginTop: spacing.md },
});
