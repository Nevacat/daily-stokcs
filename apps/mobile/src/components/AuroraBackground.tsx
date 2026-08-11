import React, { useEffect, useMemo } from 'react';
import { Platform, StyleSheet } from 'react-native';
import {
  Canvas,
  Fill,
  Shader,
  Skia,
  type SkSize,
} from '@shopify/react-native-skia';
import {
  Easing,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';
import { motion } from '../theme/tokens';
import { useMotionReduced } from './motion';

/**
 * 오로라 메시 그라디언트 배경 (디자이너 스펙 PROMPT 1, 모션 표 A).
 *
 * 장식이 아니다 — blob 3개의 가중치가 그날 뉴스의 호재/악재/중립 비율이다.
 * 붉은 기운이 강하면 호재가 많은 날이라는 뜻.
 *
 * 화면 전체에 딱 1개만 마운트한다 (리스트 뒤, StyleSheet.absoluteFill).
 * 카드마다·화면마다 넣으면 Canvas 하나당 네이티브 서피스 하나라 RAM 이 터진다.
 */

// 셰이더는 모듈 스코프에서 딱 한 번 컴파일한다. 렌더 안에서 하면 매 렌더 GPU 컴파일이다.
const SRC = Skia.RuntimeEffect.Make(`
uniform float2 u_res;
uniform float  u_time;
uniform float3 u_bg;
uniform float3 u_c0;
uniform float3 u_c1;
uniform float3 u_c2;
uniform float3 u_w;      // blob 별 세기 0..1, 감성 비율에서 나온다
uniform float  u_amp;    // 전체 진폭, dark 1.0 / night 0.75

float blob(float2 uv, float2 p, float r) {
  return smoothstep(r, 0.0, distance(uv, p));
}

half4 main(float2 xy) {
  float2 uv = xy / u_res;
  float  ar = u_res.x / u_res.y;
  uv.x *= ar;                      // 종횡비 보정 — 안 하면 blob 이 타원이 된다
  float t = u_time;

  // 서로 소인 저주파로 표류시켜 루프가 눈에 띄지 않게 한다
  float2 p0 = float2(0.30 * ar + 0.16 * sin(t * 0.021), 0.26 + 0.12 * cos(t * 0.017));
  float2 p1 = float2(0.74 * ar + 0.13 * cos(t * 0.013), 0.44 + 0.15 * sin(t * 0.023));
  float2 p2 = float2(0.48 * ar + 0.18 * sin(t * 0.011 + 2.0), 0.82 + 0.10 * cos(t * 0.019));

  float w0 = blob(uv, p0, 0.55) * u_w.x;
  float w1 = blob(uv, p1, 0.50) * u_w.y;
  float w2 = blob(uv, p2, 0.62) * u_w.z;
  float wsum = w0 + w1 + w2;

  // 정규화 가중 평균 — mix() 체이닝과 달리 피크가 가장 밝은 u_cN 을 넘지 못한다.
  // (체이닝하면 blob 겹침 지점이 카드보다 밝아져서 엘리베이션이 뒤집힌다)
  float3 acc = (u_c0 * w0 + u_c1 * w1 + u_c2 * w2) / max(wsum, 1e-4);
  float3 col = mix(u_bg, acc, clamp(wsum, 0.0, 1.0) * u_amp);

  // 디더 — 8bit 어두운 그라디언트의 밴딩 제거. 사실상 공짜.
  float dither = fract(sin(dot(xy, float2(12.9898, 78.233))) * 43758.5453);
  col += (dither - 0.5) / 255.0;

  return half4(col, 1.0);   // opaque — 프리멀티플라이는 여기선 무의미
}
`);

// RuntimeEffect.Make 는 컴파일 실패 시 throw 가 아니라 null 을 반환한다.
// 개발 중에는 즉시 드러나야 하고, 프로덕션에서는 배경 하나 때문에 앱이 죽으면 안 된다.
if (!SRC && __DEV__) {
  throw new Error('오로라 셰이더 컴파일에 실패했습니다.');
}

/** '#RRGGBB' → [r, g, b] 0..1. 토큰 문자열을 그대로 쓰기 위한 변환 (float 하드코딩 금지) */
const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/** 어떤 blob 도 사라지지 않게 0.35~1.0 로 눌러 담는다 */
const weight = (part: number, total: number): number =>
  0.35 + (0.65 * part) / total;

// 저사양 Android 반해상도 렌더 — 프래그먼트 비용이 1/4 이 되고,
// 흐릿한 필드라 업스케일이 전혀 보이지 않는다.
const LOW_END = Platform.OS === 'android' && Number(Platform.Version) < 30;
const HALF_RES = {
  width: '50%',
  height: '50%',
  transform: [{ scale: 2 }, { translateX: '25%' }, { translateY: '25%' }],
} as const;

export function AuroraBackground({
  positive = 0,
  negative = 0,
  neutral = 0,
  paused = false,
}: {
  /** DailyBriefing.marketSummary 의 원본 건수 */
  positive?: number;
  negative?: number;
  neutral?: number;
  /** 화면이 안 보일 때 true — 클럭을 멈춰 배터리를 아낀다 */
  paused?: boolean;
}) {
  const { theme, colors } = useTheme();
  const reduced = useMotionReduced();

  const size = useSharedValue<SkSize>({ width: 1, height: 1 });
  const clock = useSharedValue(0);
  const w0 = useSharedValue(0.35);
  const w1 = useSharedValue(0.35);
  const w2 = useSharedValue(0.35);

  // useClock() 대신 직접 프레임 콜백을 쥔다 — useClock 은 화면 밖에서도 매 프레임 돈다.
  const frame = useFrameCallback(info => {
    'worklet';
    clock.value = info.timeSinceFirstFrame;
  }, false);

  const active = !reduced && !paused && theme !== 'light';
  useEffect(() => {
    frame.setActive(active);
  }, [frame, active]);

  const target = useMemo(() => {
    const total = Math.max(1, positive + negative + neutral);
    return [
      weight(positive, total), // blob 0 — 호재
      weight(negative, total), // blob 1 — 악재
      weight(neutral, total), // blob 2 — 중립
    ] as const;
  }, [positive, negative, neutral]);

  // 새 수집 결과가 들어와도 튀지 않게 900ms 로 이어 붙인다
  useEffect(() => {
    const config = {
      duration: 900,
      easing: Easing.bezier(...motion.easing.standard),
    };
    w0.value = withTiming(target[0], config);
    w1.value = withTiming(target[1], config);
    w2.value = withTiming(target[2], config);
  }, [target, w0, w1, w2]);

  const paint = useMemo(
    () => ({
      bg: hexToRgb(colors.background),
      c0: hexToRgb(colors.aurora[0]),
      c1: hexToRgb(colors.aurora[1]),
      c2: hexToRgb(colors.aurora[2]),
      amp: theme === 'night' ? 0.75 : 1,
      // 심야는 약 40% 느리게 흐른다
      speed: theme === 'night' ? 1700 : 1000,
    }),
    [colors, theme],
  );

  const uniforms = useDerivedValue(() => ({
    u_res: [Math.max(size.value.width, 1), Math.max(size.value.height, 1)],
    // reduce motion: 클럭을 쓰지 않고 보기 좋은 한 장면에 고정한다 (대비는 유지)
    u_time: reduced ? 12 : clock.value / paint.speed,
    u_bg: paint.bg,
    u_c0: paint.c0,
    u_c1: paint.c1,
    u_c2: paint.c2,
    u_w: [w0.value, w1.value, w2.value],
    u_amp: paint.amp,
  }));

  // 라이트는 평평한 흰 배경이 규칙이다. 셰이더를 그려도 보이지 않는다.
  if (!SRC || theme === 'light') return null;

  return (
    <Canvas
      style={[StyleSheet.absoluteFill, LOW_END ? HALF_RES : null]}
      onSize={size}
      opaque
      pointerEvents="none"
    >
      <Fill>
        <Shader source={SRC} uniforms={uniforms} />
      </Fill>
    </Canvas>
  );
}
