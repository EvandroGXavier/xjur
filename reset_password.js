
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs'); // Usando bcryptjs para compatibilidade

const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL || "postgresql://drx_dev:drx_local_pass@localhost:5432/drx_local"
      }
    }
  });

async function resetPassword(email, newPassword) {
  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const user = await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });
    console.log(`✅ Senha do usuário ${user.email} atualizada com sucesso para '${newPassword}'`);
  } catch (error) {
    if (error.code === 'P2025') {
        console.error(`❌ Usuário com email ${email} não encontrado.`);
    } else {
        console.error('❌ Erro ao atualizar senha:', error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Resetando senha do admin
resetPassword('admin@drx.local', '123456');
