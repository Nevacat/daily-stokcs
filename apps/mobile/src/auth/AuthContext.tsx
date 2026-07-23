import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthResponse, UserProfile } from '@daily-stocks/shared';
import { api, setAuthToken } from '../api/client';

const TOKEN_KEY = 'detok.authToken';
const USER_KEY = 'detok.authUser';

interface AuthValue {
  /** null = 복원 중, false = 비로그인 */
  user: UserProfile | null | false;
  applyLogin: (response: AuthResponse) => Promise<void>;
  logout: () => Promise<void>;
  withdraw: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<UserProfile | null | false>(null);

  // 저장된 세션 복원
  useEffect(() => {
    (async () => {
      try {
        const [token, savedUser] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (token && savedUser) {
          setAuthToken(token);
          setUser(JSON.parse(savedUser) as UserProfile);
        } else {
          setUser(false);
        }
      } catch {
        setUser(false);
      }
    })();
  }, []);

  const value = useMemo<AuthValue>(() => {
    const clear = async () => {
      setAuthToken(null);
      setUser(false);
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem(USER_KEY);
    };
    return {
      user,
      applyLogin: async ({ token, user: profile }) => {
        setAuthToken(token);
        setUser(profile);
        await AsyncStorage.setItem(TOKEN_KEY, token);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(profile));
      },
      logout: clear,
      withdraw: async () => {
        await api.withdraw();
        await clear();
      },
    };
  }, [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서만 사용할 수 있습니다.');
  return ctx;
}
