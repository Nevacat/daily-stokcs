import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarDays, ChevronDown, ChevronRight } from 'lucide-react-native';
import type { StockEvent } from '@daily-stocks/shared';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';
import { spacing } from '../theme/tokens';
import { Card } from './ui';

const DAY_MS = 86_400_000;

/** KST 기준 오늘 YYYY-MM-DD — 서버가 주는 date와 같은 기준으로 맞춘다 */
const kstToday = (): string =>
  new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);

/** 'YYYY-MM-DD' → '8월 14일' */
const monthDay = (date: string): string =>
  `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;

/** 남은 날짜 — 'D-3' 같은 트레이딩 용어 대신 부드럽게 */
const remaining = (date: string): string => {
  const days = Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${kstToday()}T00:00:00Z`)) /
      DAY_MS,
  );
  return days <= 0 ? '오늘이에요' : `${days}일 뒤`;
};

/**
 * 실적·배당 예정 일정 (기획서 §3 확장).
 *
 * **여기 나오는 날짜는 전부 추정치다** — 실적은 법정 공시 기한, 배당은 지난 배당 주기에서
 * 계산한다. 확정 일정을 주는 무료 소스가 없으므로 접힘/펼침 어느 상태에서도
 * '예상 날짜' 캡션을 항상 노출한다 (확정처럼 읽히면 사용자가 실제 판단에 쓴다).
 *
 * 조회 실패 시에는 아무것도 그리지 않는다 — 일정은 부가 정보이고,
 * 실패한 섹션이 화면에 남으면 본 정보(시세·뉴스)를 가린다.
 */
export function EventTimeline({
  tickers,
  variant = 'section',
  note,
  onSelectTicker,
}: {
  /** 조회할 종목. 생략하면 관심 종목 기준(인증 필요), 빈 배열이면 빈 상태 안내 */
  tickers?: string[];
  /** 'section' = 제목 + 접힘 요약 (내 종목) / 'inline' = 한 줄 요약 (종목 상세) */
  variant?: 'section' | 'inline';
  /** 추가 안내 한 줄 (예: 미국 종목은 배당 일정만) */
  note?: string;
  /** 행 탭 시 해당 종목 상세로 — 넘기지 않으면 행은 누를 수 없다 */
  onSelectTicker?: (ticker: string) => void;
}) {
  const { colors } = useTheme();
  const [events, setEvents] = useState<StockEvent[] | null>(null);
  const [open, setOpen] = useState(false);
  const key = tickers?.join(',');

  useEffect(() => {
    let alive = true;
    // 빈 배열을 넘긴 건 '볼 종목이 없다'는 뜻이다 — 관심 종목 조회로 새지 않게 여기서 끝낸다
    if (key === '') {
      setEvents([]);
      return;
    }
    setEvents(null);
    api
      .events(key ? key.split(',') : undefined)
      .then(res => {
        if (alive) setEvents(res.data);
      })
      // 실패는 조용히 — 섹션이 통째로 안 보이는 게 잘못된 일정보다 낫다
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);

  // 로딩 중·조회 실패는 그리지 않는다
  if (events === null) return null;

  const empty = events.length === 0;
  // 종목 상세에서는 일정이 없으면 섹션 자체를 만들지 않는다 (한 줄짜리 빈 칸 방지)
  if (empty && variant === 'inline') return null;

  const first = events[0];
  const summary = empty
    ? key === ''
      ? '관심 종목을 담으면 실적·배당 일정을 미리 챙겨드릴게요.'
      : '앞으로 90일 안에 예정된 일정은 없어요.'
    : variant === 'inline'
      ? `가장 가까운 일정은 ${monthDay(first.date)} ${first.label}`
      : `앞으로 90일 안에 ${events.length}건 있어요 · 가장 가까운 건 ${monthDay(first.date)}이에요`;

  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <View style={styles.wrap}>
      {variant === 'section' && (
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          다가오는 일정
        </Text>
      )}
      <Card onPress={empty ? undefined : () => setOpen(o => !o)}>
        <View style={styles.summaryRow}>
          <CalendarDays size={16} color={colors.primary} />
          <Text style={[styles.summary, { color: colors.textSecondary }]}>
            {summary}
          </Text>
          {!empty && <Chevron size={16} color={colors.textTertiary} />}
        </View>

        {!empty && (
          <Text style={[styles.caption, { color: colors.textTertiary }]}>
            공시 기한과 지난 배당 주기로 계산한 예상 날짜예요. 정확한 일정은
            회사 공시를 꼭 확인해주세요.
          </Text>
        )}
        {!empty && note && (
          <Text style={[styles.caption, { color: colors.textTertiary }]}>
            {note}
          </Text>
        )}

        {open && (
          <View style={styles.list}>
            {events.map(event => (
              <Pressable
                key={`${event.ticker}-${event.kind}-${event.date}`}
                disabled={!onSelectTicker}
                onPress={() => onSelectTicker?.(event.ticker)}
                style={[styles.row, { borderTopColor: colors.divider }]}
              >
                <Text style={[styles.rowDate, { color: colors.textPrimary }]}>
                  {monthDay(event.date)}
                  <Text style={{ color: colors.textTertiary }}>
                    {'  '}
                    {remaining(event.date)}
                  </Text>
                </Text>
                <Text
                  style={[styles.rowLabel, { color: colors.textSecondary }]}
                  numberOfLines={2}
                >
                  {variant === 'section' ? `${event.stockName} · ` : ''}
                  {event.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  title: { fontSize: 15, fontWeight: '700', marginLeft: 4 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  summary: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 19 },
  caption: { fontSize: 11, lineHeight: 16, marginTop: 6 },
  list: { marginTop: spacing.md },
  row: {
    paddingTop: spacing.md,
    gap: 3,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowDate: { fontSize: 14, fontWeight: '700' },
  rowLabel: { fontSize: 12, lineHeight: 18 },
});
