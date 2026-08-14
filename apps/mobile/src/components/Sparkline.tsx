import React, { useId, useMemo } from 'react';
import { View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { changeColor, changeMark } from '../theme/tokens';

const W = 72;
const H = 22;

/**
 * 카드용 스파크라인 — 최근 한 달 종가 흐름.
 *
 * Skia 가 아니라 react-native-svg 다: 리스트 아이템마다 네이티브 서피스를 붙이면
 * RAM 이 터진다 (Canvas 는 화면당 1개 규칙). Path 2개 + 원 1개짜리 정적 도형이라
 * PriceChartCard 와 같은 이유로 SVG 가 맞다.
 *
 * 색은 구간 등락 방향(상승 빨강 / 하락 파랑)이지만 색만으로 전달하지 않는다 —
 * 접근성 라벨에 ▲▼ 와 수치를 넣고, 카드 안에서는 옆의 일간 등락률 텍스트가 함께 읽힌다.
 */
export function Sparkline({
  points,
  changePct,
}: {
  points: number[];
  /**
   * 선 색의 기준. 카드에서는 **바로 옆에 표시되는 등락률(전일 대비)** 을 넘긴다.
   *
   * 선의 모양은 한 달 흐름이지만 색까지 한 달 기준으로 칠하면,
   * 오늘 오른 종목(▲ 빨강) 옆에 파란 선이 붙어 서로 부정하는 것처럼 읽힌다.
   * 나란히 놓인 두 요소는 같은 것을 가리켜야 한다 — 모양은 추세, 색은 오늘.
   * 생략하면 구간 자체의 등락으로 칠한다 (독립 사용 시).
   */
  changePct?: number;
}) {
  const { colors, theme } = useTheme();
  // SVG 그라디언트 id 는 문서 전역이다. React 19 의 useId 는 '«r0»' 형태라
  // url(#…) 참조를 깨뜨린다 — 영숫자만 남긴다. (Skeleton.tsx / PriceChartCard.tsx 와 같은 방식)
  const fillId = `sl${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const shape = useMemo(() => {
    if (points.length < 2) return null;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = max - min || 1;
    const stepX = W / (points.length - 1);
    // 위아래 2px 여백 — 선 굵기 때문에 상하단이 잘리는 것을 막는다
    const coords = points.map((p, i) => ({
      x: i * stepX,
      y: H - 2 - ((p - min) / span) * (H - 4),
    }));
    const line = coords
      .map((c, i) => `${i ? 'L' : 'M'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(' ');
    const first = points[0];
    return {
      line,
      area: `${line} L${W} ${H} L0 ${H} Z`,
      last: coords[coords.length - 1],
      changePct:
        first === 0 ? 0 : ((points[points.length - 1] - first) / first) * 100,
    };
  }, [points]);

  if (!shape) return null;

  const color = changeColor(changePct ?? shape.changePct, colors);
  // 밝은 선은 어두운 배경에서 광학적으로 번진다 — 다크는 더 얇게 (PriceChartCard 와 동일 판단)
  const strokeWidth = theme === 'light' ? 1.8 : 1.5;

  return (
    <View
      accessible
      accessibilityLabel={`최근 한 달 ${changeMark(shape.changePct)} ${Math.abs(
        shape.changePct,
      ).toFixed(1)}퍼센트`}
    >
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            {/* 다크에서 진한 그라디언트는 밴딩이 보인다 — 0.20 을 넘기지 않는다 */}
            <Stop offset="0" stopColor={color} stopOpacity={0.2} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={shape.area} fill={`url(#${fillId})`} />
        <Path
          d={shape.line}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* 마지막 점 — "여기가 현재"를 선 말고 형태로도 알린다 */}
        <Circle cx={shape.last.x} cy={shape.last.y} r={1.8} fill={color} />
      </Svg>
    </View>
  );
}

/** 카드 레이아웃이 스파크라인 유무로 흔들리지 않게 쓰는 자리 크기 */
export const SPARKLINE_SIZE = { width: W, height: H } as const;
