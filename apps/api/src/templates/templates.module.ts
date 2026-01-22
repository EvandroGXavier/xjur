import { Module } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { TemplatesController } from './templates.controller';
import { PrismaModule } from '@dr-x/database'; // Importando a conexão com o banco

@Module({
  imports: [PrismaModule], // Adicionando aqui para resolver o erro do log
  controllers: [TemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
