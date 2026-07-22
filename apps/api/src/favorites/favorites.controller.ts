import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import type { ApiResponse, Favorites } from '@daily-stocks/shared';
import { FavoritesService } from './favorites.service';

@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  get(): ApiResponse<Favorites> {
    return { data: this.favoritesService.get() };
  }

  @Put()
  update(@Body() body: Partial<Favorites>): ApiResponse<Favorites> {
    return { data: this.favoritesService.update(body) };
  }

  @Post('tickers/:ticker/toggle')
  toggle(@Param('ticker') ticker: string): ApiResponse<Favorites> {
    return { data: this.favoritesService.toggleTicker(ticker) };
  }
}
