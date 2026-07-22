import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import type {
  AuthProvider,
  AuthResponse,
  UserProfile,
} from '@daily-stocks/shared';
import { UsersService } from './users.service';

/**
 * 소셜 로그인 (카카오/애플) + 자체 JWT 세션.
 *
 * ┌─ 활성화 방법 ────────────────────────────────────────────────┐
 * │ 서버 쪽에 필요한 키는 JWT_SECRET 뿐이다 (.env.example 참고).     │
 * │ - 카카오: 앱 키는 "모바일 SDK"에서 액세스 토큰을 받을 때 필요.    │
 * │   서버는 받은 토큰을 카카오 API로 검증만 하므로 키가 필요 없다.   │
 * │   약관 동의를 카카오 동의화면에서 받으려면 카카오 개발자 콘솔의   │
 * │   [동의항목]에 등록하면 된다.                                   │
 * │ - 애플: APPLE_BUNDLE_ID(기본 com.dailystocks)로 identityToken을 │
 * │   애플 공개키(JWKS)로 검증한다. 별도 시크릿 불필요.              │
 * │ 모바일 쪽 설정은 apps/mobile/src/auth/README.md 참고.           │
 * └──────────────────────────────────────────────────────────────┘
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly appleJwks = new JwksClient({
    jwksUri: 'https://appleid.apple.com/auth/keys',
  });

  constructor(private readonly usersService: UsersService) {}

  private get secret(): string {
    // 프로덕션에서는 반드시 .env의 JWT_SECRET 사용
    return process.env.JWT_SECRET ?? 'detok-dev-secret';
  }

  issueToken(userId: string): string {
    return jwt.sign({ sub: userId }, this.secret, { expiresIn: '30d' });
  }

  /** Bearer 토큰 검증 → userId. 실패 시 401 */
  verifyToken(token: string): string {
    try {
      const payload = jwt.verify(token, this.secret);
      const sub = typeof payload === 'object' ? payload.sub : undefined;
      if (typeof sub !== 'string') throw new Error('sub 없음');
      return sub;
    } catch {
      throw new UnauthorizedException({
        error: { code: 'INVALID_TOKEN', message: '유효하지 않은 토큰입니다.' },
      });
    }
  }

  /** 신규 가입 공통 처리 — 약관 동의 필수 (기존 회원은 로그인만) */
  private loginOrSignup(
    provider: AuthProvider,
    providerId: string,
    profile: { nickname: string; email?: string },
    termsAgreed: boolean,
  ): AuthResponse {
    let user: UserProfile | null = this.usersService.findByProvider(
      provider,
      providerId,
    );
    if (!user) {
      if (!termsAgreed) {
        throw new ForbiddenException({
          error: {
            code: 'TERMS_REQUIRED',
            message: '서비스 이용약관 및 개인정보 처리방침 동의가 필요합니다.',
          },
        });
      }
      user = this.usersService.create({ provider, providerId, ...profile });
      this.logger.log(`신규 가입: ${provider} ${user.nickname}`);
    }
    return { token: this.issueToken(user.id), user };
  }

  /** 카카오 액세스 토큰 검증 → 로그인/가입 */
  async kakaoLogin(
    accessToken: string,
    termsAgreed: boolean,
  ): Promise<AuthResponse> {
    if (!accessToken) {
      throw new BadRequestException({
        error: { code: 'INVALID_BODY', message: 'accessToken이 필요합니다.' },
      });
    }
    const res = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new UnauthorizedException({
        error: {
          code: 'KAKAO_AUTH_FAILED',
          message: '카카오 인증에 실패했습니다.',
        },
      });
    }
    const me = (await res.json()) as {
      id: number;
      kakao_account?: { email?: string; profile?: { nickname?: string } };
    };
    return this.loginOrSignup(
      'kakao',
      String(me.id),
      {
        nickname: me.kakao_account?.profile?.nickname ?? '카카오 사용자',
        email: me.kakao_account?.email,
      },
      termsAgreed,
    );
  }

  /** 애플 identityToken(JWT)을 애플 공개키로 검증 → 로그인/가입 */
  async appleLogin(
    identityToken: string,
    termsAgreed: boolean,
    nickname?: string,
  ): Promise<AuthResponse> {
    if (!identityToken) {
      throw new BadRequestException({
        error: { code: 'INVALID_BODY', message: 'identityToken이 필요합니다.' },
      });
    }
    let payload: jwt.JwtPayload;
    try {
      const decoded = jwt.decode(identityToken, { complete: true });
      if (!decoded || typeof decoded === 'string')
        throw new Error('디코드 실패');
      const key = await this.appleJwks.getSigningKey(decoded.header.kid);
      payload = jwt.verify(identityToken, key.getPublicKey(), {
        issuer: 'https://appleid.apple.com',
        audience: process.env.APPLE_BUNDLE_ID ?? 'com.dailystocks',
      }) as jwt.JwtPayload;
    } catch (e) {
      this.logger.warn(`애플 토큰 검증 실패: ${String(e)}`);
      throw new UnauthorizedException({
        error: {
          code: 'APPLE_AUTH_FAILED',
          message: '애플 인증에 실패했습니다.',
        },
      });
    }
    return this.loginOrSignup(
      'apple',
      String(payload.sub),
      {
        // 애플은 최초 로그인 시에만 이름을 주므로 앱이 전달한 값을 사용
        nickname: nickname ?? 'Apple 사용자',
        email: typeof payload.email === 'string' ? payload.email : undefined,
      },
      termsAgreed,
    );
  }

  /** 개발용 로그인 — 외부 키 없이 전체 플로우 확인용. 프로덕션에서는 비활성 */
  devLogin(nickname: string, termsAgreed: boolean): AuthResponse {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException({
        error: {
          code: 'DEV_LOGIN_DISABLED',
          message: '개발용 로그인은 비활성화되어 있습니다.',
        },
      });
    }
    return this.loginOrSignup(
      'dev',
      nickname || 'dev-user',
      { nickname: nickname || '개발자' },
      termsAgreed,
    );
  }
}
