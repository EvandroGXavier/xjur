import { Module } from '@nestjs/common';
import { PrismaModule } from '@dr-x/database';
import { TemplatesModule } from './templates/templates.module';
import { DocumentsModule } from './documents/documents.module';

@Module({
  imports: [
    PrismaModule, 
    TemplatesModule,
    DocumentsModule,
  ],
})
export class AppModule {}