import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { join } from 'path';
import { json, urlencoded } from 'express';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '@drx/database';
import { TrustedDeviceService } from './auth/trusted-device.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(json({ limit: '500mb' }));
  app.use(urlencoded({ extended: true, limit: '500mb' }));

  app.enableCors({
    origin: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Token'],
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.setGlobalPrefix('api');

  // Protege /storage (uploads) com JWT + dispositivo confiável + validação por tenant.
  const prisma = app.get(PrismaService);
  const trustedDeviceService = app.get(TrustedDeviceService);
  const jwtSecret = process.env.JWT_SECRET || 'drx-default-secret-change-me-in-production';

  const isMediaPathAllowedForTenant = async (tenantId: string, mediaUrl: string) => {
    const [agentMessage, ticketMessage, communicationLog] = await Promise.all([
      prisma.agentMessage.findFirst({
        where: { tenantId, mediaUrl },
        select: { id: true },
      }),
      prisma.ticketMessage.findFirst({
        where: { mediaUrl, ticket: { tenantId } },
        select: { id: true },
      }),
      prisma.communicationLog.findFirst({
        where: { tenantId, mediaUrl },
        select: { id: true },
      }),
    ]);

    return Boolean(agentMessage || ticketMessage || communicationLog);
  };

  app.use(
    '/storage',
    async (req: any, res: any, next: any) => {
      try {
        if (String(req.method || '').toUpperCase() === 'OPTIONS') {
          return res.sendStatus(204);
        }

        const authHeader = String(req.headers?.authorization || '');
        if (!authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ message: 'Não autenticado' });
        }

        const token = authHeader.slice('Bearer '.length).trim();
        const payload: any = jwt.verify(token, jwtSecret);
        const tenantId = payload?.tenantId;
        const userId = payload?.sub;

        if (!tenantId || !userId) {
          return res.status(401).json({ message: 'Token inválido' });
        }

        const header = req.headers?.['x-device-token'];
        const deviceToken = Array.isArray(header) ? header[0] : header;
        await trustedDeviceService.assertTrustedDevice({
          tenantId,
          userId,
          deviceToken,
        });

        const relativePath = String(req.path || '').replace(/^\/+/, '');
        const mediaUrl = `storage/${relativePath}`;

        const allowed = await isMediaPathAllowedForTenant(tenantId, mediaUrl);
        if (!allowed) {
          return res.status(404).end();
        }

        return next();
      } catch {
        return res.status(401).json({ message: 'Não autorizado' });
      }
    },
    express.static(join(process.cwd(), 'storage')),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  await app.listen(3000);
  console.log(`🚀 DR.X API está rodando em: http://localhost:3000/api`);
}

bootstrap();
