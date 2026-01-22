import { Module } from '@nestjs/common';
import { PrismaModule } from '@dr-x/database'; // Caminho do seu pacote de banco
// ... outros imports

@Module({
  imports: [
    PrismaModule, // 👈 Carregado aqui, ele se torna global para todos os outros
    TemplatesModule,
    DocumentsModule,
    // Note que agora não precisaremos mais importar PrismaModule dentro deles!
  ],
})
export class AppModule {}