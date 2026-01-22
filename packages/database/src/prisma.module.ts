import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // 👈 ISSO FAZ A MÁGICA: O banco agora é "público" para todos
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}