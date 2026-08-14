import React, { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Apple, Check, MessageCircle, UserRound, X } from 'lucide-react-native';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import {
  getAppleIdentityToken,
  getKakaoAccessToken,
} from '../auth/socialLogin';
import { PRIVACY_POLICY, TERMS_OF_SERVICE } from '../auth/terms';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing } from '../theme/tokens';

type TermsDoc = { title: string; body: string } | null;

/**
 * 소셜 로그인 버튼 색 — 각 사의 브랜드 가이드가 고정한 값이라 테마 토큰으로 바꿀 수 없다.
 * (여기 말고 다른 곳에서는 hex 를 직접 쓰지 않는다 — `useTheme().colors` 만 쓴다)
 */
const BRAND = {
  kakaoYellow: '#FEE500',
  kakaoLabel: '#191919',
  appleOnLight: '#000000',
  appleOnDark: '#FFFFFF',
} as const;

export function LoginScreen() {
  const { colors, scheme } = useTheme();
  const { applyLogin } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<TermsDoc>(null);

  const guard = (): boolean => {
    if (!agreed) {
      setError('약관에 동의해야 시작할 수 있어요.');
      return false;
    }
    setError(null);
    return true;
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : '로그인에 실패했어요. 다시 시도해주세요.',
      );
    } finally {
      setBusy(false);
    }
  };

  const onKakao = () =>
    run(async () => {
      if (!guard()) return;
      const accessToken = await getKakaoAccessToken();
      if (!accessToken) {
        setError(
          '카카오 SDK 미설정 — src/auth/README.md를 참고해 앱 키를 등록해주세요.',
        );
        return;
      }
      const res = await api.kakaoLogin(accessToken, true);
      await applyLogin(res.data);
    });

  const onApple = () =>
    run(async () => {
      if (!guard()) return;
      const result = await getAppleIdentityToken();
      if (!result) {
        setError(
          'Apple 로그인 미설정 — src/auth/README.md를 참고해 활성화해주세요.',
        );
        return;
      }
      const res = await api.appleLogin(
        result.identityToken,
        true,
        result.nickname,
      );
      await applyLogin(res.data);
    });

  const onDev = () =>
    run(async () => {
      if (!guard()) return;
      const res = await api.devLogin('개발자', true);
      await applyLogin(res.data);
    });

  return (
    <View
      style={[styles.container, { backgroundColor: colors.backgroundSoft }]}
    >
      <View style={styles.hero}>
        <Image
          source={require('../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={[styles.title, { color: colors.textPrimary }]}>DeTok</Text>
        <Text style={[styles.tagline, { color: colors.textSecondary }]}>
          뉴스를 읽는 가장 스마트한 방법
        </Text>
      </View>

      <View style={styles.bottom}>
        {/* 약관 동의 (신규 가입 시 필수) */}
        <Pressable
          style={styles.agreeRow}
          onPress={() => {
            setAgreed(!agreed);
            setError(null);
          }}
        >
          <View
            style={[
              styles.checkbox,
              {
                // 채움 위 라벨은 primaryFill/onPrimaryFill 쌍이어야 한다
                // (심야는 액센트가 앰버라 흰 체크가 1.7:1 로 묻힌다)
                backgroundColor: agreed ? colors.primaryFill : 'transparent',
                borderColor: agreed ? colors.primaryFill : colors.textDisabled,
              },
            ]}
          >
            {agreed && (
              <Check size={13} color={colors.onPrimaryFill} strokeWidth={3} />
            )}
          </View>
          <Text style={[styles.agreeText, { color: colors.textSecondary }]}>
            <Text
              style={[styles.link, { color: colors.primary }]}
              onPress={() =>
                setDoc({ title: '서비스 이용약관', body: TERMS_OF_SERVICE })
              }
            >
              이용약관
            </Text>
            {' 및 '}
            <Text
              style={[styles.link, { color: colors.primary }]}
              onPress={() =>
                setDoc({ title: '개인정보 처리방침', body: PRIVACY_POLICY })
              }
            >
              개인정보 처리방침
            </Text>
            에 동의합니다
          </Text>
        </Pressable>

        {error && (
          <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
        )}

        {/* 카카오 로그인 (브랜드 가이드 컬러) */}
        <Pressable
          disabled={busy}
          onPress={() => void onKakao()}
          style={[styles.button, styles.kakao, busy && styles.dim]}
        >
          <MessageCircle
            size={18}
            color={BRAND.kakaoLabel}
            fill={BRAND.kakaoLabel}
          />
          <Text style={styles.kakaoText}>카카오로 시작하기</Text>
        </Pressable>

        {/* Apple 로그인 */}
        <Pressable
          disabled={busy}
          onPress={() => void onApple()}
          style={[
            styles.button,
            {
              backgroundColor:
                scheme === 'dark' ? BRAND.appleOnDark : BRAND.appleOnLight,
            },
            busy && styles.dim,
          ]}
        >
          <Apple
            size={18}
            color={scheme === 'dark' ? BRAND.appleOnLight : BRAND.appleOnDark}
            fill={scheme === 'dark' ? BRAND.appleOnLight : BRAND.appleOnDark}
          />
          <Text
            style={[
              styles.appleText,
              {
                color:
                  scheme === 'dark' ? BRAND.appleOnLight : BRAND.appleOnDark,
              },
            ]}
          >
            Apple로 시작하기
          </Text>
        </Pressable>

        {/* 개발용 로그인 — 소셜 키 없이 전체 플로우 확인용 (프로덕션 서버에서는 거부됨) */}
        {__DEV__ && (
          <Pressable
            disabled={busy}
            onPress={() => void onDev()}
            style={[
              styles.devButton,
              { borderColor: colors.border },
              busy && styles.dim,
            ]}
          >
            <UserRound size={15} color={colors.textSecondary} />
            <Text style={[styles.devText, { color: colors.textSecondary }]}>
              개발용 로그인
            </Text>
          </Pressable>
        )}

        <Text style={[styles.disclaimer, { color: colors.textDisabled }]}>
          DeTok은 투자 자문이 아닌 정보 제공 서비스예요.
        </Text>
      </View>

      {/* 약관 전문 모달 */}
      <Modal
        visible={doc !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDoc(null)}
      >
        <View
          style={[styles.docContainer, { backgroundColor: colors.background }]}
        >
          <View
            style={[styles.docHeader, { borderBottomColor: colors.border }]}
          >
            <Text style={[styles.docTitle, { color: colors.textPrimary }]}>
              {doc?.title}
            </Text>
            <Pressable onPress={() => setDoc(null)} hitSlop={12}>
              <X size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.docBodyWrap}>
            <Text style={[styles.docBody, { color: colors.textSecondary }]}>
              {doc?.body}
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between' },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  logo: { width: 96, height: 96, borderRadius: 24 },
  title: { fontSize: 32, fontWeight: '800', marginTop: spacing.sm },
  tagline: { fontSize: 14 },
  bottom: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxl },
  agreeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agreeText: { fontSize: 13, flex: 1, lineHeight: 19 },
  link: { fontWeight: '700', textDecorationLine: 'underline' },
  error: { fontSize: 12 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.button,
    paddingVertical: 15,
  },
  dim: { opacity: 0.55 },
  kakao: { backgroundColor: BRAND.kakaoYellow },
  kakaoText: { color: BRAND.kakaoLabel, fontSize: 15, fontWeight: '700' },
  appleText: { fontSize: 15, fontWeight: '700' },
  devButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.button,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  devText: { fontSize: 13, fontWeight: '600' },
  disclaimer: { fontSize: 11, textAlign: 'center', marginTop: spacing.sm },
  docContainer: { flex: 1 },
  docHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  docTitle: { fontSize: 17, fontWeight: '700' },
  docBodyWrap: { padding: spacing.xl },
  docBody: { fontSize: 13, lineHeight: 21 },
});
