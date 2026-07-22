import React, { useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Home, Newspaper, Settings } from 'lucide-react-native';
import { ThemeProvider, useTheme } from './theme/ThemeContext';
import { spacing } from './theme/tokens';
import { HomeScreen } from './screens/HomeScreen';
import { NewsScreen } from './screens/NewsScreen';
import { SettingsScreen } from './screens/SettingsScreen';

type Tab = 'home' | 'news' | 'settings';

const TABS: { key: Tab; label: string; Icon: typeof Home }[] = [
  { key: 'home', label: '홈', Icon: Home },
  { key: 'news', label: '뉴스', Icon: Newspaper },
  { key: 'settings', label: '설정', Icon: Settings },
];

function Shell() {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('home');

  return (
    <View style={{ flex: 1, backgroundColor: colors.backgroundSoft }}>
      <StatusBar
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.backgroundSoft}
      />
      <View style={{ flex: 1, paddingTop: insets.top }}>
        {tab === 'home' && <HomeScreen />}
        {tab === 'news' && <NewsScreen />}
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
        <Shell />
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
});
