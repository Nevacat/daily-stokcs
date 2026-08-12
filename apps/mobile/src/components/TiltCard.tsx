import React, { useMemo, useState, type PropsWithChildren } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
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
  type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';
import { motion, radius, spacing } from '../theme/tokens';
import { useMotionReduced } from './motion';
import { Card } from './ui';

/**
 * 3D 원근 틸트 카드 (디자이너 스펙 PROMPT 3 / 모션 표 D, v2 — 상시 노출).
 *
 * 왜 3D 인가: 다크에서 드롭섀도우는 대비를 못 만들어 "떠 있음"을 전달하지 못한다.
 * 원근 틸트 + 층별 오프셋 차이(패럴랙스)가 그 역할을 대신한다.
 * 지금 주목 중인 카드 하나에만 쓴다 — 리스트 전체에 쓰지 말 것.
 *
 * v1 은 롱프레스(180ms)+드래그로만 기울어서 일반 사용에서 절대 보이지 않았다.
 * v2 는 **정지 상태에서 이미 기울어 있고**, 스크롤에 따라 각도가 흔들린다.
 * 롱프레스 틸트는 고급 인터랙션으로 그대로 남는다 — 손을 떼면 0 이 아니라
 * 정지 기울기로 복귀한다.
 *
 * 정보: 깊이 = 랭킹. 오늘 1순위 카드 하나만 판 위에 떠 있고 나머지는 평면이다.
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

/**
 * 정지 상태 기울기 (rad, ≈3.15°). **세로축(rotateY)이다.**
 * 카드 폭(≈353)이 지렛대라 이 각도에서 반대 모서리가 1.7px 어긋난다 — 림이 사다리꼴로 꺾여 보인다.
 * 같은 각도를 rotateX 에 주면 높이(122)가 짧아 1.6px 밖에 안 움직여 지각 역치에 못 미친다.
 */
const RESTING_RY = 0.055;
/** 스크롤 위치(-1..1)에 곱하는 X축 흔들림 폭 (rad, ≈3.4°) */
const SCROLL_RX = 0.06;
/**
 * 기울기(rad) → 전경 이동(px). 정지 기울기 0.055rad 에서 약 4.4px 어긋난다.
 * 판은 원근으로, 전경은 평면 이동으로 움직여서 둘 사이에 시차가 생긴다.
 */
const PARALLAX = 80;

export function TiltCard({
  width = 320,
  height = 168,
  scrollProgress,
  children,
}: PropsWithChildren<{
  width?: number;
  height?: number;
  /** 뷰포트 안 세로 위치 -1(위) ~ 0(중앙) ~ 1(아래). 없으면 정적 틸트만 한다 */
  scrollProgress?: SharedValue<number>;
}>) {
  const { colors, theme } = useTheme();
  const reduced = useMotionReduced();

  // 판 높이는 내용에서 잰다. height prop 은 첫 프레임용 추정치일 뿐이다.
  // 고정값을 쓰면 내용이 그보다 크거나 작을 때 잘리거나 빈다 —
  // 실제로 스코어 링(52)이 들어간 카드가 122 에서 잘려 점수·별이 사라졌다.
  const [measured, setMeasured] = useState<number | null>(null);
  const plateHeight = measured ?? height;

  const onForegroundLayout = (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    // 반올림 후 같으면 setState 를 걸지 않는다 — 측정↔리렌더 루프 방지
    setMeasured(prev => (prev === h ? prev : h));
  };

  const canvasWidth = width + PAD * 2;
  const canvasHeight = plateHeight + PAD * 2;

  // 제스처가 얹는 추가 각도. 정지 상태는 (0, RESTING_RY).
  const rx = useSharedValue(0);
  const ry = useSharedValue(RESTING_RY);

  // prop 이 없을 때 쓸 고정 0 (훅은 조건부로 부를 수 없다)
  const noScroll = useSharedValue(0);
  const scroll = scrollProgress ?? noScroll;

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
          // 0 이 아니라 정지 기울기로 돌아간다
          rx.value = withSpring(0, motion.spring.tilt);
          ry.value = withSpring(RESTING_RY, motion.spring.tilt);
        }),
    [rx, ry, canvasWidth, canvasHeight],
  );

  // 제스처 각도 + 스크롤 각도를 합친 최종 기울기. 전부 UI 스레드.
  const tiltX = useDerivedValue(() => rx.value - scroll.value * SCROLL_RX);
  const tiltY = useDerivedValue(() => ry.value);

  const origin = useMemo(
    () => vec(PAD + width / 2, PAD + plateHeight / 2),
    [width, plateHeight],
  );

  // perspective 가 회전보다 먼저 와야 한다. 순서가 바뀌면 원근 항이 사라진다.
  const plate = useDerivedValue<Transforms3d>(() => [
    { perspective: PERSPECTIVE },
    { rotateX: tiltX.value },
    { rotateY: tiltY.value },
  ]);

  // 그림자 판 — 같은 회전 + 오프셋만 더해 시차를 만든다
  const shadow = useDerivedValue<Transforms3d>(() => [
    { perspective: PERSPECTIVE },
    { rotateX: tiltX.value },
    { rotateY: tiltY.value },
    { translateY: 14 },
    { scale: 0.94 },
  ]);

  // 기울기를 따라 흐르는 광택 — 정지 상태에서 "판"으로 읽히게 하는 주범이다
  const sheenStart = useDerivedValue(() =>
    vec(
      PAD + width * (0.5 + tiltY.value),
      PAD + plateHeight * (0.5 - tiltX.value),
    ),
  );
  const sheenEnd = useMemo(
    () => vec(PAD + width, PAD + plateHeight),
    [width, plateHeight],
  );
  const gradientStart = useMemo(() => vec(PAD, PAD), []);

  /**
   * 전경 패럴랙스 — **2D 이동이다. 3D 회전을 쓰면 안 된다.**
   *
   * 전경을 rotateX/rotateY 로 기울이면 뷰의 절반은 화면 앞으로, 절반은 뒤로 간다.
   * 그런데 Skia Canvas 가 같은 3D 컨텍스트의 z=0 평면에 있어서 두 레이어가 서로를
   * 관통하고, iOS 는 교차선을 따라 둘을 잘라낸다 — 카드 오른쪽 절반이 대각선으로
   * 사라지고 점수 링과 별이 통째로 안 보였다. 레이아웃은 멀쩡해서 tsc·테스트로는
   * 절대 안 잡힌다 (시뮬레이터에서만 보인다).
   *
   * 깊이 신호로는 시차(parallax)만 있으면 충분하다. 판이 기울어 보이는 것은
   * Skia 가 그리는 판 자체가 이미 원근 변환을 받고 있어서다.
   */
  const foreground = useAnimatedStyle(() => ({
    transform: [
      { translateX: tiltY.value * PARALLAX },
      { translateY: -tiltX.value * PARALLAX },
      { scale: 1.02 },
    ],
  }));

  const sheen =
    theme === 'night'
      ? SHEEN_NIGHT
      : theme === 'light'
        ? SHEEN_LIGHT
        : SHEEN_DARK;

  // 전정기관이 예민한 사용자에게 상시 패럴랙스는 더 나쁘다 — Canvas 도 제스처도 만들지 않는다.
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
              height={plateHeight}
              r={R}
              color={colors.shadow}
            >
              <BlurMask blur={22} style="normal" />
            </RoundedRect>
          </Group>

          <Group origin={origin} transform={plate}>
            {/* 2) 본체 */}
            <RoundedRect
              x={PAD}
              y={PAD}
              width={width}
              height={plateHeight}
              r={R}
            >
              <LinearGradient
                start={gradientStart}
                end={sheenEnd}
                colors={[colors.card, colors.backgroundSoft]}
              />
            </RoundedRect>

            {/* 3) 기울기 추종 광택 */}
            <RoundedRect
              x={PAD}
              y={PAD}
              width={width}
              height={plateHeight}
              r={R}
            >
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
              height={plateHeight - 1}
              r={R - 0.5}
              style="stroke"
              strokeWidth={1}
              color={colors.borderStrong}
            />
          </Group>
        </Canvas>

        {/* 5) 전경 — 판보다 크게 움직여서 층이 나뉜 물체로 읽히게 한다.
            높이를 고정하지 않고 내용에 맡긴 뒤 재서 판에 되먹인다. */}
        <Animated.View
          pointerEvents="box-none"
          onLayout={onForegroundLayout}
          style={[
            {
              position: 'absolute',
              left: PAD,
              top: PAD,
              width,
              minHeight: height,
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
