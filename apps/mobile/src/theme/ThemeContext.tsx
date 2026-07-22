import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, type ThemeColors } from './tokens';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'detok.themeMode';
const MODES: ThemeMode[] = ['light', 'dark', 'system'];

interface ThemeValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** system 모드를 해석한 실제 스킴 */
  scheme: 'light' | 'dark';
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  // 저장된 테마 모드 복원 (앱 재시작 후에도 유지)
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(saved => {
        if (saved && MODES.includes(saved as ThemeMode)) {
          setModeState(saved as ThemeMode);
        }
      })
      .catch(() => {
        // 복원 실패 시 기본값(system) 유지
      });
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const scheme =
      mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;
    const setMode = (next: ThemeMode) => {
      setModeState(next);
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
        // 저장 실패해도 현재 세션 동작에는 영향 없음
      });
    };
    return {
      mode,
      setMode,
      scheme,
      colors: scheme === 'dark' ? darkColors : lightColors,
    };
  }, [mode, systemScheme]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme은 ThemeProvider 안에서만 사용할 수 있습니다.');
  return ctx;
}
