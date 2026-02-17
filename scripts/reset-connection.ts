
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function resetConnection() {
  const connectionId = 'fd7b13dc-ad56-4771-a784-b45f30943ef3'; // User's connection ID

  console.log(`🔄 Resetting Connection ${connectionId}...`);

  try {
    // 1. Update Status to Disconnected and Clear QR
    await prisma.connection.update({
      where: { id: connectionId },
      data: {
        status: 'DISCONNECTED',
        qrCode: null
      }
    });
    console.log('✅ Database status reset to DISCONNECTED.');

    // 2. Delete Session Folder
    const sessionDir = path.resolve(process.cwd(), 'storage/sessions', connectionId);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      console.log(`✅ Session directory deleted: ${sessionDir}`);
    } else {
      console.log('ℹ️ Session directory not found (already clean).');
    }

    console.log('✨ Connection reset complete. Please try connecting again.');

  } catch (error) {
    console.error('❌ Error resetting connection:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetConnection();
