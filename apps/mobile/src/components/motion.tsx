import React, {
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { motion, radius } from '../theme/tokens';

/**
 * 재사용 모션 훅·래퍼 (디자이너 스펙 PROMPT 2 / 5 / 7, 모션 표 B·E·J).
 *
 * 여기 있는 것은 전부 Reanimated 전용이다 — transform/opacity 만 다루므로
 * Skia 네이티브 서피스가 필요 없다. Skia 는 AuroraBackground / TiltCard 에만 쓴다.
 */

// ── 동작 줄이기(reduce motion) ────────────────────────────────────────────────
// 시스템 설정 + 개발 갤러리용 강제 토글. 시뮬레이터에서 접근성 설정을 켜지 않고도
// reduce motion 경로를 눈으로 검증할 수 있어야 해서 오버라이드를 둔다.
let forcedReduced = false;
const reducedListeners = new Set<() => void>();
const subscribeReduced = (listener: () => void): (() => void) => {
  reducedListeners.add(listener);
  return () => {
    reducedListeners.delete(listener);
  };
};
const getForcedReduced = (): boolean => forcedReduced;

/** 개발/QA 전용 — 앱 전체를 reduce motion 경로로 강제한다 */
export function setForceReducedMotion(next: boolean): void {
  forcedReduced = next;
  reducedListeners.forEach(listener => listener());
}

/** 시스템 '동작 줄이기' 또는 강제 토글이 켜져 있으면 true */
export function useMotionReduced(): boolean {
  const system = useReducedMotion();
  const forced = useSyncExternalStore(
    subscribeReduced,
    getForcedReduced,
    getForcedReduced,
  );
  return system || forced;
}

// ── PROMPT 2 — 리스트 진입 stagger (모션 표 B) ───────────────────────────────
/**
 * 리스트 아이템 진입: opacity 0→1, translateY 12→0, 260ms.
 * stagger 는 index 5 까지만 적용한다 — 누적 지연이 270ms 를 넘으면
 * "연출"이 아니라 "느린 화면"으로 읽힌다.
 * 스크롤로 뒤늦게 나타나는 아이템은 `enabled={false}` 로 최종 상태에서 시작시킨다.
 */
export function Stagger({
  index = 0,
  enabled = true,
  style,
  children,
}: PropsWithChildren<{
  index?: number;
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
}>) {
  const reduced = useMotionReduced();
  const progress = useSharedValue(enabled ? 0 : 1);

  useEffect(() => {
    if (!enabled) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      reduced ? 0 : Math.min(index, 5) * motion.stagger,
      withTiming(1, {
        duration: reduced ? motion.duration.micro : motion.duration.base,
        easing: Easing.bezier(...motion.easing.standard),
      }),
    );
  }, [progress, index, enabled, reduced]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    // reduce motion 이면 이동을 빼고 페이드만 남긴다
    transform: [{ translateY: reduced ? 0 : (1 - progress.value) * 12 }],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

// ── PROMPT 5 — 카드 → 상세 Z축 전환 (모션 표 E) ──────────────────────────────
export interface OriginRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ZoomTransition {
  /** 모달 컨테이너 — 스타일에 transformOrigin: 'top left' 를 함께 지정할 것 */
  modalStyle: ReturnType<typeof useAnimatedStyle>;
  /** 모달 내용 — 스케일 중 글자가 번지지 않게 늦게 페이드인 */
  contentStyle: ReturnType<typeof useAnimatedStyle>;
  /** 뒤 딤 */
  scrimStyle: ReturnType<typeof useAnimatedStyle>;
  /** 뒤에 남는 리스트 — 물러나는 Z축 단서 */
  behindStyle: ReturnType<typeof useAnimatedStyle>;
  /** 모달 헤더에 붙이는 아래로 밀어 닫기 제스처 */
  swipeGesture: ReturnType<typeof Gesture.Pan>;
  /** 닫기 애니메이션 후 onClosed 를 호출한다 */
  close: () => void;
}

/**
 * 탭한 카드 자리에서 모달이 열려 나오는 전환.
 * `onClosed` 는 애니메이션이 끝난 뒤 호출되므로 Modal 은 그때 언마운트한다.
 * `Modal animationType="none"` 과 함께 쓴다.
 *
 * 주의: onClosed 는 useCallback 등으로 안정된 참조여야 한다 (제스처 재부착 방지).
 */
export function useZoomTransition({
  visible,
  origin,
  screen,
  onClosed,
}: {
  visible: boolean;
  /** 탭한 카드의 화면 좌표. 없으면 화면 중앙에서 페이드로 폴백한다 */
  origin: OriginRect | null;
  screen: { width: number; height: number };
  onClosed: () => void;
}): ZoomTransition {
  const reduced = useMotionReduced();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    progress.value = withTiming(1, {
      duration: reduced ? 220 : motion.duration.slow,
      easing: Easing.bezier(...motion.easing.standard),
    });
  }, [visible, reduced, progress]);

  const close = useCallback(() => {
    progress.value = withTiming(
      0,
      // 퇴장은 진입보다 빠르다
      {
        duration: reduced ? 160 : 320,
        easing: Easing.bezier(...motion.easing.exit),
      },
      finished => {
        if (finished) runOnJS(onClosed)();
      },
    );
  }, [progress, reduced, onClosed]);

  const from = origin ?? {
    x: screen.width / 2,
    y: screen.height / 2,
    width: screen.width,
    height: screen.height,
  };
  const geometric = !reduced && origin !== null;

  const modalStyle = useAnimatedStyle(() => {
    if (!geometric) return { opacity: progress.value };
    const p = progress.value;
    return {
      opacity: 1,
      borderRadius: interpolate(p, [0, 1], [radius.card, 0]),
      transform: [
        { translateX: interpolate(p, [0, 1], [from.x, 0]) },
        { translateY: interpolate(p, [0, 1], [from.y, 0]) },
        { scaleX: interpolate(p, [0, 1], [from.width / screen.width, 1]) },
        { scaleY: interpolate(p, [0, 1], [from.height / screen.height, 1]) },
      ],
    };
  });

  const contentStyle = useAnimatedStyle(() => ({
    opacity: geometric
      ? interpolate(progress.value, [0.45, 1], [0, 1], Extrapolation.CLAMP)
      : 1,
  }));

  const scrimStyle = useAnimatedStyle(() => ({
    // 진입 420ms 중 앞 240ms 안에 딤이 다 올라온다
    opacity: interpolate(
      progress.value,
      [0, 0.57],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const behindStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [1, 0.4]),
    transform: [
      { scale: geometric ? interpolate(progress.value, [0, 1], [1, 0.96]) : 1 },
    ],
  }));

  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .onUpdate(e => {
          if (e.translationY <= 0) return;
          progress.value = Math.max(0, 1 - e.translationY / 300);
        })
        .onEnd(() => {
          if (progress.value > 0.75) {
            progress.value = withSpring(1, motion.spring.sheet);
            return;
          }
          progress.value = withTiming(
            0,
            { duration: 220, easing: Easing.bezier(...motion.easing.exit) },
            finished => {
              if (finished) runOnJS(onClosed)();
            },
          );
        }),
    [progress, onClosed],
  );

  return {
    modalStyle,
    contentStyle,
    scrimStyle,
    behindStyle,
    swipeGesture,
    close,
  };
}

// ── PROMPT 7 — 하단 탭 마이크로 인터랙션 (모션 표 J) ─────────────────────────
/** 활성 탭 뒤 알약 인디케이터의 위치. 가로로 움직이는 유일한 요소다. */
export function useTabIndicator(
  activeIndex: number,
  tabWidth: number,
  indicatorWidth = 48,
): ReturnType<typeof useAnimatedStyle> {
  const reduced = useMotionReduced();
  const target = activeIndex * tabWidth + (tabWidth - indicatorWidth) / 2;
  const x = useSharedValue(target);

  useEffect(() => {
    x.value = reduced
      ? withTiming(target, { duration: 0 })
      : withSpring(target, { damping: 20, stiffness: 220 });
  }, [x, target, reduced]);

  return useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
}

/** 탭 활성화 시 아이콘 1 → 1.12 → 1 바운스. reduce motion 이면 아무것도 하지 않는다. */
export function useTabIconScale(
  active: boolean,
): ReturnType<typeof useAnimatedStyle> {
  const reduced = useMotionReduced();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!active || reduced) return;
    scale.value = withSequence(
      withTiming(1.12, {
        duration: 110,
        easing: Easing.bezier(...motion.easing.standard),
      }),
      withTiming(1, { duration: 130 }),
    );
  }, [active, reduced, scale]);

  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}
