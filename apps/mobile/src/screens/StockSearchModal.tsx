import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Search, X } from 'lucide-react-native';
import { MARKET_LABELS } from '@daily-stocks/shared';
import { useCatalog } from '../catalog/CatalogContext';
import { StockLogo } from '../components/StockLogo';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing } from '../theme/tokens';
import { StockDetailModal } from './StockDetailModal';

/** 종목 검색 (토스 스타일) — 전체 상장사에서 이름/티커 검색 */
export function StockSearchModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const { stocks, search } = useCatalog();
  const [query, setQuery] = useState('');
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const results = useMemo(() => search(query, 30), [search, query]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.backgroundSoft }]}>
        <View style={styles.header}>
          <View
            style={[
              styles.inputWrap,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Search size={17} color={colors.textDisabled} />
            <TextInput
              style={[styles.input, { color: colors.textPrimary }]}
              placeholder={`종목 이름이나 코드를 검색해보세요 (${stocks.length.toLocaleString()}개)`}
              placeholderTextColor={colors.textDisabled}
              value={query}
              onChangeText={setQuery}
              autoFocus
              autoCorrect={false}
            />
          </View>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        <FlatList
          data={results}
          keyExtractor={item => item.ticker}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textSecondary }]}>
              {query.trim()
                ? '검색 결과가 없어요. 다른 이름으로 찾아볼까요?'
                : '삼성전자, 엔비디아처럼 궁금한 종목을 검색해보세요.'}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.row, { borderBottomColor: colors.border }]}
              onPress={() => setSelectedTicker(item.ticker)}
            >
              <StockLogo ticker={item.ticker} name={item.name} size={32} />
              <View style={styles.rowText}>
                <Text style={[styles.rowName, { color: colors.textPrimary }]}>
                  {item.name}
                </Text>
                <Text style={[styles.rowMeta, { color: colors.textDisabled }]}>
                  {MARKET_LABELS[item.market]} · {item.ticker}
                </Text>
              </View>
            </Pressable>
          )}
        />

        <StockDetailModal
          ticker={selectedTicker}
          onClose={() => setSelectedTicker(null)}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.button,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 12 },
  list: { paddingHorizontal: spacing.xl },
  empty: { fontSize: 13, textAlign: 'center', paddingVertical: spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, gap: 2 },
  rowName: { fontSize: 15, fontWeight: '600' },
  rowMeta: { fontSize: 12 },
});
