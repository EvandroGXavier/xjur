import { Module } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { EnrichmentService } from './enrichment.service';
import { ContactsController } from './contacts.controller';
<<<<<<< HEAD
import { PrismaModule } from '@dr-x/database';
=======
import { PrismaModule } from '@drx/database';
>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69

@Module({
  imports: [PrismaModule],
  controllers: [ContactsController],
  providers: [ContactsService, EnrichmentService],
})
export class ContactsModule {}
