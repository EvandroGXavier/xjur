import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function testLogin() {
  const email = 'evandro@conectionmg.com.br'
  const pass = '123456'
  
  console.log(`Testando login para ${email}...`)
  
  const user = await prisma.user.findUnique({
    where: { email },
    include: { tenant: true }
  })
  
  if (!user) {
    console.log('ERRO: Usuário não encontrado no banco de dados!')
    return
  }
  
  console.log(`Usuário encontrado: ID=${user.id}, TenantID=${user.tenantId}`)
  
  const isMatch = await bcrypt.compare(pass, user.password)
  
  if (isMatch) {
    console.log('SUCESSO: A senha 123456 é válida para o hash no banco!')
  } else {
    console.log('ERRO: A senha 123456 NÃO confere com o hash no banco!')
    console.log(`Hash no banco: ${user.password}`)
  }
}

testLogin()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
