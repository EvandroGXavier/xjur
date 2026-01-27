
import { Module } from '@nestjs/common';
import { SaasService } from './saas.service';
import { SaasController } from './saas.controller';
import { PrismaModule } from '@drx/database';

@Module({
  imports: [PrismaModule],
  controllers: [SaasController],
  providers: [SaasService],
})
export class SaasModule {}
