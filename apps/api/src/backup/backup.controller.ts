import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { BackupService } from './backup.service';

@Controller('backup')
@UseGuards(JwtAuthGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get('status')
  getStatus(@CurrentUser() user: CurrentUserData) {
    this.ensureSuperAdmin(user);
    return this.backupService.getStatus();
  }

  @Post('create')
  createBackup(
    @CurrentUser() user: CurrentUserData,
    @Body() body: { label?: string },
  ) {
    this.ensureSuperAdmin(user);
    return this.backupService.createBackup(body?.label);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, callback) => {
          const backupDir = path.join(process.cwd(), 'storage', 'backups');
          if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
          }
          callback(null, backupDir);
        },
        filename: (_req, file, callback) => {
          const ext = path.extname(file.originalname || '').toLowerCase();
          const baseName = (path.basename(file.originalname || 'backup', ext) || 'backup')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9._-]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .toLowerCase();
          const stamp = new Date()
            .toISOString()
            .replace(/[-:]/g, '')
            .replace(/\..+/, '')
            .replace('T', '-');
          callback(null, `${stamp}-${baseName}${ext || '.backup'}`);
        },
      }),
      limits: {
        fileSize: 2 * 1024 * 1024 * 1024,
      },
    }),
  )
  uploadBackup(
    @CurrentUser() user: CurrentUserData,
    @UploadedFile() file: Express.Multer.File,
  ) {
    this.ensureSuperAdmin(user);
    if (!file) {
      throw new BadRequestException('Arquivo de backup obrigatorio');
    }

    return this.backupService.registerUploadedBackup(file.filename);
  }

  @Post('restore/:fileName')
  restoreBackup(
    @CurrentUser() user: CurrentUserData,
    @Param('fileName') fileName: string,
    @Body() body: { confirmation?: string },
  ) {
    this.ensureSuperAdmin(user);
    if (body?.confirmation !== 'RESTAURAR') {
      throw new BadRequestException('Confirme a restauracao digitando RESTAURAR');
    }
    return this.backupService.restoreBackup(fileName);
  }

  @Get('download/:fileName')
  downloadBackup(
    @CurrentUser() user: CurrentUserData,
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ) {
    this.ensureSuperAdmin(user);
    const backup = this.backupService.getBackupMetadata(fileName);
    const filePath = this.backupService.getBackupPath(fileName);
    return res.download(filePath, backup.fileName);
  }

  @Delete(':fileName')
  deleteBackup(
    @CurrentUser() user: CurrentUserData,
    @Param('fileName') fileName: string,
  ) {
    this.ensureSuperAdmin(user);
    return this.backupService.deleteBackup(fileName);
  }

  private ensureSuperAdmin(user: CurrentUserData) {
    const baseEmails = ['evandro@conectionmg.com.br'];
    const envEmails = (process.env.SUPERADMIN_EMAILS || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    const allowedEmails = new Set(
      [...baseEmails, ...envEmails].map((email) => email.toLowerCase()),
    );

    if (!allowedEmails.has((user?.email || '').toLowerCase())) {
      throw new UnauthorizedException('Acesso restrito ao SuperAdmin');
    }
  }
}
