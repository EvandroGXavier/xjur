// Adicione isto no método 'connectToWhatsapp', logo no início do bloco 'connection.update'
// ... dentro de socket.ev.on('connection.update', (update) => { ...

if (connection === 'close') {
    const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
    
    // DR.X Lógica de Auto-Cura
    if (shouldReconnect) {
        this.logger.warn('🔄 Reconectando ao WhatsApp...');
        setTimeout(() => this.connectToWhatsapp(), 3000);
    } else {
        this.logger.error('❌ Sessão encerrada ou corrompida. Resetando credenciais...');
        // Força a limpeza para gerar novo QR na próxima tentativa
        const authPath = path.resolve(__dirname, '../../../../storage/auth_info_baileys');
        try {
            fs.rmSync(authPath, { recursive: true, force: true });
            this.logger.log('🧹 Pasta de sessão limpa. Reiniciando para novo QR...');
            this.connectToWhatsapp(); // Reinicia limpo
        } catch (e) {
            this.logger.error('Falha ao limpar sessão:', e);
        }
        this.gateway.emitStatus('DISCONNECTED');
    }
}
// ...