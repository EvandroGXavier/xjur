"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var WhatsappService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappService = void 0;
const common_1 = require("@nestjs/common");
const baileys_1 = require("@whiskeysockets/baileys");
const path = require("path");
const fs = require("fs");
const whatsapp_gateway_1 = require("./whatsapp.gateway");
let WhatsappService = WhatsappService_1 = class WhatsappService {
    constructor(gateway) {
        this.gateway = gateway;
        this.logger = new common_1.Logger(WhatsappService_1.name);
    }
    async onModuleInit() {
        this.connectToWhatsapp();
    }
    async connectToWhatsapp() {
        const authPath = path.resolve(__dirname, '../../../../storage/auth_info_baileys');
        if (!fs.existsSync(authPath)) {
            fs.mkdirSync(authPath, { recursive: true });
        }
        const { state, saveCreds } = await (0, baileys_1.useMultiFileAuthState)(authPath);
        this.authState = state;
        this.saveCreds = saveCreds;
        const loggerMock = {
            level: 'warn',
            trace: () => { },
            debug: () => { },
            info: () => { },
            warn: () => { },
            error: () => { },
            child: () => loggerMock,
        };
        this.socket = (0, baileys_1.default)({
            auth: state,
            printQRInTerminal: false,
            browser: baileys_1.Browsers.macOS('Desktop'),
            logger: loggerMock,
        });
        this.socket.ev.on('creds.update', saveCreds);
        this.socket.ev.on('connection.update', (update) => {
            var _a, _b;
            const { connection, lastDisconnect, qr } = update;
            if (qr) {
                this.logger.log('📢 QR CODE NOVO GERADO! Enviando para o Frontend...');
                this.gateway.emitQrCode(qr);
            }
            if (connection === 'close') {
                const shouldReconnect = ((_b = (_a = lastDisconnect === null || lastDisconnect === void 0 ? void 0 : lastDisconnect.error) === null || _a === void 0 ? void 0 : _a.output) === null || _b === void 0 ? void 0 : _b.statusCode) !== baileys_1.DisconnectReason.loggedOut;
                this.logger.warn(`Conexão fechada. Reconectar: ${shouldReconnect}`);
                if (shouldReconnect) {
                    setTimeout(() => this.connectToWhatsapp(), 3000);
                }
                else {
                    this.gateway.emitStatus('DISCONNECTED');
                    try {
                        fs.rmSync(authPath, { recursive: true, force: true });
                    }
                    catch (e) { }
                }
            }
            else if (connection === 'open') {
                this.logger.log('✅ CONECTADO AO WHATSAPP!');
                this.gateway.emitStatus('CONNECTED');
            }
        });
        this.socket.ev.on('messages.upsert', async (m) => {
            if (m.type === 'notify') {
                for (const msg of m.messages) {
                    if (!msg.key.fromMe) {
                        await this.handleIncomingMessage(msg);
                    }
                }
            }
        });
    }
    async handleIncomingMessage(msg) {
        var _a, _b, _c;
        const text = ((_a = msg.message) === null || _a === void 0 ? void 0 : _a.conversation) || ((_c = (_b = msg.message) === null || _b === void 0 ? void 0 : _b.extendedTextMessage) === null || _c === void 0 ? void 0 : _c.text);
        if (text) {
            this.logger.log(`Mensagem recebida de ${msg.key.remoteJid}`);
            this.gateway.emitNewMessage({
                from: msg.key.remoteJid,
                text: text,
                name: msg.pushName
            });
        }
    }
    async sendText(to, text) {
        if (!this.socket)
            throw new Error('Socket não inicializado');
        const jid = to.includes('@s.whatsapp.net') ? to : `${to}@s.whatsapp.net`;
        await this.socket.sendMessage(jid, { text });
    }
};
exports.WhatsappService = WhatsappService;
exports.WhatsappService = WhatsappService = WhatsappService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [whatsapp_gateway_1.WhatsappGateway])
], WhatsappService);
//# sourceMappingURL=whatsapp.service.js.map