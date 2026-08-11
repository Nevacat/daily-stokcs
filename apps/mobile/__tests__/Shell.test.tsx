/**
 * 로그인 상태 셸 — 탭 4개가 실제로 그려지는지, 각 탭이 예외 없이 렌더되는지.
 *
 * 이 테스트가 없으면 로그인 이후 화면은 한 번도 렌더되지 않는다
 * (App.test.tsx 는 토큰이 없어 LoginScreen 까지만 간다).
 *
 * 하네스 주의사항 — 이 넷 중 하나라도 빠지면 트리가 통째로 비거나 스플래시에서 멈춘다:
 *  1. SafeAreaProvider 를 mock 할 것. 실제 구현은 네이티브 onLayout 으로 inset 을 받기 전까지
 *     children 을 render 하지 않는데(RNCSafeAreaProvider children=null), react-test-renderer
 *     에는 레이아웃이 없어서 앱 트리가 영원히 비어 있다. 텍스트 0개·role 0개의 진짜 원인이다.
 *     (앱 코드 버그가 아니라 하네스 문제 — 패키지가 제공하는 공식 mock 을 쓴다)
 *  2. 렌더 전에 AsyncStorage 에 토큰·유저·온보딩 완료를 심어둘 것
 *     (AuthContext 는 user=null 로 시작하고, AppRoot 는 user/onboarded 가 null 인 동안 스플래시다)
 *  3. fetch mock 은 res.text() 를 제공할 것 (api/client 는 json() 이 아니라 text() 를 쓴다)
 *  4. create 와 후속 이펙트 flush 를 모두 await act 로 감쌀 것
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import type { UserProfile } from '@daily-stocks/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from '../App';

// 패키지 공식 mock(jest/mock.tsx)은 transformIgnorePatterns 에 걸려 파싱되지 않으므로
// 앱이 실제로 쓰는 두 API 만 직접 대역한다 (src/screens/HomeScreen.test.tsx 와 같은 방식).
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const USER: UserProfile = {
  id: 'u1',
  provider: 'dev',
  nickname: '테스터',
  termsAgreedAt: '2026-08-01T00:00:00.000Z',
  createdAt: '2026-08-01T00:00:00.000Z',
};

/**
 * 엔드포인트별 빈 응답. 리스트는 [], 객체 응답은 실제 스키마의 빈 형태를 준다
 * (앱은 서버 계약을 믿고 res.data.sectors 처럼 바로 읽는다).
 */
const emptyBody = (url: string): unknown => {
  if (url.includes('/favorites/portfolio'))
    return {
      data: {
        positions: [],
        averageChangePct: null,
        measuredCount: 0,
        asOf: '2026-08-11T00:00:00.000Z',
      },
    };
  if (url.includes('/favorites')) return { data: { tickers: [], sectors: [] } };
  if (url.includes('/collect/status')) return { data: {} };
  if (url.includes('/settings')) return { data: { intervalMinutes: 60 } };
  if (url.includes('/quotes')) return { data: {} };
  return { data: [] };
};

/**
 * api/client 는 res.json() 이 아니라 res.text() 로 읽는다.
 * 브리핑은 아직 생성 전일 수 있는 부가 정보라 404 로 돌려 실패 경로까지 함께 확인한다.
 */
const mockFetch = () => {
  globalThis.fetch = jest.fn((url: string) => {
    const missing = String(url).includes('/briefing');
    return Promise.resolve({
      ok: !missing,
      status: missing ? 404 : 200,
      text: () =>
        Promise.resolve(
          missing
            ? '{"error":{"code":"NOT_FOUND","message":"아직 없어요"}}'
            : JSON.stringify(emptyBody(String(url))),
        ),
    });
  }) as unknown as typeof fetch;
};

async function renderApp(): Promise<ReactTestRenderer.ReactTestRenderer> {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  // 세션 복원 → 리렌더 → 화면별 데이터 로드까지 한 번 더 흘려보낸다
  await ReactTestRenderer.act(async () => {});
  return tree;
}

/** 트리에 그려진 문자열 전부 */
const texts = (tree: ReactTestRenderer.ReactTestRenderer): string[] =>
  tree.root
    .findAllByType('Text' as unknown as React.ComponentType, {
      deep: true,
    })
    .flatMap(n => n.children.filter((c): c is string => typeof c === 'string'));

/**
 * 탭 접근성 라벨.
 * Pressable 은 합성 노드와 내부 호스트 View 가 같은 접근성 props 를 공유하므로
 * deep 탐색은 탭 하나를 여러 번 잡는다. 매칭된 노드 안쪽은 더 보지 않도록 deep:false
 * 로 두고, 라벨이 실제 문자열인 노드만 남긴다.
 */
const tabLabels = (tree: ReactTestRenderer.ReactTestRenderer): string[] =>
  tree.root
    .findAll(
      n =>
        n.props.accessibilityRole === 'tab' &&
        typeof n.props.accessibilityLabel === 'string',
      { deep: false },
    )
    .map(n => String(n.props.accessibilityLabel));

beforeEach(async () => {
  mockFetch();
  await AsyncStorage.clear();
  await AsyncStorage.setItem('detok.authToken', 'test-token');
  await AsyncStorage.setItem('detok.authUser', JSON.stringify(USER));
  await AsyncStorage.setItem('detok.onboarded', '1');
});

describe('로그인 상태 셸', () => {
  it('탭 4개와 홈 화면을 예외 없이 그린다', async () => {
    const tree = await renderApp();

    expect(tabLabels(tree)).toEqual(['홈', '뉴스', '기록', '설정']);
    // 스플래시(ActivityIndicator 뿐)에서 멈추면 텍스트가 0개다
    expect(texts(tree).length).toBeGreaterThan(0);
  });

  it('뉴스·기록·설정 탭이 각각 예외 없이 그려진다', async () => {
    const tree = await renderApp();

    for (const label of ['뉴스', '기록', '설정']) {
      const tab = tree.root
        .findAll(n => n.props.accessibilityRole === 'tab', { deep: true })
        .find(n => n.props.accessibilityLabel === label);
      expect(tab).toBeDefined();

      await ReactTestRenderer.act(async () => {
        tab!.props.onPress();
      });
      expect(texts(tree)).toContain(label);
    }
  });

  it('내 종목(기록 탭)에 가상 계산 면책 문구가 상시 노출된다', async () => {
    const tree = await renderApp();

    const records = tree.root
      .findAll(n => n.props.accessibilityRole === 'tab', { deep: true })
      .find(n => n.props.accessibilityLabel === '기록');
    await ReactTestRenderer.act(async () => {
      records!.props.onPress();
    });

    const joined = texts(tree).join(' ');
    expect(joined).toContain('가상');
  });
});
