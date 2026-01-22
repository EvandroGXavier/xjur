import { Module } from '@nestjs/common';
import { PrismaModule } from '@dr-x/database';
import { TemplatesModule } from './templates/templates.module';
import { DocumentsModule } from './documents/documents.module';

@Module({
  imports: [
    PrismaModule, // O banco Global que você sugeriu
    TemplatesModule,
    DocumentsModule,
  ],
})
export class AppModule {}