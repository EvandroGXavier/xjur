const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('Aplicando migration...');
    
    // Adicionar colunas
    await prisma.$executeRawUnsafe('ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "personType" TEXT DEFAULT \'PF\'');
    await prisma.$executeRawUnsafe('ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "cpf" TEXT');
    await prisma.$executeRawUnsafe('ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "cnpj" TEXT');
    await prisma.$executeRawUnsafe('ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "rg" TEXT');
    await prisma.$executeRawUnsafe('ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3)');
    await prisma.$executeRawUnsafe('ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "companyName" TEXT');
    await prisma.$executeRawUnsafe('ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "stateRegistration" TEXT');
    await prisma.$executeRawUnsafe('ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "category" TEXT');
    
    console.log('Colunas adicionadas com sucesso!');
    
    // Remover constraint unique
    await prisma.$executeRawUnsafe('ALTER TABLE "contacts" DROP CONSTRAINT IF EXISTS "contacts_document_key"');
    console.log('Constraint removida!');
    
    // Criar índices
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "contacts_cpf_idx" ON "contacts"("cpf")');
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "contacts_cnpj_idx" ON "contacts"("cnpj")');
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "contacts_personType_idx" ON "contacts"("personType")');
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "contacts_category_idx" ON "contacts"("category")');
    
    console.log('Índices criados com sucesso!');
    console.log('Migration aplicada com sucesso!');
  } catch (error) {
    console.error('Erro ao aplicar migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();
