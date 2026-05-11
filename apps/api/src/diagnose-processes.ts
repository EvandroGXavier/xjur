import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n--- DIAGNÓSTICO DE PROCESSOS (XJUR) ---');
    
    try {
        // 1. Contagem total de processos
        const totalProcesses = await prisma.process.count();
        console.log(`\nTotal de processos no banco: ${totalProcesses}`);
        
        if (totalProcesses === 0) {
            console.log('⚠️  AVISO: Não existem processos cadastrados no banco de dados.');
        }

        // 2. Distribuição por tenantId
        const tenantStats = await prisma.process.groupBy({
            by: ['tenantId'],
            _count: {
                id: true
            }
        });
        console.log('\nDistribuição de Processos por TenantId:');
        console.table(tenantStats.map(s => ({ TenantId: s.tenantId, Quantidade: s._count.id })));
        
        // 3. Usuários e seus tenants
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                tenantId: true
            }
        });
        console.log('\nUsuários Registrados e seus Tenants:');
        console.table(users);
        
        // 4. Verificar se o tenantId do usuário Admin Demo (comum) tem processos
        for (const user of users) {
            const processCount = await prisma.process.count({ where: { tenantId: user.tenantId } });
            console.log(`Usuário "${user.name}" (${user.email}) -> Tenant: ${user.tenantId} -> Processos Visíveis: ${processCount}`);
        }

        // 5. Distribuição por status
        const statusStats = await prisma.process.groupBy({
            by: ['status'],
            _count: {
                id: true
            }
        });
        console.log('\nDistribuição por Status:');
        console.table(statusStats.map(s => ({ Status: s.status || 'NULL/EMPTY', Quantidade: s._count.id })));

        // 6. Amostra de processos (últimos 5)
        const sample = await prisma.process.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                cnj: true,
                title: true,
                tenantId: true,
                status: true
            }
        });
        console.log('\nÚltimos 5 processos cadastrados:');
        console.table(sample);

    } catch (error: any) {
        console.error('❌ Erro durante o diagnóstico:', error.message);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
