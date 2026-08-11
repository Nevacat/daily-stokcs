import React, { useMemo, type PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  BlurMask,
  Canvas,
  Group,
  LinearGradient,
  RoundedRect,
  vec,
  type Transforms3d,
} from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';
import { motion, radius, spacing } from '../theme/tokens';
import { useMotionReduced } from './motion';
import { Card } from './ui';

/**
 * 3D 원근 틸트 카드 (디자이너 스펙 PROMPT 3, 모션 표 D).
 *
 * 왜 3D 인가: 다크에서 드롭섀도우는 대비를 못 만들어 "떠 있음"을 전달하지 못한다.
 * 원근 틸트 + 층별 오프셋 차이(패럴랙스)가 그 역할을 대신한다.
 * 지금 주목 중인 카드 하나에만 쓴다 — 리스트 전체에 쓰지 말 것.
 *
 * 판(plate)은 Skia 가 그리고, 그 위 RN 콘텐츠는 같은 shared value 로 회전한다.
 * 콘텐츠 회전량은 1.4배 — 이 차이가 곧 시차이고, 시차가 곧 깊이다.
 */

// 렌더마다 새 배열을 만들면 Skia 노드가 매 프레임 재조정된다 → 모듈 스코프 고정
const SHEEN_DARK = ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0)'];
const SHEEN_NIGHT = ['rgba(255,214,170,0.14)', 'rgba(255,214,170,0)'];
const SHEEN_LIGHT = ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)'];

/**
 * 캔버스 여백 — 기울어진 판과 그림자가 잘리지 않게 사방에 둔다.
 * 호출부가 다른 카드와 좌우를 맞추려면 이 값만큼 음수 마진을 주면 된다.
 */
export const TILT_PAD = 32;
const PAD = TILT_PAD;
const R = radius.card;
const PERSPECTIVE = 700; // ≈ 카드 폭의 2배. 작을수록 왜곡이 강하다.
const MAX_TILT = 0.28; // rad (≈16°). 더 키우면 1px 림이 계단처럼 깨진다.

export function TiltCard({
  width = 320,
  height = 168,
  children,
}: PropsWithChildren<{ width?: number; height?: number }>) {
  const { colors, theme } = useTheme();
  const reduced = useMotionReduced();

  const canvasWidth = width + PAD * 2;
  const canvasHeight = height + PAD * 2;

  const rx = useSharedValue(0);
  const ry = useSharedValue(0);

  // 제스처는 반드시 memo — 안 하면 매 렌더마다 재부착된다.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        // 카드의 탭(상세 열기)과 싸우지 않게 롱프레스 후에만 활성화한다
        .activateAfterLongPress(180)
        .onChange(e => {
          ry.value = interpolate(
            e.x,
            [0, canvasWidth],
            [-MAX_TILT, MAX_TILT],
            Extrapolation.CLAMP,
          );
          rx.value = interpolate(
            e.y,
            [0, canvasHeight],
            [MAX_TILT * 0.79, -MAX_TILT * 0.79],
            Extrapolation.CLAMP,
          );
        })
        .onEnd(() => {
          rx.value = withSpring(0, motion.spring.tilt);
          ry.value = withSpring(0, motion.spring.tilt);
        }),
    [rx, ry, canvasWidth, canvasHeight],
  );

  const origin = useMemo(
    () => vec(PAD + width / 2, PAD + height / 2),
    [width, height],
  );

  // perspective 가 회전보다 먼저 와야 한다. 순서가 바뀌면 원근 항이 사라진다.
  const plate = useDerivedValue<Transforms3d>(() => [
    { perspective: PERSPECTIVE },
    { rotateX: rx.value },
    { rotateY: ry.value },
  ]);

  // 그림자 판 — 같은 회전 + 오프셋만 더해 시차를 만든다
  const shadow = useDerivedValue<Transforms3d>(() => [
    { perspective: PERSPECTIVE },
    { rotateX: rx.value },
    { rotateY: ry.value },
    { translateY: 14 },
    { scale: 0.94 },
  ]);

  // 기울기를 따라 움직이는 광택
  const sheenStart = useDerivedValue(() =>
    vec(PAD + width * (0.5 + ry.value), PAD + height * (0.5 - rx.value)),
  );
  const sheenEnd = useMemo(
    () => vec(PAD + width, PAD + height),
    [width, height],
  );
  const gradientStart = useMemo(() => vec(PAD, PAD), []);

  // 전경 패럴랙스 — 같은 회전의 1.4배 + 살짝 확대(가짜 translateZ)
  const foreground = useAnimatedStyle(() => ({
    transform: [
      { perspective: PERSPECTIVE },
      { rotateX: `${rx.value * 1.4}rad` },
      { rotateY: `${ry.value * 1.4}rad` },
      { scale: 1.02 },
    ],
  }));

  const sheen =
    theme === 'night'
      ? SHEEN_NIGHT
      : theme === 'light'
        ? SHEEN_LIGHT
        : SHEEN_DARK;

  // 전정기관이 예민한 사용자에게 패럴랙스를 주면 안 된다 — Canvas 도 제스처도 만들지 않는다.
  if (reduced) {
    return (
      <View style={{ width: canvasWidth, padding: PAD }}>
        <Card>{children}</Card>
      </View>
    );
  }

  return (
    <GestureDetector gesture={pan}>
      <View style={{ width: canvasWidth, height: canvasHeight }}>
        <Canvas style={StyleSheet.absoluteFill}>
          {/* 1) 그림자 판 — BlurMask(마스크 필터)라 오프스크린 레이어가 없다 */}
          <Group origin={origin} transform={shadow}>
            <RoundedRect
              x={PAD}
              y={PAD}
              width={width}
              height={height}
              r={R}
              color={colors.shadow}
            >
              <BlurMask blur={22} style="normal" />
            </RoundedRect>
          </Group>

          <Group origin={origin} transform={plate}>
            {/* 2) 본체 */}
            <RoundedRect x={PAD} y={PAD} width={width} height={height} r={R}>
              <LinearGradient
                start={gradientStart}
                end={sheenEnd}
                colors={[colors.card, colors.backgroundSoft]}
              />
            </RoundedRect>

            {/* 3) 기울기 추종 광택 */}
            <RoundedRect x={PAD} y={PAD} width={width} height={height} r={R}>
              <LinearGradient
                start={sheenStart}
                end={sheenEnd}
                colors={sheen}
              />
            </RoundedRect>

            {/* 4) 1px 림 — 3D 로 읽히는 데 가장 크게 기여한다 */}
            <RoundedRect
              x={PAD + 0.5}
              y={PAD + 0.5}
              width={width - 1}
              height={height - 1}
              r={R - 0.5}
              style="stroke"
              strokeWidth={1}
              color={colors.borderStrong}
            />
          </Group>
        </Canvas>

        {/* 5) 전경 — 판보다 크게 움직여서 층이 나뉜 물체로 읽히게 한다 */}
        <Animated.View
          pointerEvents="box-none"
          style={[
            {
              position: 'absolute',
              left: PAD,
              top: PAD,
              width,
              height,
              padding: spacing.lg,
            },
            foreground,
          ]}
        >
          {children}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
