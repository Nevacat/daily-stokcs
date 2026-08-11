import {
  BadRequestException,
  Controller,
  Get,
  Injectable,
  Query,
  UseGuards,
  type ExecutionContext,
} from '@nestjs/common';
import type { ApiResponse, StockEvent } from '@daily-stocks/shared';
import {
  CurrentUserId,
  JwtAuthGuard,
  type AuthedRequest,
} from '../auth/auth.guard';
import { CatalogService } from '../catalog/catalog.service';
import { EventsService, MAX_TICKERS } from './events.service';

/**
 * tickers를 지정한 조회는 공개, 관심 종목 기준(=tickers 없음) 조회만 인증을 요구한다.
 * 종목 상세는 로그인 없이도 일정을 보여줘야 하기 때문이다.
 */
@Injectable()
export class TickersOrAuthGuard extends JwtAuthGuard {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    // 값의 형태(문자열/배열/객체)는 컨트롤러가 400으로 판정한다.
    // 여기서 형태까지 보면 ?tickers=a&tickers=b 같은 잘못된 요청이 401로 둔갑한다.
    return request.query.tickers !== undefined
      ? true
      : super.canActivate(context);
  }
}

@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly catalog: CatalogService,
  ) {}

  @Get()
  @UseGuards(TickersOrAuthGuard)
  async list(
    @CurrentUserId() userId: string | undefined,
    @Query('tickers') tickers?: unknown,
  ): Promise<ApiResponse<StockEvent[]>> {
    const data =
      tickers === undefined
        ? await this.eventsService.forUser(userId ?? '')
        : await this.eventsService.build(this.parseTickers(tickers));
    return { data, meta: { collectedAt: new Date().toISOString() } };
  }

  private invalidBody(message: string): BadRequestException {
    return new BadRequestException({
      error: { code: 'INVALID_BODY', message },
    });
  }

  /**
   * `?tickers=` 값 파싱.
   * 같은 키를 두 번 보내면(`?tickers=a&tickers=b`) express가 배열로 넘기므로 문자열 여부부터 본다.
   *
   * 상한(MAX_TICKERS)은 요청의 유효성이 아니라 Yahoo 호출 횟수를 묶어두는 비용 상한이라
   * 400이 아니라 잘라낸다 — EventsService.build()·forUser()가 이미 같은 방식으로 자른다.
   * (초과를 400으로 막으면 관심 종목이 21개인 사용자만 일정 섹션이 통째로 사라진다)
   */
  private parseTickers(raw: unknown): string[] {
    if (typeof raw !== 'string') {
      throw this.invalidBody('tickers는 콤마로 구분한 문자열 하나여야 합니다.');
    }
    const tickers = [
      ...new Set(
        raw
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    ].slice(0, MAX_TICKERS);
    if (tickers.length < 1) {
      throw this.invalidBody(
        'tickers는 1개 이상의 콤마 구분 목록이어야 합니다.',
      );
    }
    const unknown = tickers.find((t) => !this.catalog.find(t));
    if (unknown) {
      throw new BadRequestException({
        error: {
          code: 'UNKNOWN_TICKER',
          message: `알 수 없는 종목입니다: ${unknown}`,
        },
      });
    }
    return tickers;
  }
}
