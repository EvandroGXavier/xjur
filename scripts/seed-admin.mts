
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Seed...');

  // 1. Create or Find Plan
  let plan = await prisma.plan.findFirst({ where: { name: 'FULL' } });
  if (!plan) {
    console.log('Creating Plan FULL...');
    plan = await prisma.plan.create({
      data: {
        name: 'FULL',
        maxUsers: 999,
        maxStorage: 10000,
        price: 0.00
      }
    });
  }

  // 2. Create or Find Tenant
  let tenant = await prisma.tenant.findUnique({ where: { document: '00000000000100' } });
  if (!tenant) {
    console.log('Creating Tenant "Dr.X HQ"...');
    tenant = await prisma.tenant.create({
      data: {
        name: 'Dr.X HQ',
        document: '00000000000100',
        planId: plan.id,
        isActive: true
      }
    });
  }

  // 3. Create or Find User
  let user = await prisma.user.findUnique({ where: { email: 'admin@drx.com' } });
  if (!user) {
    console.log('Creating User "admin@drx.com"...');
    user = await prisma.user.create({
      data: {
        name: 'Super Admin',
        email: 'admin@drx.com',
        password: 'admin', // Plain text for now as per auth.service.ts
        role: 'OWNER',
        tenantId: tenant.id
      }
    });
  }

  console.log('✅ Seed Complete!');
  console.log('-------------------------------------------');
  console.log('Login Email: admin@drx.com');
  console.log('Login Pass:  admin');
  console.log('Tenant ID:   ' + tenant.id);
  console.log('-------------------------------------------');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
