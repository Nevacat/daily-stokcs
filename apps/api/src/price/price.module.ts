import { Module } from '@nestjs/common';
import { PriceService } from './price.service';
import { QuotesController } from './quotes.controller';

@Module({
  controllers: [QuotesController],
  providers: [PriceService],
  exports: [PriceService],
})
export class PriceModule {}
