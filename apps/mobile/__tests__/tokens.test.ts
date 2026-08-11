import { changeColor, lightColors } from '../src/theme/tokens';

// 국내 관례가 다시 뒤집히지 않게 고정 (상승 빨강 / 하락 파랑 / 보합 회색)
test('changeColor — 상승 danger, 하락 primary, 보합 textSecondary', () => {
  expect(changeColor(1.2, lightColors)).toBe(lightColors.danger);
  expect(changeColor(-1.2, lightColors)).toBe(lightColors.primary);
  expect(changeColor(0, lightColors)).toBe(lightColors.textSecondary);
});
