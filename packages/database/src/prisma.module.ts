import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Isso torna o banco visível para TODOS os módulos sem precisar importar
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}