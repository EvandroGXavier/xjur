-- CreateTable
CREATE TABLE IF NOT EXISTS "bank_accounts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "accountNumber" TEXT,
    "agency" TEXT,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- AlterTable
DO $$ 
BEGIN
    -- Adicionar bankAccountId
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='financial_records' AND column_name='bankAccountId') THEN
        ALTER TABLE "financial_records" ADD COLUMN "bankAccountId" TEXT;
    END IF;
    
    -- Adicionar paymentDate
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='financial_records' AND column_name='paymentDate') THEN
        ALTER TABLE "financial_records" ADD COLUMN "paymentDate" TIMESTAMP(3);
    END IF;
    
    -- Adicionar paymentMethod
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='financial_records' AND column_name='paymentMethod') THEN
        ALTER TABLE "financial_records" ADD COLUMN "paymentMethod" TEXT;
    END IF;
    
    -- Adicionar notes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='financial_records' AND column_name='notes') THEN
        ALTER TABLE "financial_records" ADD COLUMN "notes" TEXT;
    END IF;
    
    -- Adicionar createdAt
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='financial_records' AND column_name='createdAt') THEN
        ALTER TABLE "financial_records" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
    END IF;
    
    -- Adicionar updatedAt
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='financial_records' AND column_name='updatedAt') THEN
        ALTER TABLE "financial_records" ADD COLUMN "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
    END IF;
    
    -- Adicionar category se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='financial_records' AND column_name='category') THEN
        ALTER TABLE "financial_records" ADD COLUMN "category" TEXT;
    END IF;
END $$;

-- AlterTable - Permitir processId NULL
ALTER TABLE "financial_records" ALTER COLUMN "processId" DROP NOT NULL;

-- AddForeignKey
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'financial_records_bankAccountId_fkey'
    ) THEN
        ALTER TABLE "financial_records" ADD CONSTRAINT "financial_records_bankAccountId_fkey" 
        FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'bank_accounts_tenantId_fkey'
    ) THEN
        ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_tenantId_fkey" 
        FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_financial_records_tenantId" ON "financial_records"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_financial_records_bankAccountId" ON "financial_records"("bankAccountId");
CREATE INDEX IF NOT EXISTS "idx_financial_records_status" ON "financial_records"("status");
CREATE INDEX IF NOT EXISTS "idx_financial_records_type" ON "financial_records"("type");
CREATE INDEX IF NOT EXISTS "idx_financial_records_dueDate" ON "financial_records"("dueDate");
CREATE INDEX IF NOT EXISTS "idx_bank_accounts_tenantId" ON "bank_accounts"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_bank_accounts_isActive" ON "bank_accounts"("isActive");

-- Update existing records
UPDATE "financial_records" 
SET "createdAt" = CURRENT_TIMESTAMP 
WHERE "createdAt" IS NULL;

UPDATE "financial_records" 
SET "updatedAt" = CURRENT_TIMESTAMP 
WHERE "updatedAt" IS NULL;
