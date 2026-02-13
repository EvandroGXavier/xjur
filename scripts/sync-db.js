const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// CONFIGURAÇÃO
const VPS_USER = 'root'; // ou o usuário que você usa no SSH
const VPS_HOST = 'vps-drx.com.br'; // SUBSTITUA PELO IP OU DOMÍNIO REAL DA SUA VPS
const REMOTE_DB_NAME = 'drx_db';
const REMOTE_DB_USER = 'drx';

const LOCAL_CONTAINER_NAME = 'drx-db-local-1'; // Nome padrão do container (pode variar dependendo da pasta, geralmente xjur-db-local-1)
const LOCAL_DB_USER = 'drx_dev';
const LOCAL_DB_NAME = 'drx_local';

// Tentar detectar o nome do container local automaticamente
const detectContainer = () => {
    return new Promise((resolve) => {
        exec('docker ps --format "{{.Names}}" | grep db-local', (err, stdout) => {
            if (stdout && stdout.trim()) {
                resolve(stdout.trim().split('\n')[0]);
            } else {
                resolve(null);
            }
        });
    });
};

const run = async () => {
    const container = await detectContainer();
    
    if (!container) {
        console.error('❌ ERRO: Container do banco local não encontrado. Certifique-se que o Docker está rodando.');
        console.log('Dica: Rode "docker-compose up -d" primeiro.');
        process.exit(1);
    }

    console.log(`🐳 Container Detectado: ${container}`);
    console.log(`🔄 Iniciando Sincronização: VPS (${REMOTE_DB_NAME}) -> LOCAL (${LOCAL_DB_NAME})...`);
    console.log('⚠️  ATENÇÃO: O banco local será SUBSCRITO. Pressione Ctrl+C em 5s para cancelar.');
    
    await new Promise(r => setTimeout(r, 5000));

    // Comando SSH para Dump Streamado (sem salvar arquivo na VPS)
    // Usamos 'sudo -u postgres pg_dump' se o Postgres remoto rodar nativo, ou comando docker se rodar em docker remoto.
    // Baseado no seu script de install, o Postgres remoto roda nativo no Linux.
    
    // Obs: Ajuste o IP da VPS abaixo manualmente se não tiver configurado no hosts ou SSH config
    const sshCommand = `ssh ${VPS_USER}@${VPS_HOST} "sudo -u postgres pg_dump -Fc ${REMOTE_DB_NAME}"`;
    
    // Comando Local para Restaurar (pg_restore) dentro do container
    const restoreCommand = `docker exec -i ${container} pg_restore --username ${LOCAL_DB_USER} --dbname ${LOCAL_DB_NAME} --clean --if-exists --no-owner --role=${LOCAL_DB_USER}`;

    console.log('🚀 Baixando e Restaurando (isso pode levar alguns minutos dependendo do tamanho)...');

    // Pipe: SSH Dump -> Docker Restore
    const cmd = `${sshCommand} | ${restoreCommand}`;

    const processSync = exec(cmd);

    processSync.stdout.on('data', (data) => console.log(data.toString()));
    processSync.stderr.on('data', (data) => console.error(data.toString()));

    processSync.on('exit', (code) => {
        if (code === 0) {
            console.log('✅ Sincronização Concluída com Sucesso! Seu banco local agora é um espelho da VPS.');
        } else {
            console.error('❌ Erro na sincronização. Verifique sua conexão SSH e permissões.');
        }
    });
};

// Verificar IP nos argumentos
const args = process.argv.slice(2);
if (args[0]) {
    // Se passar argumento, sobrescreve o host
    // ex: node scripts/sync-db.js 192.168.1.1
} 

run();
