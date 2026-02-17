
import { PrismaClient } from '@prisma/client';
import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers } from '@whiskeysockets/baileys';
import * as path from 'path';
import * as fs from 'fs';
import { pino } from 'pino';

const prisma = new PrismaClient();
const logger = pino({ level: 'debug' });

async function main() {
  console.log('🔍 Starting WhatsApp Send Diagnostic...');

  // 1. Find a connected session
  // 1. Find the specific connection
  const connectionId = 'fd7b13dc-ad56-4771-a784-b45f30943ef3';
  const connection = await prisma.connection.findUnique({
    where: { id: connectionId }
  });

  if (!connection) {
    console.error('❌ Connection fd7b... not found in DB.');
    return;
  }
  
  console.log(`ℹ️ Connection status in DB is: ${connection.status}`);

  console.log(`✅ Found connection: ${connection.name} (${connection.id})`);

  // 2. Load Session
  const sessionDir = path.resolve(process.cwd(), 'storage/sessions', connection.id);
  console.log(`📂 Session directory: ${sessionDir}`);

  if (!fs.existsSync(sessionDir)) {
    console.error('❌ Session directory does not exist!');
    return;
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  const socket = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: Browsers.macOS('Desktop'),
    logger: logger as any,
    syncFullHistory: false,
  });

  socket.ev.on('creds.update', saveCreds);

  // Wait for connection update to confirm it's actually alive
  console.log('⏳ Waiting for socket connection...');
  
  await new Promise<void>((resolve, reject) => {
      socket.ev.on('connection.update', (update) => {
          const { connection, lastDisconnect } = update;
          if (connection === 'open') {
              console.log('✅ Socket connection OPEN!');
              resolve();
          } else if (connection === 'close') {
              const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
              console.log(`❌ Connection closed. Reconnecting: ${shouldReconnect}`);
              if (!shouldReconnect) reject(new Error('Logged out'));
          }
      });
      // Timeout after 10s
      setTimeout(() => {
          // If we are already connected (state might be loaded), we might not get 'open' event immediately if we missed it?
          // But makeWASocket usually emits it.
          // Let's check if user is present
          if (socket.user) {
              console.log('✅ Socket user is present:', socket.user);
              resolve();
          } else {
             console.log('⚠️ Timeout waiting for open, but proceeding if state allows...');
             resolve();
          }
      }, 5000);
  });

  // 3. Attempt Send
  const targetNumber = '553183357429'; // JULIE FILHA
  const jid = `${targetNumber}@s.whatsapp.net`;
  const text = 'Teste de diagnóstico DR.X 🚀 (RESTRUTURADO)';

  console.log(`📤 Attempting to send message to ${jid} (${targetNumber})`);

  try {
    // Attempt 1: Standard with Presence
    console.log('--- Attempt 1: Standard Send with Presence ---');
    
    // Check presence
    await socket.presenceSubscribe(jid);
    await new Promise(r => setTimeout(r, 1000));

    await socket.sendMessage(jid, { text });
    console.log('✅ Attempt 1 Success!');
  } catch (error) {
    console.error('❌ Attempt 1 Failed:', error);
    if (error instanceof Error) {
        console.error('Stack:', error.stack);
    }
  }

  console.log('🏁 Diagnostic finished.');
  process.exit(0);
}

main().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
});
