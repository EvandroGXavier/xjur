
import { useState, useEffect, useRef, useCallback } from 'react';
import { Smartphone, RefreshCw, Power, Plus, Mail, MessageCircle, Trash2, CheckCircle, Loader2, Edit3, X, Wifi, WifiOff, Zap, Settings, Users, Shield, Instagram, Send, HelpCircle, AlertTriangle, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { api } from '../../../services/api';
import { Badge } from '../../../components/ui/Badge';
import { QRCodeSVG } from 'qrcode.react';
import { io, Socket } from 'socket.io-client';

interface Connection {
    id: string;
    name: string;
    type: 'WHATSAPP' | 'INSTAGRAM' | 'EMAIL' | 'TELEGRAM';
    status: 'CONNECTED' | 'DISCONNECTED' | 'PAIRING' | 'ERROR';
    qrCode?: string;
    updatedAt: string;
    config?: any;
}

const qrRawCache: Record<string, string> = {};
const defaultWaConfig = {
    evolutionApiKey: '',
    evolutionUrl: '',
    evolutionVersion: '2.3000.x'
};

const defaultTelegramConfig = {
    botToken: '',
    webhookBaseUrl: '',
};

const fieldClass = 'w-full rounded-xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-500 shadow-inner shadow-black/20 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';
const selectClass = `${fieldClass} appearance-none pr-11`;
const sectionClass = 'rounded-2xl border border-white/10 bg-slate-950/70 p-5 shadow-inner shadow-black/20';
const helpTextClass = 'mt-2 text-xs leading-relaxed text-slate-400';

const getRequestErrorMessage = (error: any, fallback: string) => {
    const responseMessage = error?.response?.data?.message;
    if (Array.isArray(responseMessage) && responseMessage.length > 0) {
        return responseMessage.join('');
    }
    if (typeof responseMessage === 'string' && responseMessage.trim()) {
        return responseMessage;
    }
    if (typeof error?.response?.data?.error === 'string' && error.response.data.error.trim()) {
        return error.response.data.error;
    }
    if (!error?.response) {
        const apiBase = String(api.defaults.baseURL || '').replace(/\/$/, '');
        return `Nao foi possivel falar com a API (${apiBase || 'backend local'}). Verifique se o servidor esta rodando.`;
    }
    if (typeof error?.message === 'string' && error.message.trim()) {
        return error.message;
    }
    return fallback;
};

const getConnectionTypeLabel = (type: Connection['type']) => {
    switch (type) {
        case 'WHATSAPP': return 'WhatsApp';
        case 'TELEGRAM': return 'Telegram';
        case 'EMAIL': return 'Email';
        case 'INSTAGRAM': return 'Instagram';
        default: return type;
    }
};

interface ConnectionsProps {
    onOpenHelp?: () => void;
}

export function Connections({ onOpenHelp }: ConnectionsProps) {
    const [connections, setConnections] = useState<Connection[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [formMode, setFormMode] = useState<'IDLE' | 'CREATE' | 'EDIT'>('IDLE');
    const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
    const [settingsConnection, setSettingsConnection] = useState<Connection | null>(null);
    const [connectingId, setConnectingId] = useState<string | null>(null);
    const [qrMap, setQrMap] = useState<Record<string, string>>({});
    const [activeTab, setActiveTab] = useState<'dashboard' | 'configurations' | 'test' | 'events' | 'integrations'>('dashboard');
    const [testEvents, setTestEvents] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const socketRef = useRef<Socket | null>(null);
    
    // Form State
    const [formName, setFormName] = useState('');
    const [formType, setFormType] = useState<'WHATSAPP' | 'INSTAGRAM' | 'EMAIL' | 'TELEGRAM'>('WHATSAPP');
    const [emailConfig, setEmailConfig] = useState({ email: '', password: ''});
    const [waConfig, setWaConfig] = useState(defaultWaConfig);
    const [telegramConfig, setTelegramConfig] = useState(defaultTelegramConfig);
    const [formError, setFormError] = useState<string | null>(null);

    const fetchConnections = useCallback(async () => {
        try {
            const response = await api.get<Connection[]>('/connections');
            setConnections(response.data);
            setLoadError(null);
            
            // Sync current editing connection if needed
            if (editingConnection) {
                const updated = response.data.find(c => c.id === editingConnection.id);
                if (updated) setEditingConnection(updated);
            }
        } catch (error) {
            console.error('Failed to fetch connections', error);
            setLoadError(getRequestErrorMessage(error, 'Nao foi possivel carregar as conexoes.'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const socketUrl = window.location.hostname === 'localhost' || window.location.hostname.includes('idx.google.com')
            ? `http://${window.location.hostname}:3000/whatsapp`
            : '/whatsapp';

        const socket = io(socketUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 20,
            reconnectionDelay: 2000,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            // Entrar na sala de cada conexão para receber updates específicos
            connections.forEach(c => {
                socket.emit('join', c.id);
            });
        });

        socket.on('qr_code', (data: { connectionId: string; qr: string }) => {
            qrRawCache[data.connectionId] = data.qr;
            setQrMap(prev => ({ ...prev, [data.connectionId]: data.qr }));
            setConnections(prev => prev.map(c => 
                c.id === data.connectionId && c.type === 'WHATSAPP'
                    ? { ...c, status: 'PAIRING' as const }
                    : c
            ));
        });

        socket.on('connection:status', (data: { connectionId: string; status: string }) => {
            console.log(`Socket status update for ${data.connectionId}: ${data.status}`);
            
            setConnections(prev => prev.map(c => 
                c.id === data.connectionId 
                    ? { ...c, status: data.status as Connection['status'], qrCode: data.status === 'CONNECTED' ? undefined : c.qrCode }
                    : c
            ));

            if (data.status === 'CONNECTED') {
                delete qrRawCache[data.connectionId];
                setQrMap(prev => {
                    const next = { ...prev };
                    delete next[data.connectionId];
                    return next;
                });
                setConnectingId(current => current === data.connectionId ? null : current);
                toast.success('Conectado com sucesso!');
            } else if (data.status === 'DISCONNECTED') {
                delete qrRawCache[data.connectionId];
                setQrMap(prev => {
                    const next = { ...prev };
                    delete next[data.connectionId];
                    return next;
                });
                setConnectingId(current => current === data.connectionId ? null : current);
            }
        });

        socket.on('connection:error', (data: { connectionId: string; error: string }) => {
            toast.error(`Erro na conexão: ${data.error}`);
            setConnectingId(null);
        });

        socket.on('test_event', (data: { connectionId: string; payload: any }) => {
            setTestEvents(prev => [{ ...data.payload, _receivedAt: new Date().toLocaleTimeString() }, ...prev].slice(0, 50));
        });

        return () => {
            socket.disconnect();
        };
    }, []);


    useEffect(() => {
        if (socketRef.current?.connected && connections.length > 0) {
            connections.forEach(c => {
                socketRef.current?.emit('join', c.id);
            });
        }
    }, [connections]);

    useEffect(() => {
        fetchConnections();
        const interval = setInterval(fetchConnections, 8000);
        return () => clearInterval(interval);
    }, [fetchConnections]);

    const handleCreate = async () => {
        const trimmedName = formName.trim();
        if (!trimmedName) {
            setFormError('Nome é obrigatório');
            return toast.error('Nome é obrigatório');
        }
        try {
            setIsSubmitting(true);
            setFormError(null);
            const payload: any = { name: trimmedName, type: formType };
            if (formType === 'WHATSAPP') payload.config = { ...waConfig, blockGroups: true, groupWhitelist: [] };
            if (formType === 'EMAIL') payload.config = emailConfig;
            if (formType === 'TELEGRAM') payload.config = telegramConfig;

            await api.post('/connections', payload);
            toast.success('Conexão criada!');
            resetForm();
            fetchConnections();
        } catch (error) {
            setFormError(getRequestErrorMessage(error, 'Erro ao criar conexão.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdate = async () => {
        if (!editingConnection) return;
        const trimmedName = formName.trim();
        if (!trimmedName) return toast.error('Nome é obrigatório');
        try {
            setIsSubmitting(true);
            const payload: any = { name: trimmedName, type: formType };
            if (formType === 'WHATSAPP') payload.config = { ...(editingConnection.config || {}), ...waConfig };
            if (formType === 'EMAIL') payload.config = emailConfig;
            if (formType === 'TELEGRAM') payload.config = { ...(editingConnection.config || {}), ...telegramConfig };

            await api.patch(`/connections/${editingConnection.id}`, payload);
            toast.success('Conexão atualizada!');
            resetForm();
            fetchConnections();
        } catch (error) {
            toast.error(getRequestErrorMessage(error, 'Erro ao atualizar.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Tem certeza que deseja excluir esta conexão?')) {
            try {
                await api.delete(`/connections/${id}`);
                toast.success('Conexão removida');
                fetchConnections();
            } catch (error) {
                toast.error('Erro ao remover');
            }
        }
    };

    const handleConnect = async (connection: Connection) => {
        try {
            setConnectingId(connection.id);
            await api.post(`/connections/${connection.id}/connect`);
            toast.info('Iniciando conexão...');
            fetchConnections();
        } catch (error) {
            toast.error(getRequestErrorMessage(error, 'Falha ao conectar.'));
            setConnectingId(null);
        }
    };

    const handleDisconnect = async (connection: Connection) => {
        try {
            await api.post(`/connections/${connection.id}/disconnect`);
            toast.success('Desconectado com sucesso.');
            setConnectingId(null);
            delete qrRawCache[connection.id];
            setQrMap(prev => {
                const next = { ...prev };
                delete next[connection.id];
                return next;
            });
            fetchConnections();
        } catch (error) {
            toast.error(getRequestErrorMessage(error, 'Falha ao desconectar.'));
        }
    };

    const handleRefreshStatus = async (connection: Connection) => {
        try {
            const response = await api.get(`/connections/${connection.id}/status`);
            fetchConnections();
            
            if (response.data.status === 'CONNECTED') {
                setConnectingId(current => current === connection.id ? null : current);
                setQrMap(prev => {
                    const next = { ...prev };
                    delete next[connection.id];
                    return next;
                });
            }
            
            toast.success(`Status atualizado: ${response.data.status}`);
        } catch (error) {
            toast.error('Não foi possível atualizar o status.');
        }
    };

    const handleEdit = (conn: Connection) => {
        setFormName(conn.name);
        setFormType(conn.type);
        setEmailConfig(conn.config?.email ? { email: conn.config.email, password: ''} : { email: '', password: ''});
        setWaConfig({ 
            evolutionApiKey: conn.config?.evolutionApiKey ?? '',
            evolutionUrl: conn.config?.evolutionUrl ?? '',
            evolutionVersion: conn.config?.evolutionVersion ?? '2.3000.x'
        });
        setTelegramConfig({
            botToken: conn.config?.botToken ?? '',
            webhookBaseUrl: conn.config?.webhookBaseUrl ?? '',
        });
        setEditingConnection(conn);
        setFormMode('EDIT');
    };

    const resetForm = () => {
        setFormMode('IDLE');
        setEditingConnection(null);
        setFormName('');
        setFormType('WHATSAPP');
        setEmailConfig({ email: '', password: ''});
        setWaConfig(defaultWaConfig);
        setTelegramConfig(defaultTelegramConfig);
        setFormError(null);
    };

    const renderQrCode = (qrData: string | undefined | null) => {
        if (!qrData) return null;
        if (qrData.startsWith('data:image')) {
            return <img src={qrData} alt="QR Code" className="w-full max-w-[260px] aspect-square object-contain rounded-xl bg-white p-2 shadow-inner" />;
        }
        if (qrData.length > 500 && !qrData.includes('http')) {
            return <img src={`data:image/png;base64,${qrData}`} alt="QR Code" className="w-full max-w-[260px] aspect-square object-contain rounded-xl bg-white p-2 shadow-inner" />;
        }
        return (
            <div className="bg-white p-4 rounded-xl mb-4 shadow-xl shadow-black/40 ring-2 ring-white/10 w-full max-w-[260px] aspect-square flex items-center justify-center">
                <QRCodeSVG value={qrData} size={230} level="H" includeMargin={true} />
            </div>
        );
    };

    const getIcon = (type: string) => {
        if (type === 'WHATSAPP') return <MessageCircle size={24} className="text-emerald-500" />;
        if (type === 'INSTAGRAM') return <Instagram size={24} className="text-pink-500" />;
        if (type === 'EMAIL') return <Mail size={24} className="text-blue-500" />;
        if (type === 'TELEGRAM') return <Send size={24} className="text-sky-500" />;
        return <Smartphone size={24} className="text-slate-400" />;
    };

    const getStatusBadge = (status: string) => {
        switch(status) {
            case 'CONNECTED': return <Badge variant="success">ONLINE</Badge>;
            case 'PAIRING': return <Badge variant="warning">PAREANDO</Badge>;
            case 'DISCONNECTED': return <Badge variant="default">OFFLINE</Badge>;
            default: return <Badge variant="error">ERRO</Badge>;
        }
    };

    const getQrForConnection = (conn: Connection): string | null => qrMap[conn.id] || null;

    return (
        <div className="flex-1 flex h-full flex-col overflow-hidden bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 p-6 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Zap className="text-emerald-400" /> Conexões & Canais</h2>
                    <p className="text-slate-400 mt-1">Gerencie seus canais de comunicação.</p>
                </div>
                <button onClick={() => { resetForm(); setFormMode('CREATE'); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition"><Plus size={16} /> Nova Conexão</button>
            </div>

            {formMode !== 'IDLE' && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-slate-900 p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">{formMode === 'EDIT' ? 'Editar Conexão' : 'Adicionar Canal'}</h3>
                            <button onClick={resetForm} className="text-slate-500 hover:text-white p-2 hover:bg-white/5 rounded-full transition"><X size={20} /></button>
                        </div>

                        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 mb-6 flex gap-3 items-start">
                            <Zap size={18} className="text-indigo-400 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-indigo-300">Fluxo recomendado</p>
                                <p className="text-[11px] text-slate-400">Crie a instancia primeiro, depois clique em conectar para gerar o QR Code. Se a API estiver offline, o motivo real aparece abaixo.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Tipo de Canal *</label>
                                <select value={formType} onChange={(e: any) => setFormType(e.target.value)} className={selectClass} disabled={formMode === 'EDIT'}>
                                    <option value="WHATSAPP">WhatsApp</option>
                                    <option value="EMAIL">Email</option>
                                    <option value="INSTAGRAM">Instagram</option>
                                    <option value="TELEGRAM">Telegram</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Nome da Conexão *</label>
                                <input value={formName} onChange={e => setFormName(e.target.value)} className={fieldClass} placeholder="Ex: ADV-31999811174" />
                            </div>

                            {formType === 'WHATSAPP' && (
                                <>
                                    <div className="md:col-span-1">
                                        <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">API Key da Evolution</label>
                                        <input 
                                            value={waConfig.evolutionApiKey} 
                                            onChange={e => setWaConfig({...waConfig, evolutionApiKey: e.target.value})} 
                                            className={fieldClass} 
                                            placeholder="Ex: A1291CA0CCD6..." 
                                        />
                                        <p className="text-[10px] text-slate-500 mt-1.5">Se ficar em branco, usa a key padrão do servidor.</p>
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">URL da Evolution</label>
                                        <input 
                                            value={waConfig.evolutionUrl} 
                                            onChange={e => setWaConfig({...waConfig, evolutionUrl: e.target.value})} 
                                            className={fieldClass} 
                                            placeholder="Ex: http://localhost:8080" 
                                        />
                                        <p className="text-[10px] text-slate-500 mt-1.5">Opcional. Preencha apenas se usar outra instância.</p>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Versão do WhatsApp</label>
                                        <input 
                                            value={waConfig.evolutionVersion} 
                                            onChange={e => setWaConfig({...waConfig, evolutionVersion: e.target.value})} 
                                            className={fieldClass} 
                                            placeholder="2.3000.x" 
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 border-t border-white/10 pt-6">
                            <button onClick={resetForm} className="rounded-xl border border-white/10 bg-white/5 px-6 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/10 transition">Cancelar</button>
                            <button 
                                onClick={formMode === 'EDIT' ? handleUpdate : handleCreate} 
                                disabled={isSubmitting} 
                                className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-8 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition"
                            >
                                {isSubmitting ? 'Salvando...' : formMode === 'EDIT' ? 'Salvar Alterações' : 'Criar Conexão'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto custom-scrollbar pb-6">
                {connections.map(conn => {
                    const rawQr = getQrForConnection(conn);
                    const isPairing = conn.status === 'PAIRING';
                    const isConnected = conn.status === 'CONNECTED';
                    return (
                        <div key={conn.id} className={clsx(
                            "bg-slate-900 border rounded-xl flex flex-col group relative transition-all duration-300",
                            "overflow-visible",
                            isConnected ? "border-emerald-500/40 shadow-lg shadow-emerald-500/5" :
                            isPairing ? "border-amber-500/40 shadow-xl shadow-amber-500/10 md:col-span-2 lg:col-span-2" : "border-slate-800"
                        )}>
                            <div className={clsx("h-1.5 w-full", isConnected ? "bg-emerald-500" : isPairing ? "bg-amber-500 animate-pulse" : "bg-slate-700")} />
                            <div className="p-5 flex-1 flex flex-col">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={clsx("w-10 h-10 rounded-lg flex items-center justify-center border", isConnected ? "bg-emerald-500/10 border-emerald-500/30" : "bg-slate-800 border-slate-700")}>{getIcon(conn.type)}</div>
                                        <div>
                                            <h3 className="font-bold text-slate-200 text-sm">{conn.name}</h3>
                                            <p className="text-xs text-slate-500 font-mono mt-0.5">{conn.type}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button 
                                            onClick={(e) => { 
                                                e.preventDefault(); 
                                                e.stopPropagation(); 
                                                handleEdit(conn);
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                            }} 
                                            className="text-slate-400 hover:text-indigo-300 p-1.5 bg-white/5 rounded-lg transition-all"
                                        >
                                            <Edit3 size={14} />
                                        </button>
                                        <button onClick={(e) => handleDelete(conn.id, e)} className="text-slate-400 hover:text-red-400 p-1.5 bg-white/5 rounded-lg transition-all"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                                <div className={clsx("flex-1 flex flex-col items-center justify-center py-3", isPairing && (rawQr || conn.qrCode) ? "min-h-[380px]" : "min-h-[180px]")}>
                                    {isConnected ? (
                                        <div className="flex flex-col items-center animate-in fade-in zoom-in">
                                            <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 relative">
                                                <CheckCircle size={40} className="text-emerald-500" />
                                                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center"><Wifi size={10} className="text-white" /></div>
                                            </div>
                                            <span className="text-slate-200 font-semibold text-sm">Pronto para uso</span>
                                            <button onClick={() => { setSettingsConnection(conn); }} className="mt-4 text-[10px] bg-slate-800 text-slate-300 px-3 py-1 rounded-full border border-slate-700 flex items-center gap-1"><Settings size={10} /> Ajustes</button>
                                        </div>
                                    ) : isPairing && (rawQr || conn.qrCode) ? (
                                        <div className="flex flex-col items-center animate-in fade-in zoom-in w-full">
                                            {renderQrCode(rawQr || conn.qrCode)}
                                            <span className="text-amber-400 text-sm font-semibold animate-pulse mt-2">Escaneie o QR Code</span>
                                            <span className="text-[11px] text-slate-500 mt-1">{"Abra WhatsApp -> Aparelhos Conectados"}</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center text-slate-500">
                                            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-3"><WifiOff size={28} className="opacity-40" /></div>
                                            <span className="text-sm font-medium">Desconectado</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="p-3 bg-slate-800 border-t border-slate-700 flex justify-between items-center">
                                {getStatusBadge(conn.status)}
                                
                                <div className="flex items-center gap-2">
                                    {isPairing ? (
                                        <div className="flex items-center gap-1">
                                            <button 
                                                onClick={() => setConnectingId(null)}
                                                className="text-[10px] text-slate-500 hover:text-red-400 px-2 py-1.5 rounded-lg border border-slate-800 transition"
                                            >
                                                Parar espera
                                            </button>
                                            <button 
                                                onClick={() => handleRefreshStatus(conn)}
                                                disabled={isSubmitting}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition disabled:opacity-50"
                                            >
                                                <RefreshCw size={10} className={clsx(isSubmitting && "animate-spin")} />
                                                Já conectei no celular
                                            </button>
                                        </div>
                                    ) : isConnected ? (
                                        <button 
                                            onClick={() => handleDisconnect(conn)} 
                                            className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-bold px-4 py-2 rounded-lg border border-red-500/20 flex items-center gap-1 transition"
                                        >
                                            <Power size={12} /> Desconectar
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => handleConnect(conn)} 
                                            disabled={connectingId === conn.id} 
                                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-md flex items-center gap-1 transition"
                                        >
                                            {connectingId === conn.id ? (
                                                <><Loader2 size={12} className="animate-spin" /> Conectando...</>
                                            ) : (
                                                <><Zap size={10} /> Conectar</>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {settingsConnection && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden shadow-2xl">
                        <div className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white">{settingsConnection.name}</h3>
                            <button onClick={() => setSettingsConnection(null)} className="text-slate-400 hover:text-white"><X size={20} /></button>
                        </div>
                        <div className="flex-1 p-8 overflow-y-auto">
                            <h4 className="text-white font-bold mb-4">Ajustes da Conexão</h4>
                            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 mb-6">
                                <p className="text-sm text-slate-400">ID: <span className="font-mono text-indigo-400">{settingsConnection.id}</span></p>
                                <p className="text-sm text-slate-400 mt-1">Tipo: {settingsConnection.type}</p>
                            </div>
                            <button onClick={() => setSettingsConnection(null)} className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-bold">Fechar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}













