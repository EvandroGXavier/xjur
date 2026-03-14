
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const tenantId = '0e168f4b-9aa5-4e66-b4c2-a25605f87903'; // From logs
    
    console.log('--- Resumo de Processos Recentes ---');
    const processes = await prisma.process.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
            processParties: {
                include: {
                    contact: true,
                    role: true
                }
            }
        }
    });

    for (const p of processes) {
        console.log(`\nProcesso ID: ${p.id} | CNJ: ${p.cnj} | Title: ${p.title}`);
        console.log(`Partes vinculadas (${p.processParties.length}):`);
        for (const party of p.processParties) {
            console.log(` - Contato: ${party.contact.name} | Papel: ${party.role.name} | IsClient: ${party.isClient}`);
        }
    }

    console.log('\n--- Contatos Recentes Criados via Importacao ---');
    const recentContacts = await prisma.contact.findMany({
        where: { 
            tenantId,
            notes: { contains: 'Importado' }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
    });

    for (const c of recentContacts) {
        console.log(`Contato: ${c.name} | Doc: ${c.document} | Criado: ${c.createdAt}`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
