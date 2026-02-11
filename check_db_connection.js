
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://drx_dev:drx_local_pass@localhost:5432/drx_local"
    }
  }
});

async function main() {
  console.log('Testando conexão com o banco de dados...');
  try {
    await prisma.$connect();
    console.log('✅ Conexão com o banco de dados estabelecida com sucesso!');
    
    const userCount = await prisma.user.count();
    console.log(`✅ Banco acessível. Total de usuários: ${userCount}`);

    const users = await prisma.user.findMany({
        take: 5,
        select: { email: true, name: true, role: true }
    });
    console.log('Usuários encontrados:', users);

  } catch (error) {
    console.error('❌ Erro ao conectar ao banco de dados:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
