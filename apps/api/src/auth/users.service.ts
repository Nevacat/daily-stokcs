import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { AuthProvider, UserProfile } from '@daily-stocks/shared';
import { JsonStore } from '../common/json-store';

interface StoredUser extends UserProfile {
  /** 제공자 쪽 고유 id (카카오 회원번호, 애플 sub 등) */
  providerId: string;
}

@Injectable()
export class UsersService {
  private readonly store = new JsonStore<StoredUser[]>('users');
  private users: StoredUser[] = this.store.load() ?? [];

  findById(id: string): UserProfile | null {
    return this.users.find((u) => u.id === id) ?? null;
  }

  findByProvider(
    provider: AuthProvider,
    providerId: string,
  ): UserProfile | null {
    return (
      this.users.find(
        (u) => u.provider === provider && u.providerId === providerId,
      ) ?? null
    );
  }

  create(input: {
    provider: AuthProvider;
    providerId: string;
    nickname: string;
    email?: string;
  }): UserProfile {
    const now = new Date().toISOString();
    const user: StoredUser = {
      id: randomUUID(),
      provider: input.provider,
      providerId: input.providerId,
      nickname: input.nickname,
      email: input.email,
      termsAgreedAt: now,
      createdAt: now,
    };
    this.users = [...this.users, user];
    this.store.save(this.users);
    return user;
  }

  /** 회원 탈퇴 — 사용자 레코드 삭제 */
  remove(id: string): void {
    this.users = this.users.filter((u) => u.id !== id);
    this.store.save(this.users);
  }
}
