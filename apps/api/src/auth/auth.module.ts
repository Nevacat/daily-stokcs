import { Global, Module } from '@nestjs/common';
import { FavoritesModule } from '../favorites/favorites.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from './users.service';

/** Global — 다른 모듈이 import 없이 JwtAuthGuard(AuthService)를 쓸 수 있게 한다 */
@Global()
@Module({
  imports: [FavoritesModule],
  controllers: [AuthController],
  providers: [AuthService, UsersService],
  exports: [AuthService, UsersService],
})
export class AuthModule {}
