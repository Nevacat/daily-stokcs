/**
 * 심야 모드 시간대 판정 — 자정을 넘는 구간(23:00~06:00 KST)의 경계 검증.
 * 경계를 잘못 다루면 밤새 테마가 안 바뀌거나 낮에 앰버로 뜬다.
 */
import {
  DEFAULT_NIGHT_SCHEDULE,
  inNightWindow,
  kstHour,
  resolveTheme,
  type NightSchedule,
} from '../src/theme/ThemeContext';

/** KST 시:분 → Date (KST = UTC+9) */
const kst = (hour: number, minute = 0): Date =>
  new Date(Date.UTC(2026, 7, 11, hour - 9, minute));

const SCHED = DEFAULT_NIGHT_SCHEDULE; // 23 ~ 06, auto on

describe('kstHour — UTC 저장값을 KST 시로 변환', () => {
  it('자정은 24가 아니라 0이다 (hourCycle h23)', () => {
    expect(kstHour(kst(0, 0))).toBe(0);
    expect(kstHour(kst(0, 59))).toBe(0);
  });

  it('경계 시각을 정확히 읽는다', () => {
    expect(kstHour(kst(22, 59))).toBe(22);
    expect(kstHour(kst(23, 0))).toBe(23);
    expect(kstHour(kst(5, 59))).toBe(5);
    expect(kstHour(kst(6, 0))).toBe(6);
  });
});

describe('inNightWindow — wrap-around (23 → 6)', () => {
  it('시작 경계: 22시는 밖, 23시는 안', () => {
    expect(inNightWindow(22, 23, 6)).toBe(false);
    expect(inNightWindow(23, 23, 6)).toBe(true);
  });

  it('자정을 넘어서도 안이다', () => {
    expect(inNightWindow(0, 23, 6)).toBe(true);
    expect(inNightWindow(3, 23, 6)).toBe(true);
  });

  it('종료 경계: 5시는 안, 6시는 밖 (end는 배타적)', () => {
    expect(inNightWindow(5, 23, 6)).toBe(true);
    expect(inNightWindow(6, 23, 6)).toBe(false);
  });

  it('낮 시간은 전부 밖이다', () => {
    for (let h = 6; h < 23; h++) expect(inNightWindow(h, 23, 6)).toBe(false);
  });

  it('wrap 없는 구간(1~5)도 동일 규칙', () => {
    expect(inNightWindow(0, 1, 5)).toBe(false);
    expect(inNightWindow(1, 1, 5)).toBe(true);
    expect(inNightWindow(4, 1, 5)).toBe(true);
    expect(inNightWindow(5, 1, 5)).toBe(false);
  });

  it('start === end 는 구간 없음 (24시간 전체가 아니다)', () => {
    expect(inNightWindow(0, 23, 23)).toBe(false);
    expect(inNightWindow(23, 23, 23)).toBe(false);
  });
});

describe('resolveTheme', () => {
  it('dark 모드 + auto → 경계 22:59/23:00, 05:59/06:00 에서 전환', () => {
    expect(resolveTheme('dark', SCHED, 'dark', kst(22, 59))).toBe('dark');
    expect(resolveTheme('dark', SCHED, 'dark', kst(23, 0))).toBe('night');
    expect(resolveTheme('dark', SCHED, 'dark', kst(5, 59))).toBe('night');
    expect(resolveTheme('dark', SCHED, 'dark', kst(6, 0))).toBe('dark');
  });

  it('auto 를 끄면 밤에도 dark 를 유지한다', () => {
    const off: NightSchedule = { ...SCHED, auto: false };
    expect(resolveTheme('dark', off, 'dark', kst(2, 0))).toBe('dark');
  });

  it('light 사용자는 심야 자동 전환 대상이 아니다', () => {
    expect(resolveTheme('light', SCHED, 'dark', kst(2, 0))).toBe('light');
  });

  it('night 는 수동 고정 — 낮에도 심야', () => {
    expect(resolveTheme('night', SCHED, 'light', kst(13, 0))).toBe('night');
  });

  it('system 은 시스템 스킴을 따르되, 다크일 때만 심야로 간다', () => {
    expect(resolveTheme('system', SCHED, 'light', kst(2, 0))).toBe('light');
    expect(resolveTheme('system', SCHED, 'dark', kst(2, 0))).toBe('night');
    expect(resolveTheme('system', SCHED, 'dark', kst(13, 0))).toBe('dark');
  });
});
