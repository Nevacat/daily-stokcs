/**
 * FCM 푸시 토큰 등록 (기획서 §3.2) — Firebase 키 설정 후 활성화.
 *
 * 활성화 절차는 같은 폴더의 README.md 참고.
 * 설정 파일(GoogleService-Info.plist / google-services.json)과
 * @react-native-firebase 패키지가 없으면 앱 빌드가 깨지므로,
 * 실제 연동 코드는 아래 주석 상태로 두었다. 키 준비 후 주석을 해제할 것.
 */

export async function registerPushToken(): Promise<void> {
  // TODO(Firebase 키 설정 후 주석 해제):
  //
  // import { Platform } from 'react-native';
  // import messaging from '@react-native-firebase/messaging';
  // import { api } from '../api/client';  // api에 registerDevice(token, platform) 추가
  //
  // const authStatus = await messaging().requestPermission();
  // const enabled =
  //   authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
  //   authStatus === messaging.AuthorizationStatus.PROVISIONAL;
  // if (!enabled) return;
  //
  // const token = await messaging().getToken();
  // await fetch(`${BASE_URL}/devices`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ token, platform: Platform.OS }),
  // });
  //
  // // 토큰 갱신 대응
  // messaging().onTokenRefresh(newToken => {
  //   void fetch(`${BASE_URL}/devices`, { ... });
  // });

  return Promise.resolve(); // 미설정 상태에서는 아무것도 하지 않음
}
