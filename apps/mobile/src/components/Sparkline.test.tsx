/**
 * 카드 시각 요소 회귀 테스트 — 데이터가 없거나 이상해도 카드가 깨지면 안 된다.
 * 스파크라인은 부가 정보라 서버가 종목을 못 찾으면 그냥 키가 빠진다 (디자이너 스펙 C-3).
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import Svg, { Path } from 'react-native-svg';
import type { Sector } from '@daily-stocks/shared';
import { SECTOR_LABELS, SECTORS } from '@daily-stocks/shared';
import { ThemeProvider } from '../theme/ThemeContext';
import { SectorBadge } from './SectorBadge';
import { Sparkline, SPARKLINE_SIZE } from './Sparkline';

type Tree = ReactTestRenderer.ReactTestRenderer;

/**
 * 마운트 → 검사 → 언마운트.
 * ThemeProvider 가 AsyncStorage 를 비동기로 읽으므로 act 를 await 하고,
 * 트리를 남겨두면 그 promise 가 jest 워커를 붙잡는다.
 */
const check = async (
  node: React.ReactElement,
  assert: (tree: Tree) => void,
): Promise<void> => {
  let tree!: Tree;
  await act(async () => {
    tree = ReactTestRenderer.create(<ThemeProvider>{node}</ThemeProvider>);
  });
  assert(tree);
  await act(async () => tree.unmount());
};

/** SVG path 문자열 전부 — 좌표에 NaN 이 새면 여기서 잡힌다 */
const paths = (tree: Tree): string =>
  tree.root
    .findAllByType(Path)
    .map(node => String(node.props.d))
    .join(' ');

describe('Sparkline', () => {
  it('점이 부족하면 아무것도 그리지 않는다 (미등록·신규 상장 종목)', async () => {
    await check(<Sparkline points={[]} />, t =>
      expect(t.root.findAllByType(Svg)).toHaveLength(0),
    );
    await check(<Sparkline points={[100]} />, t =>
      expect(t.root.findAllByType(Svg)).toHaveLength(0),
    );
  });

  it('종가가 전부 같아도 NaN 좌표가 나오지 않는다 (span 0 나눗셈)', async () => {
    await check(<Sparkline points={[500, 500, 500]} />, t => {
      const d = paths(t);
      expect(d).not.toMatch(/NaN|Infinity/);
      expect(d.length).toBeGreaterThan(0);
    });
  });

  it('0 으로 시작하는 종가에도 등락률이 Infinity 가 되지 않는다', async () => {
    await check(<Sparkline points={[0, 120]} />, t => {
      const label = t.root.findAll(
        n => typeof n.props?.accessibilityLabel === 'string',
      )[0].props.accessibilityLabel as string;
      // 색만으로 방향을 전달하지 않는다 — 라벨에 ▲▼ 가 남아 있어야 한다
      expect(label).toMatch(/[▲▼—]/);
      expect(label).not.toMatch(/NaN|Infinity/);
    });
  });

  it('카드 레이아웃이 흔들리지 않게 크기가 고정이다', () => {
    expect(SPARKLINE_SIZE).toEqual({ width: 72, height: 22 });
  });
});

describe('SectorBadge', () => {
  // chart 팔레트는 6색인데 섹터는 8개 — 인덱스가 넘쳐 undefined 색이 되면 여기서 터진다
  it('섹터 8개 전부 색과 라벨을 갖는다', async () => {
    for (const sector of SECTORS as readonly Sector[]) {
      await check(<SectorBadge sector={sector} />, t => {
        const badge = t.root.findAll(
          n => n.props?.accessibilityLabel === SECTOR_LABELS[sector],
        )[0];
        expect(badge).toBeDefined();
        const flat = StyleSheet.flatten(badge.props.style) as {
          backgroundColor?: string;
        };
        expect(flat.backgroundColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });
    }
  });
});
