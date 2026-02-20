
import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // 1. Criar Planos
  const planFull = await prisma.plan.upsert({
    where: { id: 'plan-full' }, // Usando ID fixo para facilitar upsert, mas schema usa uuid por padrão. Vamos ajustar finding.
    create: {
      name: 'Full',
      maxUsers: 999,
      maxStorage: 10000,
      price: 299.00
    },
    update: {}
  }).catch(async () => {
     // Fallback text search if ID fails (usually for UUIDs we generate one or search by name if unique, but name isn't unique in schema)
     // Let's just create if not exists based on name logic or cleanup
     // Actually for seed, it's better to clean or just create.
     return prisma.plan.create({
        data: { name: 'Full', maxUsers: 999, maxStorage: 10000, price: 299.00 }
     })
  });
  
  // Melhor abordagem para garantir Planos:
  const plans = [
    { name: 'Basic', maxUsers: 1, maxStorage: 1000, price: 99.00 },
    { name: 'Pro', maxUsers: 5, maxStorage: 5000, price: 199.00 },
    { name: 'Full', maxUsers: 999, maxStorage: 10000, price: 299.00 }
  ];

  for (const p of plans) {
    const exists = await prisma.plan.findFirst({ where: { name: p.name } });
    if (!exists) {
        await prisma.plan.create({ data: p });
    }
  }

  const fullPlan = await prisma.plan.findFirst({ where: { name: 'Full' } });

  // 2. Criar Tenant Principal (Dr.X Matriz)
  const tenantCnpj = '00000000000000';
  let tenant = await prisma.tenant.findUnique({
    where: { document: tenantCnpj }
  });

  if (!tenant) {
    console.log('Creating default tenant...');
    tenant = await prisma.tenant.create({
      data: {
        name: 'Dr.X Matriz',
        document: tenantCnpj,
        planId: fullPlan?.id,
        isActive: true
      }
    });
  }

  // 3. Criar SuperAdmin User
  const emailEx = 'evandro@conectionmg.com.br';
  const passwordEx = 'admin';

  const userEx = await prisma.user.findUnique({ where: { email: emailEx } });
  if (!userEx) {
    await prisma.user.create({
      data: {
        name: 'SuperAdmin Dr.X',
        email: emailEx,
        password: await bcrypt.hash(passwordEx, 10),
        role: 'OWNER',
        tenantId: tenant.id
      }
    });
    console.log(`User created: ${emailEx}`);
  }

  // 4. Criar Local Admin (para testes do usuário)
  const localEmail = 'admin@drx.local';
  const localPass = '123';

  const localUser = await prisma.user.findUnique({ where: { email: localEmail } });
  if (!localUser) {
    await prisma.user.create({
      data: {
        name: 'Admin Local',
        email: localEmail,
        password: await bcrypt.hash(localPass, 10),
        role: 'ADMIN',
        tenantId: tenant.id
      }
    });
    console.log(`User created: ${localEmail} / ${localPass}`);
  } else {
    // Garantir a senha correta se já existir (com hash)
    await prisma.user.update({
        where: { email: localEmail },
        data: { password: await bcrypt.hash(localPass, 10) }
    });
    console.log(`User updated: ${localEmail} / ${localPass}`);
  }

  // 5. Criar Admin User Solicitado (admin@drx.com / admin)
  const requestedEmail = 'admin@drx.com';
  const requestedPass = 'admin';

  const requestedUser = await prisma.user.findUnique({ where: { email: requestedEmail } });
  if (!requestedUser) {
      await prisma.user.create({
          data: {
              name: 'Admin Demo',
              email: requestedEmail,
              password: await bcrypt.hash(requestedPass, 10),
              role: 'OWNER', // Dono para ter full access
              tenantId: tenant.id
          }
      });
      console.log(`User created: ${requestedEmail} / ${requestedPass}`);
  } else {
      // Atualizar hash caso a senha tenha mudado ou para garantir o hash correto
      await prisma.user.update({
          where: { email: requestedEmail },
          data: { password: await bcrypt.hash(requestedPass, 10) }
      });
      console.log(`User updated: ${requestedEmail} / ${requestedPass}`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
