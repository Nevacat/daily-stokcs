import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { ApiResponse, Favorites } from '@daily-stocks/shared';
import { CurrentUserId, JwtAuthGuard } from '../auth/auth.guard';
import { FavoritesService } from './favorites.service';

@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  get(@CurrentUserId() userId: string): ApiResponse<Favorites> {
    return { data: this.favoritesService.get(userId) };
  }

  @Put()
  update(
    @CurrentUserId() userId: string,
    @Body() body: Partial<Favorites>,
  ): ApiResponse<Favorites> {
    return { data: this.favoritesService.update(userId, body) };
  }

  @Post('tickers/:ticker/toggle')
  toggle(
    @CurrentUserId() userId: string,
    @Param('ticker') ticker: string,
  ): ApiResponse<Favorites> {
    return { data: this.favoritesService.toggleTicker(userId, ticker) };
  }
}
