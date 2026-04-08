import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = 'evandro@conectionmg.com.br'
  console.log(`Resetando senha para ${email}...`)
  const hashedPassword = await bcrypt.hash('123456', 10)
  
  await prisma.user.update({
    where: { email },
    data: {
      password: hashedPassword,
      status: 'ACTIVE'
    }
  })
  console.log('Senha resetada com sucesso para: 123456')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
