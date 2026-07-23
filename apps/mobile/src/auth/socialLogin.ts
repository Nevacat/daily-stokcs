/**
 * 카카오/애플 네이티브 SDK 연동 자리 — 키 준비 후 주석 해제.
 * 설정 절차는 같은 폴더의 README.md 참고.
 *
 * 키가 없으면 null을 반환하고, 로그인 화면은 안내 문구를 보여준다.
 */

/** 카카오 SDK로 액세스 토큰 획득 (네이티브 앱 키 필요) */
export async function getKakaoAccessToken(): Promise<string | null> {
  // TODO(카카오 네이티브 앱 키 설정 후 주석 해제):
  //
  // 1) npm install -w mobile @react-native-seoul/kakao-login
  // 2) iOS: Info.plist에 KAKAO_APP_KEY·URL 스킴(kakao{앱키}) 추가, pod install
  //    Android: AndroidManifest 및 strings.xml에 앱 키 추가
  //
  // import { login } from '@react-native-seoul/kakao-login';
  // const result = await login();
  // return result.accessToken;

  return Promise.resolve(null);
}

/** Apple 로그인으로 identityToken 획득 (Sign in with Apple capability 필요) */
export async function getAppleIdentityToken(): Promise<{
  identityToken: string;
  nickname?: string;
} | null> {
  // TODO(Apple Developer 계정에서 Sign in with Apple 활성화 후 주석 해제):
  //
  // 1) npm install -w mobile @invertase/react-native-apple-authentication
  // 2) Xcode > Signing & Capabilities > + Sign in with Apple, pod install
  //
  // import { appleAuth } from '@invertase/react-native-apple-authentication';
  // const res = await appleAuth.performRequest({
  //   requestedOperation: appleAuth.Operation.LOGIN,
  //   requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
  // });
  // if (!res.identityToken) return null;
  // const nickname = res.fullName?.nickname ?? res.fullName?.givenName ?? undefined;
  // return { identityToken: res.identityToken, nickname };

  return Promise.resolve(null);
}
