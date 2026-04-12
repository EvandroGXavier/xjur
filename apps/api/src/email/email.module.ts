import { Module, forwardRef } from '@nestjs/common';
import { EmailService } from './email.service';
import { PrismaService } from '../prisma.service';
import { CommunicationsModule } from '../communications/communications.module';

@Module({
  imports: [forwardRef(() => CommunicationsModule)],
  providers: [EmailService, PrismaService],
  exports: [EmailService],
})
export class EmailModule {}
