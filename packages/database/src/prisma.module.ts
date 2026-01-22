import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Isso torna o banco visível para o sistema inteiro automaticamente
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}