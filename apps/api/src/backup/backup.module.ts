import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { BackupGateway } from './backup.gateway';

@Module({
  imports: [AuthModule],
  controllers: [BackupController],
  providers: [BackupService, BackupGateway],
  exports: [BackupService],
})
export class BackupModule {}
