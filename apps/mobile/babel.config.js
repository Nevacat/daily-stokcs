module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // Reanimated 4는 worklets 플러그인을 쓴다 (reanimated/plugin에서 이관). 항상 마지막에 위치.
  plugins: ['react-native-worklets/plugin'],
};
