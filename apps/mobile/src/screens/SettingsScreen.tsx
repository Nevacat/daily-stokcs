import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  LogOut,
  Moon,
  MonitorSmartphone,
  Sun,
  UserRoundX,
} from 'lucide-react-native';
import type { AuthProvider, CollectSettings } from '@daily-stocks/shared';
import { ALLOWED_INTERVALS } from '@daily-stocks/shared';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Card, Chip } from '../components/ui';
import { useTheme, type ThemeMode } from '../theme/ThemeContext';
import { spacing } from '../theme/tokens';

const INTERVAL_LABELS: Record<number, string> = {
  30: '30분',
  60: '1시간',
  180: '3시간',
  360: '6시간',
  1440: '1일',
};

const PROVIDER_LABELS: Record<AuthProvider, string> = {
  kakao: '카카오',
  apple: 'Apple',
  dev: '개발용',
};

const THEME_OPTIONS: { value: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: '라이트', Icon: Sun },
  { value: 'dark', label: '다크', Icon: Moon },
  { value: 'system', label: '시스템', Icon: MonitorSmartphone },
];

export function SettingsScreen() {
  const { colors, mode, setMode } = useTheme();
  const { user, logout, withdraw } = useAuth();
  const [settings, setSettings] = useState<CollectSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onLogout = () => {
    Alert.alert('로그아웃', '로그아웃하시겠어요?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: () => void logout() },
    ]);
  };

  const onWithdraw = () => {
    Alert.alert(
      '회원 탈퇴',
      '계정과 관심 종목 데이터가 바로 삭제되고 복구할 수 없어요. 정말 탈퇴하시겠어요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '탈퇴하기',
          style: 'destructive',
          onPress: () =>
            void withdraw().catch(() => setError('탈퇴 처리에 실패했어요. 잠시 후 다시 시도해주세요.')),
        },
      ],
    );
  };

  useEffect(() => {
    api
      .settings()
      .then(res => setSettings(res.data))
      .catch(() => setError('설정을 불러오지 못했어요. 서버 연결을 확인해주세요.'));
  }, []);

  const updateInterval = async (intervalMinutes: CollectSettings['intervalMinutes']) => {
    const prev = settings;
    setSettings({ intervalMinutes });
    try {
      const res = await api.updateSettings({ intervalMinutes });
      setSettings(res.data);
      setError(null);
    } catch (e) {
      setSettings(prev);
      setError(e instanceof Error ? e.message : '설정을 바꾸지 못했어요.');
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>설정</Text>

      {/* 계정 (회원정보 · 로그아웃 · 탈퇴) */}
      <View style={{ gap: spacing.sm }}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>계정</Text>
        <Card style={{ gap: spacing.md }}>
          <View style={styles.accountRow}>
            <View
              style={[styles.avatar, { backgroundColor: colors.surface }]}
            >
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {user ? user.nickname.slice(0, 1) : '?'}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700' }}>
                {user ? user.nickname : '-'}
              </Text>
              <Text style={{ color: colors.textDisabled, fontSize: 11 }}>
                {user
                  ? `${PROVIDER_LABELS[user.provider]} 로그인 · 가입 ${user.createdAt.slice(0, 10)}`
                  : ''}
                {user && user.email ? ` · ${user.email}` : ''}
              </Text>
            </View>
          </View>
          <View style={[styles.accountActions, { borderTopColor: colors.border }]}>
            <Pressable style={styles.accountAction} onPress={onLogout}>
              <LogOut size={15} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
                로그아웃
              </Text>
            </Pressable>
            <Pressable style={styles.accountAction} onPress={onWithdraw}>
              <UserRoundX size={15} color={colors.danger} />
              <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '600' }}>
                회원 탈퇴
              </Text>
            </Pressable>
          </View>
        </Card>
      </View>

      {/* 테마 (라이트/다크/시스템) */}
      <View style={{ gap: spacing.sm }}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>화면 테마</Text>
        <Card style={styles.optionRow}>
          {THEME_OPTIONS.map(({ value, label, Icon }) => (
            <View key={value} style={styles.themeOption}>
              <Icon
                size={18}
                color={mode === value ? colors.primary : colors.textDisabled}
              />
              <Chip label={label} active={mode === value} onPress={() => setMode(value)} />
            </View>
          ))}
        </Card>
      </View>

      {/* 자동 수집 주기 (기획서 §2.1, §4 설정) */}
      <View style={{ gap: spacing.sm }}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          자동 수집 주기
        </Text>
        <Card style={{ gap: spacing.md }}>
          <View style={styles.optionWrap}>
            {ALLOWED_INTERVALS.map(interval => (
              <Chip
                key={interval}
                label={INTERVAL_LABELS[interval]}
                active={settings?.intervalMinutes === interval}
                onPress={() => void updateInterval(interval)}
              />
            ))}
            <Chip
              label="끄기"
              active={settings?.intervalMinutes === null}
              onPress={() => void updateInterval(null)}
            />
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18 }}>
            설정한 주기마다 뉴스를 모아 추천을 새로 만들어드려요. 끄더라도 홈의
            '지금 수집하기'로 언제든 직접 모을 수 있어요.
          </Text>
        </Card>
      </View>

      {/* 푸시 알림 (기획서 §3.2 — Firebase 키 설정 시 활성화) */}
      <View style={{ gap: spacing.sm }}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>알림</Text>
        <Card>
          <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 19 }}>
            관심 종목에 새 추천이 생기면 푸시로 알려드릴게요. 곧 업데이트로
            만나요!
          </Text>
        </Card>
      </View>

      {error && (
        <Card>
          <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text>
        </Card>
      )}

      {/* 면책 조항 (기획서 §6) */}
      <View style={{ gap: spacing.sm }}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>안내</Text>
        <Card>
          <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 19 }}>
            DeTok은 뉴스 데이터를 분석해 정보를 드리는 서비스예요. 투자 자문이
            아니에요. 투자 판단과 책임은 언제나 본인에게 있다는 점, 꼭
            기억해주세요.
          </Text>
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '800' },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginLeft: 4 },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 17, fontWeight: '800' },
  accountActions: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
    gap: spacing.xl,
  },
  accountAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  themeOption: { alignItems: 'center', gap: spacing.sm, flex: 1 },
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
