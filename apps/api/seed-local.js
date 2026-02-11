const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@drx.local';
  const password = '123';
  const hashedPassword = await bcrypt.hash(password, 10);

  // 1. Create Tenant
  const tenant = await prisma.tenant.upsert({
    where: { document: '00000000000191' },
    update: {},
    create: {
      name: 'Dr.X Local Dev',
      document: '00000000000191',
      isActive: true,
    },
  });

  // 2. Create User
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      tenantId: tenant.id,
    },
    create: {
      email,
      name: 'Admin Local',
      password: hashedPassword,
      role: 'OWNER',
      tenantId: tenant.id,
    },
  });

  console.log(`Created user: ${user.email} (Password: ${password})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
