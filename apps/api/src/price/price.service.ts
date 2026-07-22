import { Injectable, Logger } from '@nestjs/common';

/**
 * 주가 조회 서비스 (한국투자증권 KIS Developers 연동 자리).
 *
 * ┌─ 활성화 방법 ────────────────────────────────────────────┐
 * │ apps/api/.env 에 아래 키를 채우면 됩니다 (.env.example 참고) │
 * │   KIS_APP_KEY=발급받은_APP_KEY                             │
 * │   KIS_APP_SECRET=발급받은_APP_SECRET                       │
 * └──────────────────────────────────────────────────────────┘
 *
 * 키가 없으면 모든 조회가 null을 반환하고, 적중률 필드는 비활성 상태가 된다.
 */
@Injectable()
export class PriceService {
  private readonly logger = new Logger(PriceService.name);
  private warned = false;

  get enabled(): boolean {
    return Boolean(process.env.KIS_APP_KEY && process.env.KIS_APP_SECRET);
  }

  /** 현재가 조회. 미설정 시 null */
  // eslint-disable-next-line @typescript-eslint/require-await -- KIS 연동 시 await 사용 예정
  async getPrice(ticker: string): Promise<number | null> {
    if (!this.enabled) {
      if (!this.warned) {
        this.warned = true;
        this.logger.log(
          '주가 API 키(KIS_APP_KEY/KIS_APP_SECRET) 미설정 — 적중률 비활성화. .env.example 참고',
        );
      }
      return null;
    }

    // TODO(KIS 키 입력 후 구현):
    // 1) POST https://openapi.koreainvestment.com:9443/oauth2/tokenP
    //    body: { grant_type: 'client_credentials', appkey: KIS_APP_KEY, appsecret: KIS_APP_SECRET }
    //    → access_token 발급 (24h 캐시)
    // 2) GET /uapi/domestic-stock/v1/quotations/inquire-price
    //    headers: { authorization: `Bearer ${token}`, appkey, appsecret, tr_id: 'FHKST01010100' }
    //    query: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: ticker }
    //    → Number(output.stck_prpr) 반환
    this.logger.warn(
      `KIS 연동 구현 필요 — getPrice(${ticker})는 아직 null을 반환합니다.`,
    );
    return null;
  }

  /** 여러 종목 일괄 조회 (중복 제거) */
  async getPrices(tickers: string[]): Promise<Map<string, number | null>> {
    const unique = [...new Set(tickers)];
    const entries = await Promise.all(
      unique.map(async (t) => [t, await this.getPrice(t)] as const),
    );
    return new Map(entries);
  }
}
