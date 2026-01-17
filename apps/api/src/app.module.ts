import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ContactsModule } from './contacts/contacts.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [ContactsModule, WhatsappModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
