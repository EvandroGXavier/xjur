const axios = require('axios');

// Using the backend directly or via nest?
// We need a valid JWT token to test the backend /contacts POST endpoint.
// Let's create a script that just calls the backend service directly if we can't get a JWT.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCreateContractWithAddress() {
   try {
      // Create test tenant
      let tenant = await prisma.tenant.findFirst();
      if (!tenant) {
         tenant = await prisma.tenant.create({
             data: { name: 'Test Tenant', document: '11122233344' }
         });
      }

      console.log('Using tenant:', tenant.id);

      const payload = {
         name: "TEST COMPANY LTDA",
         personType: "PJ",
         cnpj: "18236120000158",
         companyName: "TEST COMPANY LTDA",
         addresses: [
            {
               type: "Principal",
               street: "RUA AUGUSTA",
               number: "1500",
               complement: "SALA 11",
               district: "CONSOLACAO",
               city: "SAO PAULO",
               state: "SP",
               zipCode: "01305100"
            }
         ]
      };

      // We'll mimic what ContactsService.create does:
      console.log('Attempting Prisma create...');
      const contact = await prisma.contact.create({
        data: {
          name: payload.name,
          personType: payload.personType,
          cnpj: payload.cnpj,
          companyName: payload.companyName,
          tenantId: tenant.id,
          pjDetails: { create: { cnpj: payload.cnpj, companyName: payload.companyName } },
          addresses: {
             create: payload.addresses
          }
        }
      });

      console.log('Success, contact created:', contact.id);

   } catch (error) {
       console.error('Prisma Error creating contact:', error);
   } finally {
       await prisma.$disconnect();
   }
}

testCreateContractWithAddress();
