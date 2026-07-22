import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import type {
  ApiResponse,
  AuthResponse,
  UserProfile,
} from '@daily-stocks/shared';
import { FavoritesService } from '../favorites/favorites.service';
import { AuthService } from './auth.service';
import { CurrentUserId, JwtAuthGuard } from './auth.guard';
import { UsersService } from './users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly favoritesService: FavoritesService,
  ) {}

  /** 카카오 로그인 — 모바일 SDK가 받은 accessToken 전달 */
  @Post('kakao')
  async kakao(
    @Body() body: { accessToken?: string; termsAgreed?: boolean },
  ): Promise<ApiResponse<AuthResponse>> {
    return {
      data: await this.authService.kakaoLogin(
        body.accessToken ?? '',
        body.termsAgreed ?? false,
      ),
    };
  }

  /** 애플 로그인 — 모바일이 받은 identityToken 전달 */
  @Post('apple')
  async apple(
    @Body()
    body: {
      identityToken?: string;
      termsAgreed?: boolean;
      nickname?: string;
    },
  ): Promise<ApiResponse<AuthResponse>> {
    return {
      data: await this.authService.appleLogin(
        body.identityToken ?? '',
        body.termsAgreed ?? false,
        body.nickname,
      ),
    };
  }

  /** 개발용 로그인 (프로덕션 비활성) */
  @Post('dev')
  dev(
    @Body() body: { nickname?: string; termsAgreed?: boolean },
  ): ApiResponse<AuthResponse> {
    return {
      data: this.authService.devLogin(
        body.nickname ?? '',
        body.termsAgreed ?? false,
      ),
    };
  }

  /** 회원정보 */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUserId() userId: string): ApiResponse<UserProfile> {
    const user = this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException({
        error: {
          code: 'USER_NOT_FOUND',
          message: '사용자를 찾을 수 없습니다.',
        },
      });
    }
    return { data: user };
  }

  /** 회원 탈퇴 — 사용자 데이터(관심 종목 포함) 삭제 */
  @Delete('me')
  @UseGuards(JwtAuthGuard)
  withdraw(@CurrentUserId() userId: string): ApiResponse<{ removed: true }> {
    this.favoritesService.removeUser(userId);
    this.usersService.remove(userId);
    return { data: { removed: true } };
  }
}
