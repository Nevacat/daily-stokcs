import { Controller, Get, Query } from '@nestjs/common';
import type {
  ApiResponse,
  NewsItem,
  Sector,
  Sentiment,
} from '@daily-stocks/shared';
import { NewsService } from './news.service';

@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  list(
    @Query('sector') sector?: Sector,
    @Query('ticker') ticker?: string,
    @Query('sentiment') sentiment?: Sentiment,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): ApiResponse<NewsItem[]> {
    const { items, nextCursor } = this.newsService.query({
      sector,
      ticker,
      sentiment,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
    return { data: items, meta: { cursor: nextCursor } };
  }
}
