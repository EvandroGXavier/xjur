
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = 'atendechat123@gmail.com'
  const password = 'chatbot123' 
  const document = '00000000000' // CPF/CNPJ único para o admin

  const existingUser = await prisma.contact.findFirst({
    where: {
      OR: [
        { email: email },
        { document: document }
      ]
    }
  })

  if (!existingUser) {
    console.log(`Creating default admin user: ${email}`)
    await prisma.contact.create({
      data: {
        name: 'Admin DR.X',
        email: email,
        password: password,
        document: document,
        whatsapp: '00000000000',
        phone: '00000000000'
      }
    })
    console.log('Default admin user created successfully.')
  } else {
    console.log(`User with email ${email} or document ${document} already exists. checking password...`)
    if (existingUser.password !== password) {
        console.log('Updating password for existing user...')
        await prisma.contact.update({
            where: { id: existingUser.id },
            data: { password: password }
        })
        console.log('Password updated.')
    } else {
        console.log('User already up to date.')
    }
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
