import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  useAnimatedRef,
  useDerivedValue,
  useScrollOffset,
  useSharedValue,
} from 'react-native-reanimated';
import type { PriceChart, SentimentTrend } from '@daily-stocks/shared';
import { useTheme, type ThemeMode } from '../theme/ThemeContext';
import { radius, spacing } from '../theme/tokens';
import { AuroraBackground } from './AuroraBackground';
import { PriceChartCard } from './PriceChartCard';
import { ScoreRing } from './ScoreRing';
import { Skeleton, SkeletonCard } from './Skeleton';
import { TiltCard } from './TiltCard';
import { TrendChart } from './TrendChart';
import { Card, Chip } from './ui';
import {
  Stagger,
  setForceReducedMotion,
  useMotionReduced,
  useTabAccent,
  useTabIconPop,
} from './motion';

/**
 * 개발용 모션/3D 갤러리 — 프로덕션 탭에 넣지 말 것.
 * 통합 담당자가 임시로 띄워 시뮬레이터에서 눈으로 검증한다.
 *
 * 확인 포인트
 *  - 오로라가 카드보다 밝아지지 않는가 (엘리베이션 역전)
 *  - TiltCard: **아무것도 안 해도 기울어 있다**(림이 사다리꼴). 스크롤하면 각도가 흐른다.
 *  - TiltCard: 길게 누른 뒤 드래그 → 판과 전경이 서로 다른 속도로 기운다
 *  - reduce motion 토글: TiltCard 는 평면 카드로, 카운트업은 최종값으로 점프
 */

// 모듈 스코프 — 렌더마다 새 객체를 만들면 차트가 매번 다시 그려진다
const SAMPLE_TREND: SentimentTrend = {
  target: { ticker: '005930' },
  days: [
    { date: '2026-08-05', positive: 3, negative: 1, neutral: 2 },
    { date: '2026-08-06', positive: 5, negative: 0, neutral: 1 },
    { date: '2026-08-07', positive: 2, negative: 4, neutral: 3 },
    { date: '2026-08-08', positive: 0, negative: 0, neutral: 0 },
    { date: '2026-08-09', positive: 6, negative: 2, neutral: 1 },
    { date: '2026-08-10', positive: 4, negative: 3, neutral: 2 },
    { date: '2026-08-11', positive: 7, negative: 1, neutral: 0 },
  ],
};

const SAMPLE_CHART: PriceChart = {
  ticker: '005930',
  currency: 'KRW',
  range: '1d',
  previousClose: 73900,
  points: Array.from({ length: 40 }, (_, i) => ({
    t: new Date(Date.UTC(2026, 7, 11, 0, i * 10)).toISOString(),
    price:
      73900 + Math.round(Math.sin(i / 5) * 900 + i * 22 + (i % 3) * 60 - 90),
  })),
};

const THEME_MODES: { mode: ThemeMode; label: string }[] = [
  { mode: 'dark', label: '다크' },
  { mode: 'night', label: '심야' },
  { mode: 'light', label: '라이트' },
];

const TAB_LABELS = ['홈', '뉴스', '기록', '설정'];
const TAB_WIDTH = 76;
const ACCENT_WIDTH = 28;
const ACCENT_HEIGHT = 2;

const TILT_W = 280;
const TILT_H = 150;

export function MotionGallery() {
  const { colors, mode, setMode } = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const reduced = useMotionReduced();
  const [sentiment, setSentiment] = useState<'positive' | 'negative'>(
    'positive',
  );
  const [tab, setTab] = useState(0);
  // 진입 애니메이션을 다시 보려면 키를 바꿔 리마운트한다
  const [replay, setReplay] = useState(0);

  // 틸트 카드 스크롤 연동 — HomeScreen 이 할 배선과 같은 형태다.
  // 오프셋과 카드 y 만 shared value 로 들고 각도 계산은 전부 worklet (JS 왕복 0).
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollOffset(scrollRef);
  const tiltCardY = useSharedValue(0);
  const tiltProgress = useDerivedValue(() => {
    const half = screenHeight / 2;
    const offset = tiltCardY.value + TILT_H / 2 - scrollY.value - half;
    return Math.max(-1, Math.min(1, offset / half));
  });

  const counts =
    sentiment === 'positive'
      ? { positive: 24, negative: 6, neutral: 12 }
      : { positive: 5, negative: 27, neutral: 10 };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuroraBackground {...counts} />

      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
      >
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          모션 · 3D 갤러리
        </Text>
        <Text style={[styles.caption, { color: colors.textTertiary }]}>
          개발용 화면이에요. 값은 전부 가짜예요.
        </Text>

        <View style={styles.row}>
          {THEME_MODES.map(t => (
            <Chip
              key={t.mode}
              label={t.label}
              active={mode === t.mode}
              onPress={() => setMode(t.mode)}
            />
          ))}
        </View>

        <View style={styles.row}>
          <Chip
            label={reduced ? '동작 줄이기 ON' : '동작 줄이기 OFF'}
            active={reduced}
            onPress={() => setForceReducedMotion(!reduced)}
          />
          <Chip
            label="다시 재생"
            active={false}
            onPress={() => setReplay(n => n + 1)}
          />
        </View>

        <Section title="A. 오로라 배경 (Skia SkSL)" colors={colors}>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            blob 3개의 세기가 오늘 뉴스의 호재·악재·중립 비율이에요. 라이트
            테마에서는 렌더하지 않아요.
          </Text>
          <View style={styles.row}>
            <Chip
              label="호재 우세"
              active={sentiment === 'positive'}
              onPress={() => setSentiment('positive')}
            />
            <Chip
              label="악재 우세"
              active={sentiment === 'negative'}
              onPress={() => setSentiment('negative')}
            />
          </View>
        </Section>

        <Section title="D. 3D 틸트 카드 (Skia 원근, 상시)" colors={colors}>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            손대지 않아도 3.15° 기울어 있어요 — 테두리가 사다리꼴로 꺾인 걸
            보세요. 스크롤하면 각도와 광택이 흘러요. 길게 누른 뒤(0.18초)
            드래그하면 더 크게 기울고, 손을 떼면 원래 기울기로 돌아와요.
          </Text>
          <View
            onLayout={e => {
              tiltCardY.value = e.nativeEvent.layout.y;
            }}
          >
            <TiltCard
              key={`tilt-${replay}`}
              width={TILT_W}
              height={TILT_H}
              scrollProgress={tiltProgress}
            >
              <View style={styles.tiltInner}>
                <View style={styles.tiltText}>
                  <Text style={[styles.stock, { color: colors.textPrimary }]}>
                    삼성전자
                  </Text>
                  <Text style={[styles.body, { color: colors.textSecondary }]}>
                    긍정 뉴스가 많아요
                  </Text>
                </View>
                <ScoreRing score={88} />
              </View>
            </TiltCard>
          </View>
        </Section>

        <Section title="F. 점수 링 + 카운트업" colors={colors}>
          <View style={styles.ringRow} key={`ring-${replay}`}>
            <ScoreRing score={88} />
            <ScoreRing score={72} />
            <ScoreRing score={41} />
            <ScoreRing score={95} size={96} />
          </View>
        </Section>

        <Section title="B. 카드 진입 stagger + 프레스" colors={colors}>
          <View style={styles.stack} key={`stagger-${replay}`}>
            {[0, 1, 2, 3].map(i => (
              <Stagger key={i} index={i}>
                <Card onPress={() => {}}>
                  <Text style={{ color: colors.textPrimary }}>
                    추천 카드 {i + 1} — 눌러서 프레스 피드백 확인
                  </Text>
                </Card>
              </Stagger>
            ))}
          </View>
        </Section>

        <Section title="G. 스켈레톤 shimmer" colors={colors}>
          <View style={styles.stack} key={`skeleton-${replay}`}>
            <SkeletonCard index={0} />
            <SkeletonCard index={1} />
            <Skeleton height={12} index={2} />
          </View>
        </Section>

        <Section title="M. 감성 트렌드 바" colors={colors}>
          <Card>
            <TrendChart key={`trend-${replay}`} trend={SAMPLE_TREND} />
          </Card>
        </Section>

        <Section title="L. 주가 차트 드로우온 + 크로스헤어" colors={colors}>
          <PriceChartCard
            key={`chart-${replay}`}
            ticker="005930"
            previewChart={SAMPLE_CHART}
          />
        </Section>

        <Section title="J. 하단 탭 액센트" colors={colors}>
          <View
            style={[styles.tabBar, { backgroundColor: colors.backgroundSoft }]}
          >
            {/* 가로로 미끄러지는 알약 대신, 탭마다 제자리에서 켜지는 2px 액센트 */}
            {TAB_LABELS.map((label, i) => (
              <TabAccent
                key={`accent-${label}`}
                left={i * TAB_WIDTH + (TAB_WIDTH - ACCENT_WIDTH) / 2}
                active={tab === i}
              />
            ))}
            {TAB_LABELS.map((label, i) => (
              <TabItem
                key={label}
                label={label}
                active={tab === i}
                onPress={() => setTab(i)}
              />
            ))}
          </View>
        </Section>

        <View style={styles.footer} />
      </Animated.ScrollView>
    </View>
  );
}

/** 제자리에서 켜지고 꺼지는 액센트 바 — 가로 이동이 없다 */
function TabAccent({ left, active }: { left: number; active: boolean }) {
  const { colors } = useTheme();
  const style = useTabAccent(active);
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.accent, { left, backgroundColor: colors.primary }, style]}
    />
  );
}

function TabItem({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const pop = useTabIconPop(active);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[styles.tabItem, { width: TAB_WIDTH }]}
    >
      <Animated.Text
        style={[
          pop,
          {
            color: active ? colors.primary : colors.textDisabled,
            fontWeight: active ? '700' : '500',
            fontSize: 13,
          },
        ]}
      >
        {label}
      </Animated.Text>
    </Pressable>
  );
}

function Section({
  title,
  colors,
  children,
}: React.PropsWithChildren<{
  title: string;
  colors: { textPrimary: string };
}>) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.xl, paddingTop: 64, gap: spacing.lg },
  title: { fontSize: 22, fontWeight: '800' },
  caption: { fontSize: 12 },
  body: { fontSize: 13, lineHeight: 20 },
  stock: { fontSize: 17, fontWeight: '700' },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  stack: { gap: spacing.md },
  section: { gap: spacing.md, marginTop: spacing.lg },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  tiltInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  tiltText: { flex: 1, gap: spacing.xs },
  tabBar: {
    flexDirection: 'row',
    borderRadius: radius.card,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
  },
  accent: {
    position: 'absolute',
    top: 0,
    width: ACCENT_WIDTH,
    height: ACCENT_HEIGHT,
    borderRadius: ACCENT_HEIGHT / 2,
  },
  tabItem: { alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  footer: { height: 80 },
});
