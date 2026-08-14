import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/tokens';
import { useMotionReduced } from './motion';

/**
 * 추천 점수 링 게이지 + 숫자 카운트업 (디자이너 스펙 PROMPT 4, 모션 표 F).
 *
 * 링은 정면 2D 를 유지한다 — 기울이면 호 길이가 원근으로 왜곡되는데
 * 그 호 길이가 바로 사용자가 읽는 값이다. 여기서의 3D 는 정보를 훼손한다.
 *
 * Skia 가 아니라 react-native-svg 로 그린다: 52px 고정 지오메트리 호 하나에
 * 카드마다 네이티브 서피스를 하나씩 붙일 이유가 없다 (Canvas 남발은 RAM 크래시 원인).
 */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * 점수는 '방향'이 아니므로 up(빨강)/down(파랑) 체계를 빌려오면 안 된다.
 * 80점 이상 액센트, 60점 이상 바이올렛, 그 아래는 중립 텍스트색.
 */
const bandColor = (score: number, c: ThemeColors): string =>
  score >= 80 ? c.primary : score >= 60 ? c.violet : c.textTertiary;

export function ScoreRing({
  score,
  size = 52,
  animate = true,
}: {
  /** 0~100 */
  score: number;
  size?: number;
  /** 뷰포트에 처음 들어왔을 때만 true 로 주면 된다 */
  animate?: boolean;
}) {
  const { colors } = useTheme();
  const reduced = useMotionReduced();

  const safeScore = Math.max(0, Math.min(100, Math.round(score)));
  const strokeWidth = size >= 80 ? 6 : 4;
  const r = (size - strokeWidth) / 2;
  const circumference = useMemo(() => 2 * Math.PI * r, [r]);

  // reduce motion 이면 최종값으로 즉시 점프한다 — 없애는 게 아니라 건너뛴다.
  const shouldTween = animate && !reduced;
  const value = useSharedValue(shouldTween ? 0 : safeScore);

  useEffect(() => {
    if (!shouldTween) {
      value.value = safeScore;
      return;
    }
    value.value = withTiming(safeScore, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
  }, [safeScore, shouldTween, value]);

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - value.value / 100),
  }));

  // 숫자는 JS 상태로 그린다.
  // AnimatedTextInput 의 네이티브 `text` prop 트릭은 New Architecture(Fabric)에서
  // 전달되지 않아 숫자가 0 에 멈춘다 — 시뮬레이터에서 실제로 확인했다.
  // 반응은 반올림된 정수가 바뀔 때만 돌므로 700ms 동안 최대 score 회(≤100)다.
  const [shown, setShown] = useState(shouldTween ? 0 : safeScore);
  useAnimatedReaction(
    () => Math.round(value.value),
    (next, prev) => {
      if (next !== prev) runOnJS(setShown)(next);
    },
    [],
  );

  const color = bandColor(safeScore, colors);

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`추천 점수 ${safeScore}점 (100점 만점)`}
    >
      <Svg width={size} height={size}>
        {/* 트랙 */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* 진행 — 12시 방향에서 시계방향 */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animatedProps={ringProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Text
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={[
            styles.number,
            {
              color,
              fontSize: Math.round(size * 0.31),
              lineHeight: size,
            },
          ]}
        >
          {shown}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  number: {
    flex: 1,
    padding: 0,
    textAlign: 'center',
    fontWeight: '800',
    // 카운트업 중 자릿수가 흔들리지 않게 고정폭 숫자를 쓴다
    fontVariant: ['tabular-nums'],
  },
});
