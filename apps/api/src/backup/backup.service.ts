import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { spawn, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

type ToolInfo = {
  available: boolean;
  command: string | null;
  version: string | null;
};

type DatabaseConfig = {
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
  sslmode?: string;
};

@Injectable()
export class BackupService {
  private readonly backupsDir = path.join(process.cwd(), 'storage', 'backups');

  getBackupsDirectory() {
    this.ensureBackupsDirectory();
    return this.backupsDir;
  }

  getStatus() {
    const database = this.getDatabaseConfig();
    return {
      database: {
        host: database.host,
        port: database.port,
        database: database.database,
        username: database.username,
        sslmode: database.sslmode || 'disable',
      },
      tools: {
        pgDump: this.resolveTool('pg_dump'),
        pgRestore: this.resolveTool('pg_restore'),
        psql: this.resolveTool('psql'),
      },
      backups: this.listBackups(),
      restoreConfirmationKeyword: 'RESTAURAR',
      recommendations: [
        'Produção: gere o backup, aguarde a conclusão e faça o download do arquivo .backup.',
        'Teste: faça upload do mesmo arquivo e use restaurar somente na base de homologação.',
        'Restauração completa pode sobrescrever dados. Execute preferencialmente em janela controlada.',
      ],
    };
  }

  listBackups() {
    this.ensureBackupsDirectory();

    return fs
      .readdirSync(this.backupsDir)
      .filter((fileName) => /\.(backup|dump|sql)$/i.test(fileName))
      .map((fileName) => {
        const filePath = path.join(this.backupsDir, fileName);
        const stats = fs.statSync(filePath);
        return {
          fileName,
          size: stats.size,
          createdAt: stats.birthtime.toISOString(),
          updatedAt: stats.mtime.toISOString(),
          extension: path.extname(fileName).toLowerCase(),
        };
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  getBackupMetadata(fileName: string) {
    const safeFileName = this.sanitizeFileName(fileName);
    const backup = this.listBackups().find((item) => item.fileName === safeFileName);
    if (!backup) {
      throw new NotFoundException('Backup nao encontrado');
    }
    return backup;
  }

  getBackupPath(fileName: string) {
    return path.join(this.getBackupsDirectory(), this.sanitizeFileName(fileName));
  }

  async createBackup(label?: string) {
    const pgDump = this.resolveRequiredTool('pg_dump');
    const database = this.getDatabaseConfig();
    const stamp = this.buildTimestamp();
    const safeLabel = this.sanitizeLabel(label || 'backup-completo');
    const fileName = `${stamp}-${safeLabel}-${this.sanitizeLabel(database.database)}.backup`;
    const filePath = path.join(this.getBackupsDirectory(), fileName);

    await this.runCommand(
      pgDump.command!,
      [
        '--format=custom',
        '--clean',
        '--if-exists',
        '--no-owner',
        '--no-privileges',
        '--host',
        database.host,
        '--port',
        database.port,
        '--username',
        database.username,
        '--file',
        filePath,
        database.database,
      ],
      this.buildPgEnv(database),
      'gerar backup',
      'pg_dump',
    );

    return {
      message: 'Backup criado com sucesso',
      backup: this.getBackupMetadata(fileName),
    };
  }

  registerUploadedBackup(fileName: string) {
    return {
      message: 'Backup enviado com sucesso',
      backup: this.getBackupMetadata(fileName),
    };
  }

  async restoreBackup(fileName: string) {
    const safeFileName = this.sanitizeFileName(fileName);
    const filePath = this.getBackupPath(safeFileName);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Backup nao encontrado');
    }

    const database = this.getDatabaseConfig();
    const extension = path.extname(safeFileName).toLowerCase();

    if (extension === '.sql') {
      const psql = this.resolveRequiredTool('psql');
      await this.runCommand(
        psql.command!,
        [
          '--host',
          database.host,
          '--port',
          database.port,
          '--username',
          database.username,
          '--dbname',
          database.database,
          '--file',
          filePath,
        ],
        this.buildPgEnv(database),
        'restaurar backup SQL',
        'psql',
      );
    } else {
      const pgRestore = this.resolveRequiredTool('pg_restore');
      await this.runCommand(
        pgRestore.command!,
        [
          '--clean',
          '--if-exists',
          '--no-owner',
          '--no-privileges',
          '--host',
          database.host,
          '--port',
          database.port,
          '--username',
          database.username,
          '--dbname',
          database.database,
          filePath,
        ],
        this.buildPgEnv(database),
        'restaurar backup',
        'pg_restore',
      );
    }

    return {
      message: 'Restauracao concluida com sucesso',
      backup: this.getBackupMetadata(safeFileName),
      restoredDatabase: database.database,
    };
  }

  deleteBackup(fileName: string) {
    const safeFileName = this.sanitizeFileName(fileName);
    const filePath = this.getBackupPath(safeFileName);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Backup nao encontrado');
    }

    fs.unlinkSync(filePath);
    return { message: 'Backup removido com sucesso' };
  }

  sanitizeFileName(fileName: string) {
    return (fileName || '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private sanitizeLabel(label: string) {
    return (label || 'backup')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
  }

  private ensureBackupsDirectory() {
    if (!fs.existsSync(this.backupsDir)) {
      fs.mkdirSync(this.backupsDir, { recursive: true });
    }
  }

  private buildTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}-${hours}${minutes}${seconds}`;
  }

  private getDatabaseConfig(): DatabaseConfig {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new InternalServerErrorException('DATABASE_URL nao configurada');
    }

    let parsed: URL;
    try {
      parsed = new URL(databaseUrl);
    } catch (error) {
      throw new InternalServerErrorException('DATABASE_URL invalida');
    }

    const database = parsed.pathname.replace(/^\//, '');
    if (!database) {
      throw new InternalServerErrorException('Nome do banco nao encontrado na DATABASE_URL');
    }

    return {
      host: parsed.hostname,
      port: parsed.port || '5432',
      username: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database,
      sslmode: parsed.searchParams.get('sslmode') || process.env.PGSSLMODE || undefined,
    };
  }

  private buildPgEnv(config: DatabaseConfig) {
    return {
      PGPASSWORD: config.password,
      ...(config.sslmode ? { PGSSLMODE: config.sslmode } : {}),
    };
  }

  private resolveRequiredTool(toolName: 'pg_dump' | 'pg_restore' | 'psql') {
    const tool = this.resolveTool(toolName);
    if (!tool.available || !tool.command) {
      throw new BadRequestException(
        `${toolName} nao encontrado no servidor. Configure o PATH ou as variaveis ${toolName.toUpperCase()}_PATH/PG_BIN_PATH antes de usar backup.`,
      );
    }
    return tool;
  }

  private resolveTool(toolName: 'pg_dump' | 'pg_restore' | 'psql'): ToolInfo {
    const candidates = this.buildToolCandidates(toolName);

    for (const candidate of candidates) {
      const result = spawnSync(candidate, ['--version'], {
        encoding: 'utf8',
        shell: false,
      });

      if (!result.error && result.status === 0) {
        const version = (result.stdout || result.stderr || '')
          .split(/\r?\n/)
          .find(Boolean)
          ?.trim() || null;
        return {
          available: true,
          command: candidate,
          version,
        };
      }
    }

    return {
      available: false,
      command: null,
      version: null,
    };
  }

  private buildToolCandidates(toolName: 'pg_dump' | 'pg_restore' | 'psql') {
    const toolEnvMap = {
      pg_dump: process.env.PG_DUMP_PATH,
      pg_restore: process.env.PG_RESTORE_PATH,
      psql: process.env.PSQL_PATH,
    };
    const candidates = new Set<string>();
    const suffix = process.platform === 'win32' ? '.exe' : '';

    if (toolEnvMap[toolName]) {
      candidates.add(toolEnvMap[toolName] as string);
    }

    if (process.env.PG_BIN_PATH) {
      candidates.add(path.join(process.env.PG_BIN_PATH, `${toolName}${suffix}`));
      candidates.add(path.join(process.env.PG_BIN_PATH, toolName));
    }

    candidates.add(`${toolName}${suffix}`);
    candidates.add(toolName);

    if (process.platform === 'win32') {
      const knownVersions = ['17', '16', '15', '14', '13', '12'];
      for (const version of knownVersions) {
        candidates.add(
          path.join(
            'C:\\Program Files\\PostgreSQL',
            version,
            'bin',
            `${toolName}.exe`,
          ),
        );
      }
      // Common path when pgAdmin 4 is installed
      candidates.add(
        path.join('C:\\Program Files\\pgAdmin 4\\runtime', `${toolName}.exe`),
      );
    }

    return [...candidates];
  }

  private async runCommand(
    command: string,
    args: string[],
    extraEnv: Record<string, string | undefined>,
    actionLabel: string,
    toolName?: string,
  ) {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, {
        env: {
          ...process.env,
          ...extraEnv,
        },
        shell: false,
      });

      let stderr = '';

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => {
        reject(
          new InternalServerErrorException(
            `Falha ao ${actionLabel}: ${error.message}`,
          ),
        );
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        // pg_restore often returns 1 for minor warnings/ignored errors (like version mismatches in parameters)
        if (
          code === 1 &&
          (toolName === 'pg_restore' || actionLabel.includes('restaurar')) &&
          (stderr.includes('errors ignored on restore') || stderr.includes('warnings ignored on restore'))
        ) {
          console.warn(
            `[BACKUP] ${toolName || 'Comando'} finalizado com avisos (code 1), mas erros foram ignorados: ${stderr}`,
          );
          resolve();
          return;
        }

        reject(
          new BadRequestException(
            `Nao foi possivel ${actionLabel}. ${stderr.trim() || 'Verifique as credenciais do banco e as ferramentas PostgreSQL.'}`,
          ),
        );
      });
    });
  }
}
