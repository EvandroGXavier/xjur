import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = 'evandro@conectionmg.com.br'
  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (!user) {
    console.log(`Usuário ${email} não encontrado. Criando...`)
    const hashedPassword = await bcrypt.hash('123456', 10)
    // Adjust fields based on the schema
    await prisma.user.create({
      data: {
        email,
        name: 'Evandro Xavier',
        password: hashedPassword,
        personType: 'PF',
        status: 'ACTIVE'
      }
    })
    console.log('Usuário criado com sucesso! Senha padrão: 123456')
  } else {
    console.log(`Usuário ${email} já existe.`)
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
