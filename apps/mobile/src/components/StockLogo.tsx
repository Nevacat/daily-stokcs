import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { STOCKS } from '@daily-stocks/shared';
import { useTheme } from '../theme/ThemeContext';

const DOMAIN_BY_TICKER = new Map(
  STOCKS.filter(s => s.domain).map(s => [s.ticker, s.domain!]),
);
const NAME_BY_TICKER = new Map(STOCKS.map(s => [s.ticker, s.name]));

/**
 * 종목 로고 — 회사 파비콘(키 불필요)을 쓰고,
 * 로드 실패·도메인 없음이면 이니셜 아바타로 폴백한다.
 */
export function StockLogo({
  ticker,
  name: nameProp,
  size = 32,
}: {
  ticker: string;
  /** 카탈로그 종목 등 큐레이션 밖 종목의 표시 이름 */
  name?: string;
  size?: number;
}) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const domain = DOMAIN_BY_TICKER.get(ticker);
  const name = nameProp ?? NAME_BY_TICKER.get(ticker) ?? ticker;

  const wrapperStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: colors.primarySoft,
  };

  if (!domain || failed) {
    return (
      <View style={[styles.center, wrapperStyle]}>
        <Text
          style={{
            color: colors.primary,
            fontSize: size * 0.42,
            fontWeight: '800',
          }}
        >
          {name.slice(0, 1)}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.center, wrapperStyle, styles.clip]}>
      <Image
        source={{
          uri: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
        }}
        style={{ width: size * 0.62, height: size * 0.62 }}
        resizeMode="contain"
        onError={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  clip: { overflow: 'hidden' },
});
