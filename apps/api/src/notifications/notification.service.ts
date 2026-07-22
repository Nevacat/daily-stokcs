import { Injectable, Logger } from '@nestjs/common';
import type { Recommendation } from '@daily-stocks/shared';
import { DevicesService } from './devices.service';

/**
 * 푸시 알림 발송 (Firebase Cloud Messaging HTTP v1 연동 자리, 기획서 §3.2).
 *
 * ┌─ 활성화 방법 ──────────────────────────────────────────────┐
 * │ 1) Firebase 콘솔 > 프로젝트 설정 > 서비스 계정                │
 * │    > "새 비공개 키 생성"으로 JSON 다운로드                     │
 * │ 2) apps/api/.env 에 경로 지정 (.env.example 참고)             │
 * │      FCM_SERVICE_ACCOUNT_PATH=./secrets/fcm-service-account.json │
 * │ 3) 모바일 쪽 설정은 apps/mobile/src/push/README.md 참고        │
 * └────────────────────────────────────────────────────────────┘
 *
 * 키가 없으면 발송을 건너뛰고 로그만 남긴다 (기능 전체는 정상 동작).
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly devicesService: DevicesService) {}

  get enabled(): boolean {
    return Boolean(process.env.FCM_SERVICE_ACCOUNT_PATH);
  }

  /** 관심 종목에 새 추천이 생겼을 때 호출된다 */
  async notifyNewFavoriteRecommendations(
    recommendations: Recommendation[],
  ): Promise<{ sent: number; skipped: boolean }> {
    if (recommendations.length === 0) return { sent: 0, skipped: false };

    const devices = this.devicesService.list();
    const names = recommendations.map((r) => r.stockName).join(', ');
    const title = '관심 종목 새 추천';
    const body = `${names} — 새로운 추천이 도착했습니다.`;

    if (!this.enabled || devices.length === 0) {
      this.logger.log(
        `푸시 건너뜀 (FCM ${this.enabled ? '설정됨' : '미설정'}, 디바이스 ${devices.length}대): ${title} — ${body}`,
      );
      return { sent: 0, skipped: true };
    }

    // TODO(FCM 키 입력 후 구현):
    // 1) FCM_SERVICE_ACCOUNT_PATH의 서비스 계정 JSON으로 google-auth-library
    //    (npm i google-auth-library) GoogleAuth 생성 →
    //    scope 'https://www.googleapis.com/auth/firebase.messaging'으로 access token 발급
    // 2) 디바이스별 POST https://fcm.googleapis.com/v1/projects/{PROJECT_ID}/messages:send
    //    body: { message: { token: device.token, notification: { title, body } } }
    // 3) 404/410(UNREGISTERED) 응답 토큰은 devicesService.unregister로 정리
    this.logger.warn('FCM 발송 구현 필요 — 현재는 로그만 남깁니다.');
    return Promise.resolve({ sent: 0, skipped: true });
  }
}
