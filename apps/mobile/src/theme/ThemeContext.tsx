import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themes, type ThemeColors, type ThemeName } from './tokens';

/** 사용자 의도. 실제로 렌더되는 테마(ThemeName)와 분리한다 — "심야를 켜둔 채 낮에는 다크"를 표현해야 한다. */
export type ThemeMode = 'light' | 'dark' | 'night' | 'system';

export interface NightSchedule {
  /** 자동 전환 on/off */
  auto: boolean;
  /** KST 기준 시작 시(0~23) */
  startHour: number;
  /** KST 기준 종료 시(0~23) */
  endHour: number;
  /** 인앱 밝기 오버레이 0~0.35 */
  dim: number;
}

export const DEFAULT_NIGHT_SCHEDULE: NightSchedule = {
  auto: true,
  startHour: 23,
  endHour: 6,
  dim: 0,
};

const MODE_KEY = 'detok.themeMode';
const NIGHT_KEY = 'detok.nightSchedule';
const NOTICE_KEY = 'detok.nightNotice';
const MODES: ThemeMode[] = ['light', 'dark', 'night', 'system'];

/** 첫 전환 안내 노출 시간. 되돌리기 버튼이 달려 있어 스펙의 3초보다 길게 준다. */
const NOTICE_MS = 6_000;

/**
 * 자정을 넘는 구간(23→6)을 정확히 다룬다.
 * start < end  → 같은 날 안의 구간   (예: 1~5시)
 * start > end  → 자정을 넘는 구간     (예: 23~6시)
 * start = end  → 구간 없음 (24시간 전체로 해석하지 않는다)
 */
export const inNightWindow = (
  hour: number,
  start: number,
  end: number,
): boolean =>
  start === end
    ? false
    : start < end
      ? hour >= start && hour < end
      : hour >= start || hour < end;

/**
 * KST 시(hour) 추출 — Intl 을 쓰지 않는다.
 * Intl.DateTimeFormat 은 Android Hermes 빌드에 따라 "18" 이 아닌 형태를 돌려줄 수 있고,
 * 그러면 Number(...) 가 NaN 이 되어 심야 전환이 크래시 없이 조용히 멈춘다. (리뷰 L-7)
 * KST(UTC+9)는 서머타임이 없으므로 산술 변환이 항상 정확하다.
 * (Invalid Date 만 NaN 이 되고, 그 경우 inNightWindow 가 false 라 자동 전환을 시도하지 않는다.)
 */
export const kstHour = (d: Date): number =>
  (((Math.floor(d.getTime() / 3_600_000) + 9) % 24) + 24) % 24;

/**
 * 심야 구간 하나를 가리키는 id (YYYY-MM-DD).
 * 23:00~06:00 처럼 자정을 넘는 구간도 종료 시각만큼 뒤로 당기면 한 날짜로 접힌다.
 * "오늘은 그대로"와 첫 전환 안내가 '그날 밤' 단위로 동작하려면 이 키가 필요하다.
 */
export const nightSessionId = (now: Date, endHour: number): string =>
  new Date(now.getTime() + (9 - endHour) * 3_600_000)
    .toISOString()
    .slice(0, 10);

/**
 * mode + 스케줄 + 시스템 스킴 → 실제 렌더 테마.
 * snoozed = 사용자가 이번 밤은 "오늘은 그대로"를 눌렀다 (다음 밤에는 다시 전환된다).
 */
export function resolveTheme(
  mode: ThemeMode,
  sched: NightSchedule,
  systemScheme: 'light' | 'dark',
  now: Date,
  snoozed = false,
): ThemeName {
  if (mode === 'night') return 'night'; // 수동 고정 — 시간과 무관
  if (mode === 'light') return 'light'; // 라이트는 심야 자동 전환 대상이 아니다
  const base: ThemeName = mode === 'system' ? systemScheme : 'dark';
  if (base === 'light') return 'light';
  return sched.auto &&
    !snoozed &&
    inNightWindow(kstHour(now), sched.startHour, sched.endHour)
    ? 'night'
    : 'dark';
}

/** 저장된 JSON은 신뢰하지 않는다 (구버전·손상 대비) */
function parseSchedule(raw: string | null): NightSchedule | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<NightSchedule>;
    const hour = (n: unknown, fallback: number): number =>
      typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 23
        ? n
        : fallback;
    return {
      auto: typeof v.auto === 'boolean' ? v.auto : DEFAULT_NIGHT_SCHEDULE.auto,
      startHour: hour(v.startHour, DEFAULT_NIGHT_SCHEDULE.startHour),
      endHour: hour(v.endHour, DEFAULT_NIGHT_SCHEDULE.endHour),
      dim:
        typeof v.dim === 'number' && v.dim >= 0 && v.dim <= 0.35
          ? v.dim
          : DEFAULT_NIGHT_SCHEDULE.dim,
    };
  } catch {
    return null;
  }
}

/** 첫 전환 안내·"오늘은 그대로" 상태. id = 그 밤을 가리키는 nightSessionId */
interface NightNotice {
  id: string;
  snoozed: boolean;
}

const NO_NOTICE: NightNotice = { id: '', snoozed: false };

function parseNotice(raw: string | null): NightNotice | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<NightNotice>;
    return typeof v.id === 'string'
      ? { id: v.id, snoozed: v.snoozed === true }
      : null;
  } catch {
    return null;
  }
}

interface ThemeValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  nightSchedule: NightSchedule;
  setNightSchedule: (next: NightSchedule) => void;
  /** 실제 렌더 테마 (light | dark | night) */
  theme: ThemeName;
  /** 하위호환 — night 는 어두운 테마이므로 'dark' 로 접힌다 (StatusBar barStyle 등) */
  scheme: 'light' | 'dark';
  /** dark 또는 night */
  isDark: boolean;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  // 팀장 요구: 기본은 다크. 저장값이 없을 때만 적용된다.
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [nightSchedule, setNightScheduleState] = useState<NightSchedule>(
    DEFAULT_NIGHT_SCHEDULE,
  );
  // 지금 시각. 이 값이 바뀔 때만 테마를 다시 판정한다 (1초 폴링 금지).
  const [now, setNow] = useState(() => new Date());
  // null = 아직 복원 전. 복원 전에 안내를 띄우면 이미 본 밤에 또 뜬다.
  const [notice, setNotice] = useState<NightNotice | null>(null);
  const [noticeVisible, setNoticeVisible] = useState(false);
  // 사용자가 이미 고른 뒤에는 늦게 도착한 복원값이 덮어쓰지 않도록
  const userChosen = useRef(false);

  // 저장된 모드·스케줄·안내 상태 복원 (앱 재시작 후에도 유지)
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(MODE_KEY),
      AsyncStorage.getItem(NIGHT_KEY),
      AsyncStorage.getItem(NOTICE_KEY),
    ])
      .then(([savedMode, savedNight, savedNotice]) => {
        setNotice(parseNotice(savedNotice) ?? NO_NOTICE);
        if (userChosen.current) return;
        if (savedMode && MODES.includes(savedMode as ThemeMode)) {
          setModeState(savedMode as ThemeMode);
        }
        const sched = parseSchedule(savedNight);
        if (sched) setNightScheduleState(sched);
      })
      .catch(() => {
        // 복원 실패 시 기본값(dark / 23~06 자동) 유지
        setNotice(NO_NOTICE);
      });
  }, []);

  // 경계 갱신 ①: 다음 정시까지 setTimeout 한 번. 밤새 매분 리렌더하지 않는다.
  // ponytail: 정확한 다음 경계(startHour/endHour) 대신 정시 틱을 쓴다 — 시 단위 판정이라
  //           결과가 같고 코드가 3줄이다. 분 단위 스케줄이 필요해지면 그때 정밀화한다.
  useEffect(() => {
    const msToNextHour = 3_600_000 - (now.getTime() % 3_600_000);
    const timer = setTimeout(() => setNow(new Date()), msToNextHour + 1_000);
    return () => clearTimeout(timer);
  }, [now]);

  // 경계 갱신 ②: 백그라운드에 있는 동안 경계를 넘었을 수 있다.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') setNow(new Date());
    });
    return () => sub.remove();
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    userChosen.current = true;
    setModeState(next);
    setNow(new Date());
    AsyncStorage.setItem(MODE_KEY, next).catch(() => {
      // 저장 실패해도 현재 세션 동작에는 영향 없음
    });
  }, []);

  const setNightSchedule = useCallback((next: NightSchedule) => {
    userChosen.current = true;
    setNightScheduleState(next);
    setNow(new Date());
    AsyncStorage.setItem(NIGHT_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const sessionId = nightSessionId(now, nightSchedule.endHour);
  const snoozed = notice?.snoozed === true && notice.id === sessionId;
  const theme = resolveTheme(
    mode,
    nightSchedule,
    systemScheme === 'dark' ? 'dark' : 'light',
    now,
    snoozed,
  );

  /** 그 밤의 안내 상태를 확정하고 저장한다 */
  const markNotice = useCallback((next: NightNotice) => {
    setNotice(next);
    AsyncStorage.setItem(NOTICE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  // 디자이너 스펙 §2-2 — 자동으로 심야가 된 첫 순간에 되돌리기 안내를 띄운다.
  // (수동으로 '심야'를 고른 경우는 사용자가 이미 알고 있으므로 띄우지 않는다)
  useEffect(() => {
    if (!notice || theme !== 'night' || mode === 'night') return;
    if (notice.id === sessionId) return; // 이번 밤은 이미 안내했다
    markNotice({ id: sessionId, snoozed: false });
    setNoticeVisible(true);
  }, [notice, theme, mode, sessionId, markNotice]);

  // 자동 숨김은 별도 효과로 분리한다 — 위 효과에 두면 markNotice 재실행이 타이머를 지운다
  useEffect(() => {
    if (!noticeVisible) return;
    const timer = setTimeout(() => setNoticeVisible(false), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [noticeVisible]);

  const keepTonight = useCallback(() => {
    setNoticeVisible(false);
    markNotice({ id: sessionId, snoozed: true });
  }, [markNotice, sessionId]);

  const value = useMemo<ThemeValue>(() => {
    return {
      mode,
      setMode,
      nightSchedule,
      setNightSchedule,
      theme,
      scheme: theme === 'light' ? 'light' : 'dark',
      isDark: theme !== 'light',
      colors: themes[theme],
    };
  }, [mode, nightSchedule, theme, setMode, setNightSchedule]);

  const c = themes[theme];

  return (
    <ThemeContext.Provider value={value}>
      <View style={styles.root}>
        {children}

        {/* 인앱 밝기 낮추기 — 심야 화면에서만 적용한다 (설정에서 0~30%) */}
        {theme === 'night' && nightSchedule.dim > 0 && (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: c.background, opacity: nightSchedule.dim },
            ]}
          />
        )}

        {noticeVisible && (
          <View pointerEvents="box-none" style={styles.noticeWrap}>
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={[
                styles.notice,
                { backgroundColor: c.surfaceHigh, borderColor: c.border },
              ]}
            >
              <Text style={[styles.noticeText, { color: c.textPrimary }]}>
                어두운 곳에서 보기 편한 화면으로 바꿨어요
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="오늘은 그대로"
                onPress={keepTonight}
                hitSlop={8}
              >
                <Text style={[styles.noticeAction, { color: c.primary }]}>
                  오늘은 그대로
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </ThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // 탭 바 위로 띄운다
  noticeWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 96,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19 },
  noticeAction: { fontSize: 13, fontWeight: '700' },
});

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx)
    throw new Error('useTheme은 ThemeProvider 안에서만 사용할 수 있습니다.');
  return ctx;
}
