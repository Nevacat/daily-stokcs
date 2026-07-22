import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from './users.service';

describe('AuthService (개발용 로그인 + JWT)', () => {
  let auth: AuthService;
  let users: UsersService;

  beforeEach(() => {
    process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-test-'));
    delete process.env.NODE_ENV;
    users = new UsersService();
    auth = new AuthService(users);
  });

  it('약관 동의 없이 신규 가입하면 TERMS_REQUIRED', () => {
    expect(() => auth.devLogin('네브', false)).toThrow(ForbiddenException);
  });

  it('약관 동의 후 가입하면 토큰과 회원정보를 반환한다', () => {
    const { token, user } = auth.devLogin('네브', true);
    expect(user.nickname).toBe('네브');
    expect(user.provider).toBe('dev');
    expect(user.termsAgreedAt).toBeDefined();
    expect(auth.verifyToken(token)).toBe(user.id);
  });

  it('기존 회원은 약관 동의 여부와 무관하게 로그인된다', () => {
    const first = auth.devLogin('네브', true);
    const second = auth.devLogin('네브', false);
    expect(second.user.id).toBe(first.user.id);
  });

  it('잘못된 토큰은 INVALID_TOKEN 401', () => {
    expect(() => auth.verifyToken('garbage')).toThrow(UnauthorizedException);
  });

  it('프로덕션에서는 개발용 로그인이 비활성화된다', () => {
    process.env.NODE_ENV = 'production';
    expect(() => auth.devLogin('네브', true)).toThrow(ForbiddenException);
  });

  it('회원 탈퇴 후에는 조회되지 않고, 재로그인하면 새 계정이 된다', () => {
    const { user } = auth.devLogin('네브', true);
    users.remove(user.id);
    expect(users.findById(user.id)).toBeNull();
    const again = auth.devLogin('네브', true);
    expect(again.user.id).not.toBe(user.id);
  });
});
