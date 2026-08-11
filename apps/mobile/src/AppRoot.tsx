import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { History, Home, Newspaper, Settings } from 'lucide-react-native';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { CatalogProvider } from './catalog/CatalogContext';
import { useTabIconScale, useTabIndicator } from './components/motion';
import { ThemeProvider, useTheme } from './theme/ThemeContext';
import { spacing } from './theme/tokens';
import { HomeScreen } from './screens/HomeScreen';
import { LoginScreen } from './screens/LoginScreen';
import { NewsScreen } from './screens/NewsScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { RecordsScreen } from './screens/RecordsScreen';
import { SettingsScreen } from './screens/SettingsScreen';

type Tab = 'home' | 'news' | 'records' | 'settings';

const TABS: { key: Tab; label: string; Icon: typeof Home }[] = [
  { key: 'home', label: '홈', Icon: Home },
  { key: 'news', label: '뉴스', Icon: Newspaper },
  // 내 종목(모의 포트폴리오) + 추천 기록을 세그먼트로 묶은 탭
  { key: 'records', label: '기록', Icon: History },
  { key: 'settings', label: '설정', Icon: Settings },
];

const ONBOARDING_KEY = 'detok.onboarded';

/** 활성 탭 뒤 알약 인디케이터 크기 (모션 표 J) */
const INDICATOR_WIDTH = 48;
const INDICATOR_HEIGHT = 32;

/** 탭 한 칸 — 아이콘 바운스 훅을 쓰려면 map 안이 아니라 컴포넌트여야 한다 */
function TabItem({
  label,
  Icon,
  active,
  onPress,
}: {
  label: string;
  Icon: typeof Home;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const iconStyle = useTabIconScale(active);
  const color = active ? colors.primary : colors.textDisabled;

  return (
    <Pressable
      style={styles.tabItem}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <Animated.View style={iconStyle}>
        <Icon size={22} color={color} strokeWidth={active ? 2.4 : 2} />
      </Animated.View>
      <Text
        style={[styles.tabLabel, { color, fontWeight: active ? '700' : '500' }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Shell() {
  const { colors, isDark, theme, nightSchedule } = useTheme();
  // 밝기 낮추기는 심야 테마에서만 의미가 있다 — 낮에 켜두고 잊으면 화면만 어두워진다
  const dim = theme === 'night' ? nightSchedule.dim : 0;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>('home');
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  // 훅은 아래 조건부 return 보다 위에 있어야 한다
  const indicatorStyle = useTabIndicator(
    TABS.findIndex(t => t.key === tab),
    width / TABS.length,
    INDICATOR_WIDTH,
  );

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then(v => setOnboarded(v === '1'))
      .catch(() => setOnboarded(true));
  }, []);

  // 세션 복원 중 → 스플래시, 첫 실행 → 온보딩, 비로그인 → 로그인 화면
  if (user === null || onboarded === null) {
    return (
      <View style={[styles.splash, { backgroundColor: colors.backgroundSoft }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (user === false && !onboarded) {
    return (
      <OnboardingScreen
        onDone={() => {
          setOnboarded(true);
          AsyncStorage.setItem(ONBOARDING_KEY, '1').catch(() => {});
        }}
      />
    );
  }
  if (user === false) {
    return <LoginScreen />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* night 도 어두운 테마다 — isDark 로 판정해야 심야에서도 글씨가 밝게 나온다 */}
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <View style={{ flex: 1, paddingTop: insets.top }}>
        {tab === 'home' && <HomeScreen />}
        {tab === 'news' && <NewsScreen />}
        {tab === 'records' && <RecordsScreen />}
        {tab === 'settings' && <SettingsScreen />}
      </View>

      {/* 하단 탭 바 — 엘리베이션 1층: backgroundSoft + borderSubtle + 상단 이너 하이라이트 */}
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: colors.backgroundSoft,
            borderTopColor: colors.borderSubtle,
            paddingBottom: Math.max(insets.bottom, spacing.sm),
          },
        ]}
      >
        <View
          pointerEvents="none"
          style={[
            styles.innerHighlight,
            { backgroundColor: colors.innerHighlight },
          ]}
        />
        {/* 가로로 움직이는 요소는 이 알약 하나뿐이다 — 아이콘은 제자리에 있는다 */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            { backgroundColor: colors.primarySoft },
            indicatorStyle,
          ]}
        />
        {TABS.map(({ key, label, Icon }) => (
          <TabItem
            key={key}
            label={label}
            Icon={Icon}
            active={tab === key}
            onPress={() => setTab(key)}
          />
        ))}
      </View>

      {/* 심야 밝기 낮추기 — 설정의 dim 값을 실제로 적용한다.
          탭바까지 덮도록 형제 중 마지막에 둔다. 0 이면 아예 그리지 않는다. */}
      {dim > 0 && (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.dimOverlay, { opacity: dim }]}
        />
      )}
    </View>
  );
}

export function AppRoot() {
  // GestureHandlerRootView 는 제스처를 쓰는 모든 화면의 전제다
  // (TiltCard 틸트, 주가 차트 크로스헤어)
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <CatalogProvider>
              <Shell />
            </CatalogProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // 심야 밝기 낮추기 오버레이 — 불투명도만 런타임에 바뀐다
  dimOverlay: { backgroundColor: '#000000' },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
  },
  // 다크에서 그림자 대신 깊이를 만드는 상단 1px
  innerHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  indicator: {
    position: 'absolute',
    top: spacing.sm,
    left: 0,
    width: INDICATOR_WIDTH,
    height: INDICATOR_HEIGHT,
    borderRadius: 999,
  },
  // 최소 터치 타깃 48
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    gap: 3,
  },
  tabLabel: { fontSize: 11 },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
