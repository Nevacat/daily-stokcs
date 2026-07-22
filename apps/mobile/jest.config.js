module.exports = {
  preset: '@react-native/jest-preset',
  // ESM으로 배포되는 패키지는 변환 대상에 포함해야 한다
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-svg|lucide-react-native)/)',
  ],
  moduleNameMapper: {
    // lucide의 .mjs(ESM) 빌드는 jest가 파싱하지 못하므로 CJS 빌드로 매핑
    '^lucide-react-native$':
      '<rootDir>/../../node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
    // 네이티브 모듈은 인메모리 mock 사용
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/__mocks__/async-storage.js',
  },
};
