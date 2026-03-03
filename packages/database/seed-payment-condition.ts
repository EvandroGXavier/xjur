import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany();
  
  if (tenants.length === 0) {
    console.log("No tenants found.");
    return;
  }

  for (const tenant of tenants) {
    const existing = await prisma.paymentCondition.findFirst({
      where: { tenantId: tenant.id }
    });

    if (!existing) {
      await prisma.paymentCondition.create({
        data: {
          tenantId: tenant.id,
          name: "À Vista",
          surcharge: 0,
          discount: 0,
          active: true,
          installments: {
            create: [
              {
                installment: 1,
                days: 0,
                percentage: 100
              }
            ]
          }
        }
      });
      console.log(`Created 'À Vista' payment condition for tenant ${tenant.id}`);
    } else {
      console.log(`Tenant ${tenant.id} already has a payment condition.`);
    }
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
