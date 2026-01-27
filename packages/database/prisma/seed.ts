
import { PrismaClient } from '@prisma/client'

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
  const email = 'evandro@conectionmg.com.br'; // Email do SuperAdmin
  const password = 'admin'; // Senha provisória

  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (!existingUser) {
    console.log(`Creating SuperAdmin user: ${email}`);
    await prisma.user.create({
      data: {
        name: 'SuperAdmin Dr.X',
        email: email,
        password: password, // TODO: Hash password in production
        role: 'OWNER',
        tenantId: tenant.id
      }
    });
    console.log('SuperAdmin created successfully.');
  } else {
    console.log('SuperAdmin already exists.');
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
