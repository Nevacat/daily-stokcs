import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';

export interface AuthedRequest extends Request {
  userId: string;
}

/** Authorization: Bearer <token> 검증 후 request.userId 주입 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
      });
    }
    request.userId = this.authService.verifyToken(header.slice(7));
    return true;
  }
}

/** 컨트롤러에서 현재 사용자 id를 꺼내는 데코레이터 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string =>
    context.switchToHttp().getRequest<AuthedRequest>().userId,
);
