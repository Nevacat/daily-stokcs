/**
 * @shopify/react-native-skia 의 jest 대역.
 *
 * 패키지가 제공하는 공식 mock 은 `global.CanvasKit`(WASM 빌드)이 있어야 동작한다.
 * 그게 없으면 `Skia.RuntimeEffect` 가 undefined 라, 모듈 스코프에서 셰이더를 컴파일하는
 * AuroraBackground 를 import 하는 순간 테스트가 죽는다.
 * 렌더 스모크 테스트에 필요한 표면만 흉내 낸다 — 실제 그리기는 시뮬레이터에서 확인한다.
 */
const React = require('react');
const { View } = require('react-native');

/** props 는 전부 버린다 (onSize·opaque 같은 Skia 전용 prop 이 View 로 새지 않게) */
const Noop = ({ children }) =>
  React.createElement(View, null, children ?? null);

module.exports = {
  Canvas: Noop,
  Fill: Noop,
  Shader: Noop,
  Group: Noop,
  RoundedRect: Noop,
  LinearGradient: Noop,
  BlurMask: Noop,
  vec: (x, y) => ({ x, y }),
  Skia: {
    // null 이 아니어야 AuroraBackground 가 '컴파일 실패' 경로로 빠지지 않는다
    RuntimeEffect: { Make: () => ({}) },
  },
};
