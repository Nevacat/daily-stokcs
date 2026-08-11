import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import type {
  ApiResponse,
  Favorites,
  PaperPortfolio,
} from '@daily-stocks/shared';
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

  /** 모의 포트폴리오 — 담은 시점 가격 대비 등락률 (실제 매매 아님) */
  @Get('portfolio')
  async portfolio(
    @CurrentUserId() userId: string,
  ): Promise<ApiResponse<PaperPortfolio>> {
    const data = await this.favoritesService.portfolio(userId);
    return { data, meta: { collectedAt: data.asOf } };
  }

  @Put()
  async update(
    @CurrentUserId() userId: string,
    @Body() body: Partial<Favorites>,
  ): Promise<ApiResponse<Favorites>> {
    return { data: await this.favoritesService.update(userId, body) };
  }

  @Post('tickers/:ticker/toggle')
  async toggle(
    @CurrentUserId() userId: string,
    @Param('ticker') ticker: string,
  ): Promise<ApiResponse<Favorites>> {
    return { data: await this.favoritesService.toggleTicker(userId, ticker) };
  }
}
