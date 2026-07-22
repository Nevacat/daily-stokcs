# 푸시 알림 설정 가이드 (기획서 §3.2)

서버 쪽 발송 로직과 디바이스 토큰 등록 API는 이미 준비되어 있다.
아래 키/설정 파일만 채우면 관심 종목에 새 추천이 생길 때 푸시가 온다.

## 1. Firebase 프로젝트 준비 (키 발급)

1. https://console.firebase.google.com 에서 프로젝트 생성
2. iOS 앱 추가 (번들 ID: `com.dailystocks`) → **`GoogleService-Info.plist` 다운로드**
   - 위치: `apps/mobile/ios/DailyStocks/GoogleService-Info.plist`  ← 여기에 넣기
3. Android 앱 추가 (패키지명: `com.dailystocks`) → **`google-services.json` 다운로드**
   - 위치: `apps/mobile/android/app/google-services.json`  ← 여기에 넣기
4. 프로젝트 설정 > 서비스 계정 > "새 비공개 키 생성" → JSON 다운로드
   - 위치: `apps/api/secrets/fcm-service-account.json` (gitignore 대상)
   - `apps/api/.env` 에 `FCM_SERVICE_ACCOUNT_PATH=./secrets/fcm-service-account.json`

## 2. 모바일 패키지 설치 (키 준비 후 실행)

```bash
npm install -w mobile @react-native-firebase/app @react-native-firebase/messaging
cd apps/mobile/ios && bundle exec pod install
```

## 3. 토큰 등록 코드 (키 준비 후 [registerPush.ts](registerPush.ts)의 주석 해제)

앱 시작 시 `registerPushToken()`을 호출하면 FCM 토큰을 받아
서버 `POST /devices`에 등록한다. 서버는 수집 시 관심 종목에 새 추천이
생기면 등록된 모든 디바이스로 발송한다 (FCM 키 없으면 로그만 남김).
