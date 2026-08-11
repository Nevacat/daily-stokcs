import { MAX_COMPARE, togglePicked } from './MyStocksScreen';

describe('togglePicked (비교 선택)', () => {
  it('안 고른 종목은 추가한다', () => {
    expect(togglePicked([], '005930')).toEqual(['005930']);
    expect(togglePicked(['005930'], '000660')).toEqual(['005930', '000660']);
  });

  it('이미 고른 종목은 해제한다', () => {
    expect(togglePicked(['005930', '000660'], '005930')).toEqual(['000660']);
  });

  it(`${MAX_COMPARE}개를 넘기면 무시하고 같은 배열을 그대로 돌려준다`, () => {
    const full = ['005930', '000660', '042660'];
    // 참조가 그대로여야 호출부가 '무시됨'을 알고 안내 문구를 띄운다
    expect(togglePicked(full, 'NVDA')).toBe(full);
  });

  it('상한에 걸린 상태에서도 해제는 된다', () => {
    const full = ['005930', '000660', '042660'];
    expect(togglePicked(full, '000660')).toEqual(['005930', '042660']);
  });
});
