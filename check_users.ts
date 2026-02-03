import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const users = await prisma.user.findMany();
    console.log('Total users found:', users.length);
    if (users.length > 0) {
      console.log('Users:', users.map(u => ({ id: u.id, email: u.email, name: u.name })));
    } else {
        console.log('NO USERS FOUND!');
    }
  } catch (e) {
    console.error('Error querying users:', e);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
