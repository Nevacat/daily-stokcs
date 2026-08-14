module.exports = {
  preset: '@react-native/jest-preset',
  // worklets 공식 리졸버 — *.native.ts 대신 JS 구현을 고르게 해서
  // Reanimated 4를 JSI 없이 노드에서 로드할 수 있게 한다
  resolver: 'react-native-worklets/jest/resolver.js',
  // ESM으로 배포되는 패키지는 변환 대상에 포함해야 한다
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-svg|react-native-reanimated|react-native-worklets|react-native-gesture-handler|@shopify/react-native-skia|lucide-react-native)/)',
  ],
  // 제스처는 패키지가 주는 공식 mock 으로 충분하다
  setupFiles: [
    '<rootDir>/../../node_modules/react-native-gesture-handler/jestSetup.js',
  ],
  moduleNameMapper: {
    // Skia 공식 mock 은 global.CanvasKit(WASM)을 요구한다 — 자체 대역을 쓴다
    '^@shopify/react-native-skia$': '<rootDir>/__mocks__/skia.js',
    // lucide의 .mjs(ESM) 빌드는 jest가 파싱하지 못하므로 CJS 빌드로 매핑
    '^lucide-react-native$':
      '<rootDir>/../../node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
    // 네이티브 모듈은 인메모리 mock 사용
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/__mocks__/async-storage.js',
  },
};
