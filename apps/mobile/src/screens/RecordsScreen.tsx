import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Chip } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';
import { spacing } from '../theme/tokens';
import { HistoryScreen } from './HistoryScreen';
import { MyStocksScreen } from './MyStocksScreen';

type Segment = 'stocks' | 'history';

/**
 * 기록 탭 — '내 종목'(모의 포트폴리오)과 '추천 기록'(히스토리)을 세그먼트로 묶는다.
 * 둘 다 "시간이 지난 뒤 어떻게 됐나"를 보는 화면이라 한 탭에 둔다 (탭은 4개 유지).
 */
export function RecordsScreen() {
  const { colors } = useTheme();
  const [segment, setSegment] = useState<Segment>('stocks');

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>기록</Text>
        <View style={styles.segments}>
          <Chip
            label="내 종목"
            active={segment === 'stocks'}
            onPress={() => setSegment('stocks')}
          />
          <Chip
            label="추천 기록"
            active={segment === 'history'}
            onPress={() => setSegment('history')}
          />
        </View>
      </View>

      {segment === 'stocks' ? <MyStocksScreen /> : <HistoryScreen />}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  title: { fontSize: 22, fontWeight: '800' },
  segments: { flexDirection: 'row', gap: spacing.sm },
});
