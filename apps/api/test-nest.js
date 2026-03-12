const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runLocalApiTest() {
  let server;
  try {
     // We will temporarily bypass Auth by finding a valid user and generating a token, 
     // or just calling the service directly using an exact payload.
     // To keep it simple, let's call the `ContactsService.create` directly just like the controller does.
     const { Test } = require('@nestjs/testing');
     const { AppModule } = require('./src/app.module');
     
     console.log('Bootstrapping Nest context...');
     const moduleFixture = await Test.createTestingModule({
       imports: [AppModule],
     }).compile();

     const app = moduleFixture.createNestApplication();
     await app.init();
     
     const contactsService = app.get('ContactsService');
     const tenant = await prisma.tenant.findFirst();

     const payload = {
        name: "TEST COMPANY",
        personType: "PJ",
        cnpj: "18236120000158",
        companyName: "TEST COMPANY",
        addresses: [
           {
             type: 'Principal',
             street: 'RUA BRIG FARIA LIMA',
             number: '1500',
             complement: '',
             district: 'CONSOLACAO',
             city: 'SAO PAULO',
             state: 'SP',
             zipCode: '01305100'
           }
        ]
     };

     console.log('Calling ContactsService.create()...');
     const resCreate = await contactsService.create(payload, tenant.id);
     console.log('ContactsService.create SUCCESS:', resCreate.id);

     const updatePayload = {
        name: "TEST COMPANY UPDATED",
        addresses: [
           {
             type: 'Principal',
             street: 'RUA BRIG FARIA LIMA',
             number: '2000',
             complement: '',
             district: 'CONSOLACAO',
             city: 'SAO PAULO',
             state: 'SP',
             zipCode: '01305100'
           }
        ]
     };
     console.log('\nCalling ContactsService.update()...');
     const resUpdate = await contactsService.update(resCreate.id, updatePayload);
     console.log('ContactsService.update SUCCESS:', resUpdate.id);
     
     // Check if address was actually updated:
     const check = await prisma.contact.findUnique({ where: { id: resCreate.id }, include: { addresses: true } });
     console.log('Addresses after update:', check.addresses.length, check.addresses);
     
     await app.close();
  } catch(e) {
     console.error('Nest Error:', e.message);
     if (e.response) console.error(e.response);
  } finally {
     await prisma.$disconnect();
  }
}

runLocalApiTest();
