-- AlterTable: Adicionar novos campos ao modelo Contact
ALTER TABLE "contacts" ADD COLUMN "personType" TEXT DEFAULT 'PF';
ALTER TABLE "contacts" ADD COLUMN "cpf" TEXT;
ALTER TABLE "contacts" ADD COLUMN "cnpj" TEXT;
ALTER TABLE "contacts" ADD COLUMN "rg" TEXT;
ALTER TABLE "contacts" ADD COLUMN "birthDate" TIMESTAMP(3);
ALTER TABLE "contacts" ADD COLUMN "companyName" TEXT;
ALTER TABLE "contacts" ADD COLUMN "stateRegistration" TEXT;
ALTER TABLE "contacts" ADD COLUMN "category" TEXT;

-- Atualizar constraint unique do document para permitir null
ALTER TABLE "contacts" DROP CONSTRAINT IF EXISTS "contacts_document_key";

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS "contacts_cpf_idx" ON "contacts"("cpf");
CREATE INDEX IF NOT EXISTS "contacts_cnpj_idx" ON "contacts"("cnpj");
CREATE INDEX IF NOT EXISTS "contacts_personType_idx" ON "contacts"("personType");
CREATE INDEX IF NOT EXISTS "contacts_category_idx" ON "contacts"("category");
