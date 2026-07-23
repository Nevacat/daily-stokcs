import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { History, Home, Newspaper, Settings } from 'lucide-react-native';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { CatalogProvider } from './catalog/CatalogContext';
import { ThemeProvider, useTheme } from './theme/ThemeContext';
import { spacing } from './theme/tokens';
import { HistoryScreen } from './screens/HistoryScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LoginScreen } from './screens/LoginScreen';
import { NewsScreen } from './screens/NewsScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { SettingsScreen } from './screens/SettingsScreen';

type Tab = 'home' | 'news' | 'history' | 'settings';

const TABS: { key: Tab; label: string; Icon: typeof Home }[] = [
  { key: 'home', label: '홈', Icon: Home },
  { key: 'news', label: '뉴스', Icon: Newspaper },
  { key: 'history', label: '히스토리', Icon: History },
  { key: 'settings', label: '설정', Icon: Settings },
];

const ONBOARDING_KEY = 'detok.onboarded';

function Shell() {
  const { colors, scheme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('home');
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

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
    <View style={{ flex: 1, backgroundColor: colors.backgroundSoft }}>
      <StatusBar
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.backgroundSoft}
      />
      <View style={{ flex: 1, paddingTop: insets.top }}>
        {tab === 'home' && <HomeScreen />}
        {tab === 'news' && <NewsScreen />}
        {tab === 'history' && <HistoryScreen />}
        {tab === 'settings' && <SettingsScreen />}
      </View>

      {/* 하단 탭 바 (기획서 §4 IA — 히스토리 탭은 Phase 2) */}
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, spacing.sm),
          },
        ]}
      >
        {TABS.map(({ key, label, Icon }) => {
          const active = tab === key;
          const color = active ? colors.primary : colors.textDisabled;
          return (
            <Pressable key={key} style={styles.tabItem} onPress={() => setTab(key)}>
              <Icon size={22} color={color} strokeWidth={active ? 2.4 : 2} />
              <Text style={{ color, fontSize: 11, fontWeight: active ? '700' : '500' }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function AppRoot() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <CatalogProvider>
            <Shell />
          </CatalogProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 3 },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
