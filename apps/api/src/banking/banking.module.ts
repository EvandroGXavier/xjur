import { Module } from '@nestjs/common';
import { BankingController } from './banking.controller';
import { BankingService } from './banking.service';
import { SecurityModule } from '../security/security.module';
import { InterBankingProvider } from './providers/inter/inter-banking.provider';

@Module({
  imports: [SecurityModule],
  controllers: [BankingController],
  providers: [BankingService, InterBankingProvider],
  exports: [BankingService],
})
export class BankingModule {}
