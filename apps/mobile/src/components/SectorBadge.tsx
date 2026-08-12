import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Sector } from '@daily-stocks/shared';
import { SECTOR_LABELS, SECTORS } from '@daily-stocks/shared';
import { useTheme } from '../theme/ThemeContext';
import { sectorChartColor } from '../theme/tokens';
import { SECTOR_ICONS } from './sectorIcons';

/**
 * 종목 로고 우하단에 겹치는 섹터 배지.
 *
 * 왜 좌측 액센트 바가 아닌가: 8개 섹터 색을 리스트에 세로로 나란히 세우면 무지개가 된다.
 * 14px 원은 면적이 작아 리듬을 깨지 않으면서 섹터를 되살린다
 * (섹터는 현재 카드에서 사라져 상세 모달에만 있다).
 *
 * chart 팔레트는 6색이라 8섹터 중 두 쌍이 색을 공유한다 — 아이콘이 그 둘을 가른다.
 * 색만으로 전달하지 않는다 (WCAG 1.4.1).
 *
 * 부모가 position: relative 여야 한다 (로고를 감싼 View 안에 형제로 둔다).
 */
export function SectorBadge({
  sector,
  size = 14,
}: {
  sector: Sector;
  size?: number;
}) {
  const { colors } = useTheme();
  const Icon = SECTOR_ICONS[sector];
  const color = sectorChartColor(SECTORS.indexOf(sector), colors);

  return (
    <View
      accessible
      accessibilityLabel={SECTOR_LABELS[sector]}
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          // 로고와 배지를 떼어놓는 컷아웃. 카드 표면색이라 배경에 녹는다.
          borderColor: colors.card,
        },
      ]}
    >
      {/* chart 색은 다크에서 밝고 라이트에서 중간톤 — 어느 테마든 background 가 대비를 만든다 */}
      <Icon size={Math.round(size * 0.62)} color={colors.background} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
