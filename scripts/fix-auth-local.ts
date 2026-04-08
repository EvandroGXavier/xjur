import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = 'evandro@conectionmg.com.br'
  console.log('--- RESET LOCAL DB ---')

  // 1. Garantir Tenant
  let tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    console.log('Criando Tenant inicial...')
    tenant = await prisma.tenant.create({
      data: {
        name: 'Dr.X Local',
        document: '00000000000191',
        isActive: true
      }
    })
  }
  console.log(`Tenant ID: ${tenant.id}`)

  // 2. Garantir Usuário
  const hashedPassword = await bcrypt.hash('123456', 10)
  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (!user) {
    console.log(`Criando usuário ${email}...`)
    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email,
        name: 'Evandro Xavier',
        password: hashedPassword,
        role: 'OWNER'
      }
    })
  } else {
    console.log(`Atualizando usuário ${email}...`)
    await prisma.user.update({
      where: { email },
      data: {
        tenantId: tenant.id,
        password: hashedPassword,
        role: 'OWNER'
      }
    })
  }

  console.log('-----------------------')
  console.log('Acesso Local Restaurado!')
  console.log(`Login: ${email}`)
  console.log('Senha: 123456')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
