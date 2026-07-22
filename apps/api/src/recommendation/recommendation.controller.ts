import { Controller, Get, Param, Query } from '@nestjs/common';
import type {
  ApiResponse,
  NewsItem,
  Recommendation,
  Sector,
} from '@daily-stocks/shared';
import { NewsService } from '../news/news.service';
import { RecommendationService } from './recommendation.service';

@Controller('recommendations')
export class RecommendationController {
  constructor(
    private readonly recommendationService: RecommendationService,
    private readonly newsService: NewsService,
  ) {}

  @Get()
  list(@Query('sector') sector?: Sector): ApiResponse<Recommendation[]> {
    return { data: this.recommendationService.findAll(sector) };
  }

  /** 추천 상세: 근거 뉴스 목록 포함 (기획서 §2.3) */
  @Get(':id')
  detail(
    @Param('id') id: string,
  ): ApiResponse<{ recommendation: Recommendation; evidence: NewsItem[] }> {
    const recommendation = this.recommendationService.findOne(id);
    const evidence = this.newsService.findByIds(recommendation.newsIds);
    return { data: { recommendation, evidence } };
  }
}
