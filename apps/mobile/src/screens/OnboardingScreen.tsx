import React, { useRef, useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Newspaper, Sparkles, Star } from 'lucide-react-native';
import { Button } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';
import { spacing } from '../theme/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLIDES = [
  {
    Icon: Newspaper,
    title: '뉴스가 알아서 모입니다',
    body: '국내·미국 경제 뉴스를 자동으로 모으고\nAI가 호재·악재를 가려드려요.',
  },
  {
    Icon: Sparkles,
    title: '왜 추천하는지까지',
    body: '섹터별 추천 종목을 근거 뉴스,\n판단 과정과 함께 투명하게 보여드려요.',
  },
  {
    Icon: Star,
    title: '관심 종목만 콕 집어서',
    body: '관심 종목을 등록해두면 새 추천이 생길 때\n가장 먼저 알려드릴게요.',
  },
];

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme();
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const isLast = page === SLIDES.length - 1;

  const next = () => {
    if (isLast) {
      onDone();
      return;
    }
    scrollRef.current?.scrollTo({ x: SCREEN_WIDTH * (page + 1), animated: true });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundSoft }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e =>
          setPage(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))
        }
      >
        {SLIDES.map(({ Icon, title, body }) => (
          <View key={title} style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <View style={[styles.iconWrap, { backgroundColor: colors.surface }]}>
              <Icon size={40} color={colors.primary} strokeWidth={1.7} />
            </View>
            <Text style={[styles.slideTitle, { color: colors.textPrimary }]}>
              {title}
            </Text>
            <Text style={[styles.slideBody, { color: colors.textSecondary }]}>
              {body}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((slide, index) => (
            <View
              key={slide.title}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    index === page ? colors.primary : colors.border,
                  width: index === page ? 20 : 7,
                },
              ]}
            />
          ))}
        </View>
        <Button title={isLast ? '시작하기' : '다음'} onPress={next} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xxl,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  slideTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  slideBody: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  footer: { padding: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.xl },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: { height: 7, borderRadius: 4 },
});
