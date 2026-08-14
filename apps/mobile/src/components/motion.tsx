import React, {
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import { StyleSheet } from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
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
  onLayout,
  children,
}: PropsWithChildren<{
  index?: number;
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** 1순위 카드 세로 위치 측정용 (HomeScreen 스크롤 틸트) */
  onLayout?: (e: LayoutChangeEvent) => void;
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
    // reduce motion 이면 이동·회전을 빼고 페이드만 남긴다
    transform: reduced
      ? []
      : [
          { perspective: 600 },
          { translateY: (1 - progress.value) * 10 },
          // 다크에서 12px 세로 이동은 거의 안 보인다. 카드 림이 사다리꼴로
          // 변형되는 rotateX 가 같은 정보(진입)를 훨씬 잘 전달한다.
          { rotateX: `${(1 - progress.value) * 0.14}rad` },
        ],
  }));

  return (
    <Animated.View
      style={[styles.stagger, style, animated]}
      onLayout={onLayout}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // 카드가 아래 모서리를 축으로 "세워지며" 들어온다
  stagger: { transformOrigin: 'bottom' },
});

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

// ── PROMPT 7 — 하단 탭 마이크로 인터랙션 (모션 표 J, v2) ─────────────────────
/**
 * 활성 탭 액센트 바 — 탭바 상단 경계에 얹히는 28×2px.
 *
 * 슬라이딩 알약을 버린 이유: primarySoft(#1E3150)와 탭바 backgroundSoft(#141A29)의
 * 휘도 차가 표면 사다리 한 칸에도 못 미쳐 다크에서 "덩어리"로 뭉갠다.
 * 다크에서 확실히 읽히는 것은 면이 아니라 고대비 선이다 (primary 는 배경 대비 9.00:1).
 * 그리고 가로로 미끄러지는 요소를 없앤다 — 각 탭이 제 자리에서 켜지고 꺼진다.
 */
export function useTabAccent(
  active: boolean,
): ReturnType<typeof useAnimatedStyle> {
  const reduced = useMotionReduced();
  const on = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      on.value = withTiming(active ? 1 : 0, {
        duration: motion.duration.micro,
      });
      return;
    }
    // 진입만 탄력 있게, 퇴장은 짧은 timing (모션 전역 원칙)
    on.value = active
      ? withSpring(1, { damping: 18, stiffness: 260, mass: 0.7 })
      : withTiming(0, {
          duration: 120,
          easing: Easing.bezier(...motion.easing.exit),
        });
  }, [active, reduced, on]);

  return useAnimatedStyle(() => ({
    opacity: on.value,
    // reduce motion 이면 폭 변화 없이 페이드만 남긴다
    transform: [{ scaleX: reduced ? 1 : 0.4 + on.value * 0.6 }],
  }));
}

/**
 * 탭 활성화 시 아이콘 squash → pop.
 * 기존 timing 110/130 시퀀스는 감쇠가 대칭이라 기계적으로 읽혔다.
 * 짧은 눌림 뒤 저감쇠 스프링(ζ≈0.36)이 물리적으로 읽힌다.
 */
export function useTabIconPop(
  active: boolean,
): ReturnType<typeof useAnimatedStyle> {
  const reduced = useMotionReduced();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!active || reduced) return;
    scale.value = withSequence(
      withTiming(0.9, {
        duration: 70,
        easing: Easing.bezier(...motion.easing.press),
      }),
      withSpring(1, { damping: 11, stiffness: 380, mass: 0.6 }),
    );
  }, [active, reduced, scale]);

  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}

/**
 * 구 탭 인디케이터 훅 — AppRoot 가 아직 쓴다.
 *
 * ponytail: 슬라이딩 알약은 useTabAccent 로 대체됐다. AppRoot 를 소유한
 *           feature/paper-portfolio PR 에서 호출부를 바꾸며 이 둘을 제거한다.
 *           스택 중간 단계가 깨지지 않게 남겨둔다.
 */
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
