import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { Button, Card } from './ui';
import { useTheme } from '../theme/ThemeContext';
import { spacing } from '../theme/tokens';

/** 로드 실패 시 재시도 버튼이 있는 에러 카드 */
export function ErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Card style={styles.card}>
      <WifiOff size={22} color={colors.textDisabled} />
      <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
      <Button title="다시 시도" variant="secondary" onPress={onRetry} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  message: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
