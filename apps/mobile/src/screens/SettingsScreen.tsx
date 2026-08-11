import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {
  ChevronRight,
  LogOut,
  Minus,
  Moon,
  MonitorSmartphone,
  Plus,
  Stars,
  Sun,
  UserRoundX,
  X,
} from 'lucide-react-native';
import type { AuthProvider, CollectSettings } from '@daily-stocks/shared';
import { ALLOWED_INTERVALS } from '@daily-stocks/shared';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Card, Chip } from '../components/ui';
import { useTheme, type ThemeMode } from '../theme/ThemeContext';
import { spacing } from '../theme/tokens';

/**
 * 개발용 갤러리 — __DEV__ 가 false 인 릴리스 빌드에서는 이 분기가 통째로 제거되므로
 * require 도 함께 사라진다. 정적 import 로 두면 렌더를 막아도 모듈은 번들에 남는다. (리뷰 L-8)
 */
const MotionGallery: React.ComponentType | null = __DEV__
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../components/MotionGallery').MotionGallery
  : null;

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
  // 심야 — 어두운 곳에서 눈부심과 잔상을 줄인 따뜻한 화면 (수면 관련 표현 금지)
  { value: 'night', label: '심야', Icon: Stars },
  { value: 'system', label: '시스템', Icon: MonitorSmartphone },
];

/** 인앱 밝기 낮추기 단계 — 슬라이더 대신 프리셋 칩 (RN 기본 Slider 없음, 의존성 추가 안 함) */
const DIM_STEPS: { value: number; label: string }[] = [
  { value: 0, label: '끄기' },
  { value: 0.1, label: '10%' },
  { value: 0.2, label: '20%' },
  { value: 0.3, label: '30%' },
];

const hourLabel = (h: number): string => `${String(h).padStart(2, '0')}:00`;

/** 시각 조절 — 0~23 을 순환한다 (23 다음은 0) */
function HourStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (hour: number) => void;
}) {
  const { colors } = useTheme();
  const step = (delta: number) => onChange((value + delta + 24) % 24);

  return (
    <View style={styles.stepperRow}>
      <Text style={{ color: colors.textSecondary, fontSize: 13, flex: 1 }}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} 1시간 앞으로`}
        onPress={() => step(-1)}
        style={[styles.stepButton, { borderColor: colors.border }]}
      >
        <Minus size={14} color={colors.textPrimary} />
      </Pressable>
      <Text
        accessibilityLabel={`${label} ${value}시`}
        style={[styles.stepValue, { color: colors.textPrimary }]}
      >
        {hourLabel(value)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} 1시간 뒤로`}
        onPress={() => step(1)}
        style={[styles.stepButton, { borderColor: colors.border }]}
      >
        <Plus size={14} color={colors.textPrimary} />
      </Pressable>
    </View>
  );
}

export function SettingsScreen() {
  const { colors, mode, setMode, nightSchedule, setNightSchedule } = useTheme();
  const { user, logout, withdraw } = useAuth();
  const [settings, setSettings] = useState<CollectSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);

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
            void withdraw().catch(() =>
              setError('탈퇴 처리에 실패했어요. 잠시 후 다시 시도해주세요.'),
            ),
        },
      ],
    );
  };

  useEffect(() => {
    api
      .settings()
      .then(res => setSettings(res.data))
      .catch(() =>
        setError('설정을 불러오지 못했어요. 서버 연결을 확인해주세요.'),
      );
  }, []);

  const updateInterval = async (
    intervalMinutes: CollectSettings['intervalMinutes'],
  ) => {
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
    <ScrollView
      contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
    >
      <Text style={[styles.title, { color: colors.textPrimary }]}>설정</Text>

      {/* 계정 (회원정보 · 로그아웃 · 탈퇴) */}
      <View style={{ gap: spacing.sm }}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          계정
        </Text>
        <Card style={{ gap: spacing.md }}>
          <View style={styles.accountRow}>
            <View style={[styles.avatar, { backgroundColor: colors.surface }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {user ? user.nickname.slice(0, 1) : '?'}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: 15,
                  fontWeight: '700',
                }}
              >
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
          <View
            style={[styles.accountActions, { borderTopColor: colors.border }]}
          >
            <Pressable style={styles.accountAction} onPress={onLogout}>
              <LogOut size={15} color={colors.textSecondary} />
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 13,
                  fontWeight: '600',
                }}
              >
                로그아웃
              </Text>
            </Pressable>
            <Pressable style={styles.accountAction} onPress={onWithdraw}>
              <UserRoundX size={15} color={colors.danger} />
              <Text
                style={{
                  color: colors.danger,
                  fontSize: 13,
                  fontWeight: '600',
                }}
              >
                회원 탈퇴
              </Text>
            </Pressable>
          </View>
        </Card>
      </View>

      {/* 테마 (라이트/다크/심야/시스템) */}
      <View style={{ gap: spacing.sm }}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          화면 테마
        </Text>
        <Card style={styles.optionRow}>
          {THEME_OPTIONS.map(({ value, label, Icon }) => (
            <View key={value} style={styles.themeOption}>
              <Icon
                size={18}
                color={mode === value ? colors.primary : colors.textDisabled}
              />
              <Chip
                label={label}
                active={mode === value}
                onPress={() => setMode(value)}
              />
            </View>
          ))}
        </Card>

        {/* 심야 관련 옵션 — 라이트 사용자에게는 무의미하므로 접는다 (디자이너 스펙 §2-4) */}
        {mode !== 'light' && (
          <Card style={{ gap: spacing.lg }}>
            {mode === 'night' ? (
              <View style={styles.switchRow}>
                <Stars size={16} color={colors.primary} />
                <Text
                  style={[styles.rowLabelGrow, { color: colors.textPrimary }]}
                >
                  항상 심야로 볼게요
                </Text>
              </View>
            ) : (
              <View style={{ gap: spacing.md }}>
                <View style={styles.switchRow}>
                  <Moon size={16} color={colors.textSecondary} />
                  <Text
                    style={[styles.rowLabelGrow, { color: colors.textPrimary }]}
                  >
                    밤에 자동으로 심야 모드
                  </Text>
                  <Switch
                    value={nightSchedule.auto}
                    onValueChange={auto =>
                      setNightSchedule({ ...nightSchedule, auto })
                    }
                    accessibilityLabel="밤에 자동으로 심야 모드"
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.surfaceHigh}
                  />
                </View>

                {nightSchedule.auto && (
                  <View style={{ gap: spacing.sm }}>
                    <HourStepper
                      label="시작"
                      value={nightSchedule.startHour}
                      onChange={startHour =>
                        setNightSchedule({ ...nightSchedule, startHour })
                      }
                    />
                    <HourStepper
                      label="종료"
                      value={nightSchedule.endHour}
                      onChange={endHour =>
                        setNightSchedule({ ...nightSchedule, endHour })
                      }
                    />
                    {nightSchedule.startHour === nightSchedule.endHour && (
                      <Text style={[styles.caption, { color: colors.warning }]}>
                        시작과 종료가 같으면 자동으로 바뀌지 않아요.
                      </Text>
                    )}
                  </View>
                )}

                <Text style={[styles.caption, { color: colors.textSecondary }]}>
                  어두운 곳에서 눈부심과 잔상을 줄여요. 설정한 시각 사이에만
                  화면을 따뜻한 색으로 바꿔드릴게요.
                </Text>
              </View>
            )}

            {/* 밝기 — 색온도보다 실효가 큰 조정 (디자이너 스펙 §2-3) */}
            <View style={{ gap: spacing.sm }}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
                화면 밝기 낮추기
              </Text>
              <View style={styles.optionWrap}>
                {DIM_STEPS.map(({ value, label }) => (
                  <Chip
                    key={label}
                    label={label}
                    active={nightSchedule.dim === value}
                    onPress={() =>
                      setNightSchedule({ ...nightSchedule, dim: value })
                    }
                  />
                ))}
              </View>
              <Text style={[styles.caption, { color: colors.textSecondary }]}>
                심야 화면일 때 화면 전체를 조금 더 어둡게 해요.
              </Text>
            </View>
          </Card>
        )}
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
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 12,
              lineHeight: 18,
            }}
          >
            설정한 주기마다 뉴스를 모아 추천을 새로 만들어드려요. 끄더라도 홈의
            '지금 수집하기'로 언제든 직접 모을 수 있어요.
          </Text>
        </Card>
      </View>

      {/* 푸시 알림 (기획서 §3.2 — Firebase 키 설정 시 활성화) */}
      <View style={{ gap: spacing.sm }}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          알림
        </Text>
        <Card>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 12,
              lineHeight: 19,
            }}
          >
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
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          안내
        </Text>
        <Card>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 12,
              lineHeight: 19,
            }}
          >
            DeTok은 뉴스 데이터를 분석해 정보를 드리는 서비스예요. 투자 자문이
            아니에요. 투자 판단과 책임은 언제나 본인에게 있다는 점, 꼭
            기억해주세요.
          </Text>
        </Card>
      </View>

      {/* 개발용 — MotionGallery 는 __DEV__ 일 때만 require 하므로 릴리스 번들에 들어가지 않는다 */}
      {__DEV__ && MotionGallery && (
        <>
          <Pressable
            accessibilityRole="button"
            onPress={() => setGalleryOpen(true)}
            style={styles.devRow}
          >
            <Text style={[styles.devLabel, { color: colors.textTertiary }]}>
              모션 갤러리 (개발용)
            </Text>
            <ChevronRight size={14} color={colors.textTertiary} />
          </Pressable>

          <Modal
            visible={galleryOpen}
            animationType="slide"
            onRequestClose={() => setGalleryOpen(false)}
          >
            <MotionGallery />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="닫기"
              onPress={() => setGalleryOpen(false)}
              style={[styles.devClose, { backgroundColor: colors.surfaceHigh }]}
            >
              <X size={20} color={colors.textPrimary} />
            </Pressable>
          </Modal>
        </>
      )}
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
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  /** 행 안에서 스위치를 오른쪽 끝으로 미는 라벨 */
  rowLabelGrow: { flex: 1, fontSize: 14, fontWeight: '600' },
  rowLabel: { fontSize: 14, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 18 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    width: 64,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  devRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minHeight: 44,
  },
  devLabel: { fontSize: 12 },
  devClose: {
    position: 'absolute',
    top: 52,
    right: spacing.xl,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
