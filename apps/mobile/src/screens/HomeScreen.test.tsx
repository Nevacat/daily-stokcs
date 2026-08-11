/**
 * 홈 화면 회귀 테스트.
 * - H-2: 관심 종목 낙관적 업데이트의 롤백이 다른 종목까지 되돌리면 안 된다.
 * - M-1: 점수가 같고 이유 문장만 바뀌어도 카드가 다시 그려져야 한다.
 * - L-3: 모달이 떠 있는 동안에는 오로라 셰이더를 멈춘다.
 */
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import type { Recommendation } from '@daily-stocks/shared';

const mockToggleFavorite = jest.fn();
const mockRecs: Recommendation[] = [
  {
    id: '005930',
    ticker: '005930',
    stockName: '가나전자',
    sector: 'semiconductor_ai',
    score: 78,
    reason: '신규 수주 소식이 이어졌어요.',
    newsIds: [],
    recommendedAt: '2026-08-11T00:00:00.000Z',
    market: 'KR',
  },
  {
    id: '000660',
    ticker: '000660',
    stockName: '다라화학',
    sector: 'energy_chemical',
    score: 61,
    reason: '증설 계획을 발표했어요.',
    newsIds: [],
    recommendedAt: '2026-08-11T00:00:00.000Z',
    market: 'KR',
  },
];

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('../api/client', () => {
  const actual = jest.requireActual('../api/client');
  const ok = (data: unknown) => Promise.resolve({ data });
  return {
    ...actual,
    api: {
      ...actual.api,
      recommendations: () => ok(mockRecs),
      collectStatus: () => ok({}),
      favorites: () => ok({ tickers: [], sectors: [] }),
      // 브리핑·시세는 부가 정보 — 실패해도 홈은 그려져야 한다
      briefing: () => Promise.reject(new Error('없음')),
      nightBriefing: () => Promise.reject(new Error('없음')),
      quotes: () => ok({}),
      stockCatalog: () => ok([]),
      toggleFavorite: (ticker: string) => mockToggleFavorite(ticker),
    },
  };
});

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuroraBackground } from '../components/AuroraBackground';
import { AuthProvider } from '../auth/AuthContext';
import { CatalogProvider } from '../catalog/CatalogContext';
import { ThemeProvider } from '../theme/ThemeContext';
import { HomeScreen, isSameCard, withFavorite } from './HomeScreen';

// ── 순수 함수 ────────────────────────────────────────────────────────────────

describe('withFavorite — 티커 하나만 바꾼다', () => {
  it('담기·해제가 다른 종목을 건드리지 않는다', () => {
    expect(withFavorite(['B'], 'A', true)).toEqual(['B', 'A']);
    expect(withFavorite(['A', 'B'], 'A', false)).toEqual(['B']);
  });

  it('멱등이다 — 같은 요청이 두 번 와도 중복되거나 더 지워지지 않는다', () => {
    expect(withFavorite(['A'], 'A', true)).toEqual(['A']);
    expect(withFavorite(['B'], 'A', false)).toEqual(['B']);
  });
});

describe('isSameCard — memo 비교자', () => {
  const props = (rec: Recommendation) => ({
    rec,
    quote: null,
    favorite: false,
    onPress: () => {},
    onToggleFavorite: () => {},
  });

  it('id·점수가 같아도 이유 문장이 바뀌면 다시 그린다', () => {
    const before = props(mockRecs[0]);
    const after = props({ ...mockRecs[0], reason: '정부 정책 수혜 기대예요.' });
    expect(isSameCard(before, after)).toBe(false);
  });

  it('전부 같으면 다시 그리지 않는다', () => {
    expect(isSameCard(props(mockRecs[0]), props({ ...mockRecs[0] }))).toBe(
      true,
    );
  });
});

// ── 화면 ────────────────────────────────────────────────────────────────────

type Tree = ReactTestRenderer.ReactTestRenderer;

const renderHome = async (): Promise<Tree> => {
  let tree!: Tree;
  await act(async () => {
    tree = ReactTestRenderer.create(
      // TiltCard 가 GestureDetector 를 쓰므로 루트 뷰가 필요하다 (앱과 같은 구성)
      <GestureHandlerRootView>
        <ThemeProvider>
          <AuthProvider>
            <CatalogProvider>
              <HomeScreen />
            </CatalogProvider>
          </AuthProvider>
        </ThemeProvider>
      </GestureHandlerRootView>,
    );
  });
  return tree;
};

/** 화면에 있는 누를 수 있는 요소의 접근성 라벨 전부 */
const labels = (tree: Tree): string[] =>
  tree.root
    .findAll(
      node =>
        typeof node.props?.accessibilityLabel === 'string' &&
        typeof node.props?.onPress === 'function',
      { deep: true },
    )
    .map(node => node.props.accessibilityLabel as string);

const press = async (tree: Tree, label: string) => {
  const target = tree.root.findAll(
    node =>
      node.props?.accessibilityLabel === label &&
      typeof node.props?.onPress === 'function',
    { deep: true },
  )[0];
  if (!target) throw new Error(`'${label}' 를 찾지 못했어요.`);
  await act(async () => {
    target.props.onPress();
  });
};

describe('관심 종목 토글 (H-2)', () => {
  beforeEach(() => mockToggleFavorite.mockReset());

  it('A 담기가 실패해도 그 사이 성공한 B 는 그대로 남는다', async () => {
    let rejectA!: (e: Error) => void;
    mockToggleFavorite
      // A — 응답을 미뤄둔다
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectA = reject;
          }),
      )
      // B — 먼저 성공한다
      .mockImplementationOnce(() =>
        Promise.resolve({ data: { tickers: ['000660'], sectors: [] } }),
      );

    const tree = await renderHome();
    await press(tree, '가나전자 관심 종목 담기');
    await press(tree, '다라화학 관심 종목 담기');

    await act(async () => {
      rejectA(new Error('서버 오류'));
    });

    // 실패한 A 는 되돌아오고(= 다시 '담기'), 성공한 B 는 관심 종목으로 남는다.
    // 관심 종목이 된 카드는 상단 캐러셀로 옮겨가므로 '담기' 별이 사라진다.
    expect(labels(tree)).toContain('가나전자 관심 종목 담기');
    expect(labels(tree)).not.toContain('다라화학 관심 종목 담기');

    await act(async () => tree.unmount());
  });
});

describe('오로라 배경 (L-3)', () => {
  it('모달이 열리면 셰이더를 멈춘다', async () => {
    const tree = await renderHome();
    expect(tree.root.findByType(AuroraBackground).props.paused).toBe(false);

    await press(tree, '종목 검색');
    expect(tree.root.findByType(AuroraBackground).props.paused).toBe(true);

    await act(async () => tree.unmount());
  });
});
