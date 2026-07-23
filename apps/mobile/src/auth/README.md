# 소셜 로그인 설정 가이드

서버 검증·JWT 세션·약관 동의·회원정보/탈퇴는 전부 구현되어 있다.
아래 키만 채우면 실제 카카오/애플 로그인이 동작한다.
키가 없어도 **개발용 로그인**으로 전체 플로우를 확인할 수 있다.

## 카카오 로그인

1. https://developers.kakao.com 에서 앱 생성 → **네이티브 앱 키** 발급
2. [동의항목]에서 닉네임(필수), 이메일(선택) 설정
   — 서비스 약관을 카카오 동의화면에서 함께 받으려면 [간편가입] 약관 등록
3. 패키지 설치 및 네이티브 설정:
   ```bash
   npm install -w mobile @react-native-seoul/kakao-login
   ```
   - iOS: `Info.plist`에 `KAKAO_APP_KEY`와 URL 스킴 `kakao{네이티브앱키}` 추가 → pod install
   - Android: `AndroidManifest.xml`에 카카오 스킴 추가
4. [socialLogin.ts](socialLogin.ts)의 카카오 주석 해제

> 서버에는 카카오 키가 필요 없다 — 앱이 받은 accessToken을 서버가 카카오 API로 검증한다.

## Apple 로그인

1. Apple Developer > Identifiers > `com.dailystocks`에 **Sign in with Apple** 활성화
2. Xcode > Signing & Capabilities > `+ Capability` > Sign in with Apple
3. 패키지 설치:
   ```bash
   npm install -w mobile @invertase/react-native-apple-authentication
   cd apps/mobile/ios && bundle exec pod install
   ```
4. [socialLogin.ts](socialLogin.ts)의 애플 주석 해제

> 서버는 identityToken을 애플 공개키(JWKS)로 검증한다. `apps/api/.env`의
> `APPLE_BUNDLE_ID`가 실제 번들 ID와 일치해야 한다.
