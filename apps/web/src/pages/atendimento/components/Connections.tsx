
import { useState, useEffect, useRef, useCallback } from 'react';
import { Smartphone, RefreshCw, Power, Plus, Mail, MessageCircle, Trash2, CheckCircle, Loader2, Edit3, X, Wifi, WifiOff, Zap, Settings, Users, Shield, Instagram, Send } from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { api } from '../../../services/api';
import { Badge } from '../../../components/ui/Badge';
import { QRCodeSVG } from 'qrcode.react';
import { io, Socket } from 'socket.io-client';

interface Connection {
    id: string;
    name: string;
    type: 'WHATSAPP' | 'INSTAGRAM' | 'EMAIL';
    status: 'CONNECTED' | 'DISCONNECTED' | 'PAIRING' | 'ERROR';
    qrCode?: string;
    updatedAt: string;
    config?: any;
}

// Store raw QR strings from websocket (keyed by connectionId)
const qrRawCache: Record<string, string> = {};

export function Connections() {
    const [connections, setConnections] = useState<Connection[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
    const [settingsConnection, setSettingsConnection] = useState<Connection | null>(null);
    const [connectingId, setConnectingId] = useState<string | null>(null);
    const [qrMap, setQrMap] = useState<Record<string, string>>({});
    const [activeTab, setActiveTab] = useState<'dashboard' | 'configurations' | 'test' | 'events' | 'integrations'>('dashboard');
    const [testEvents, setTestEvents] = useState<any[]>([]);
    const socketRef = useRef<Socket | null>(null);
    
    // Form State
    const [formName, setFormName] = useState('');
    const [formType, setFormType] = useState<'WHATSAPP' | 'INSTAGRAM' | 'EMAIL' | 'TELEGRAM'>('WHATSAPP');
    const [emailConfig, setEmailConfig] = useState({ email: '', password: '' });
    const [waConfig, setWaConfig] = useState({ 
        evolutionChannel: 'baileys', 
        evolutionToken: '',
        evolutionNumber: '',
        evolutionVersion: '2.3000.x'
    });

    const fetchConnections = useCallback(async () => {
        try {
            const response = await api.get<Connection[]>('/connections');
            setConnections(response.data);
        } catch (error) {
            console.error('Failed to fetch connections', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Connect WebSocket for real-time updates
    useEffect(() => {
        const socketUrl = window.location.hostname === 'localhost' || window.location.hostname.includes('idx.google.com')
            ? `http://${window.location.hostname}:3000/whatsapp`
            : '/whatsapp';

        console.log('🔌 Conectando WebSocket WhatsApp:', socketUrl);

        const socket = io(socketUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 20,
            reconnectionDelay: 2000,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('✅ WebSocket WhatsApp conectado');
        });

        socket.on('qr_code', (data: { connectionId: string; qr: string }) => {
            console.log(`📸 QR Code recebido para ${data.connectionId}`);
            qrRawCache[data.connectionId] = data.qr;
            setQrMap(prev => ({ ...prev, [data.connectionId]: data.qr }));
            
            // Also update connection status locally
            setConnections(prev => prev.map(c => 
                c.id === data.connectionId 
                    ? { ...c, status: 'PAIRING' as const }
                    : c
            ));
        });

        socket.on('connection:status', (data: { connectionId: string; status: string }) => {
            console.log(`📶 Status: ${data.connectionId} → ${data.status}`);
            
            setConnections(prev => prev.map(c => 
                c.id === data.connectionId 
                    ? { ...c, status: data.status as Connection['status'], qrCode: data.status === 'CONNECTED' ? undefined : c.qrCode }
                    : c
            ));

            if (data.status === 'CONNECTED') {
                // Clear QR for this connection
                delete qrRawCache[data.connectionId];
                setQrMap(prev => {
                    const next = { ...prev };
                    delete next[data.connectionId];
                    return next;
                });
                setConnectingId(null);
                toast.success('WhatsApp conectado com sucesso!');

                // Prompt for contact import
                if (confirm('WhatsApp Conectado! Deseja importar os contatos do seu telefone agora?')) {
                    api.post(`/whatsapp/${data.connectionId}/sync-contacts`).then(() => {
                        toast.success('Importação de contatos iniciada em segundo plano.');
                    }).catch(err => {
                        toast.error('Erro ao iniciar importação: ' + err.message);
                    });
                }
            } else if (data.status === 'DISCONNECTED') {
                delete qrRawCache[data.connectionId];
                setQrMap(prev => {
                    const next = { ...prev };
                    delete next[data.connectionId];
                    return next;
                });
            }
        });

        socket.on('connection:error', (data: { connectionId: string; error: string }) => {
            toast.error(`Erro na conexão: ${data.error}`);
            setConnectingId(null);
        });

        socket.on('test_event', (data: { connectionId: string; payload: any }) => {
            setTestEvents(prev => [{ ...data.payload, _receivedAt: new Date().toLocaleTimeString() }, ...prev].slice(0, 50));
        });

        socket.on('disconnect', () => {
            console.log('❌ WebSocket desconectado');
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    useEffect(() => {
        fetchConnections();
        // Polling fallback (less frequent since we have WebSocket)
        const interval = setInterval(fetchConnections, 8000);
        return () => clearInterval(interval);
    }, [fetchConnections]);

    // CRUD: Create
    const handleCreate = async () => {
        if (!formName) return toast.error('Nome é obrigatório');
        
        try {
            const payload: any = { name: formName, type: formType };
            if (formType === 'WHATSAPP') {
                payload.config = {
                    ...waConfig,
                    blockGroups: true,
                    groupWhitelist: []
                };
            }
            if (formType === 'EMAIL') {
                payload.config = emailConfig;
            }

            await api.post('/connections', payload);
            toast.success('Conexão criada!');
            resetForm();
            fetchConnections();
        } catch (error) {
            toast.error('Erro ao criar conexão');
        }
    };

    // CRUD: Update
    const handleUpdate = async () => {
        if (!editingConnection) return;
        if (!formName) return toast.error('Nome é obrigatório');
        
        try {
            const payload: any = { name: formName, type: formType };
            if (formType === 'WHATSAPP') {
                payload.config = {
                    ...editingConnection.config,
                    ...waConfig
                };
            }
            if (formType === 'EMAIL') {
                payload.config = emailConfig;
            }

            await api.patch(`/connections/${editingConnection.id}`, payload);
            toast.success('Conexão atualizada!');
            resetForm();
            fetchConnections();
        } catch (error) {
            toast.error('Erro ao atualizar conexão');
        }
    };

    // CRUD: Delete
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

    // Actions
    const handleConnect = async (connection: Connection) => {
        try {
            setConnectingId(connection.id);
            const response = await api.post(`/connections/${connection.id}/connect`);
            toast.info(response.data.message || 'Iniciando conexão...');
            // Don't clear connectingId here — wait for WebSocket status
            fetchConnections();
        } catch (error) {
            toast.error('Falha ao conectar');
            setConnectingId(null);
        }
    };

    const handleDisconnect = async (connection: Connection) => {
        try {
            await api.post(`/connections/${connection.id}/disconnect`);
            toast.success('Desconectado');
            setConnectingId(null);
            delete qrRawCache[connection.id];
            setQrMap(prev => {
                const next = { ...prev };
                delete next[connection.id];
                return next;
            });
            fetchConnections();
        } catch (error) {
            toast.error('Falha ao desconectar');
        }
    };

    const handleEdit = (conn: Connection) => {
        setEditingConnection(conn);
        setFormName(conn.name);
        setFormType(conn.type as any);
        setEmailConfig(conn.config?.email ? { email: conn.config.email, password: '' } : { email: '', password: '' });
        setWaConfig({ 
            evolutionChannel: conn.config?.evolutionChannel ?? 'baileys',
            evolutionToken: conn.config?.evolutionToken ?? '',
            evolutionNumber: conn.config?.evolutionNumber ?? '',
            evolutionVersion: conn.config?.evolutionVersion ?? '2.3000.x'
        });
        setIsCreating(false);
    };

    const resetForm = () => {
        setIsCreating(false);
        setEditingConnection(null);
        setFormName('');
        setFormType('WHATSAPP');
        setEmailConfig({ email: '', password: '' });
        setWaConfig({ 
            evolutionChannel: 'baileys',
            evolutionToken: '',
            evolutionNumber: '',
            evolutionVersion: '2.3000.x'
        });
    };

    const renderQrCode = (qrData: string | undefined | null) => {
        if (!qrData) return null;
        if (qrData.startsWith('data:image')) {
            return <img src={qrData} alt="QR Code Base64" className="w-[280px] h-[280px] object-contain rounded-xl bg-white p-2" />;
        }
        if (qrData.length > 500 && !qrData.includes('http') && !qrData.startsWith('{')) {
            // It might be raw base64 without prefix
            return <img src={`data:image/png;base64,${qrData}`} alt="QR Code Raw" className="w-[280px] h-[280px] object-contain rounded-xl bg-white p-2" />;
        }
        return (
            <div className="bg-white p-5 rounded-xl mb-4 shadow-xl shadow-black/20 ring-2 ring-amber-500/20">
                <QRCodeSVG 
                    value={qrData} 
                    size={280}
                    level="H" 
                    includeMargin={true}
                    bgColor="#ffffff"
                    fgColor="#000000"
                />
            </div>
        );
    };

    const handleSaveSettings = async () => {
        if (!settingsConnection) return;
        const versionInput = document.getElementById('configVersionInput') as HTMLInputElement;
        const newVersion = versionInput ? versionInput.value : '';
        
        try {
            const updatedConfig = {
                ...(settingsConnection.config || {}),
                evolutionVersion: newVersion
            };
            await api.put(`/connections/${settingsConnection.id}`, { config: updatedConfig });
            
            setConnections(prev => prev.map(c => 
                c.id === settingsConnection.id ? { ...c, config: updatedConfig } : c
            ));
            
            toast.success('Configurações salvas!');
        } catch (error) {
            toast.error('Erro ao salvar configurações.');
        }
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

    const getQrForConnection = (conn: Connection): string | null => {
        // Prefer real-time raw QR from WebSocket
        if (qrMap[conn.id]) return qrMap[conn.id];
        // Fallback: not available
        return null;
    };

    const isFormOpen = isCreating || editingConnection !== null;

    return (
        <>
            <div className="flex-1 flex flex-col bg-slate-950 p-6 md:p-8 animate-in fade-in zoom-in-95 duration-300 h-full overflow-hidden">
                {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Zap className="text-emerald-400" />
                        Conexões & Canais
                    </h2>
                    <p className="text-slate-400 mt-1">Gerencie seus canais de comunicação (WhatsApp, Email, Instagram).</p>
                </div>
                <button 
                    onClick={() => { resetForm(); setIsCreating(true); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition shadow-lg shadow-indigo-500/20"
                >
                    <Plus size={16} /> Nova Conexão
                </button>
            </div>

            {/* Create/Edit Form */}
            {isFormOpen && (
                <div className="mb-8 bg-slate-900 border border-indigo-500/50 p-6 rounded-xl animate-in slide-in-from-top-4">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-white">
                            {editingConnection ? 'Editar Conexão' : 'Adicionar Canal'}
                        </h3>
                        <button onClick={resetForm} className="text-slate-500 hover:text-white transition">
                            <X size={18} />
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Tipo de Canal <span className="text-red-500">*</span></label>
                            <select 
                                value={formType}
                                onChange={(e: any) => setFormType(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                                disabled={!!editingConnection}
                            >
                                <option value="WHATSAPP">WhatsApp</option>
                                <option value="EMAIL">Email</option>
                                <option value="INSTAGRAM">Instagram</option>
                                <option value="TELEGRAM">Telegram</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Nome da Conexão <span className="text-red-500">*</span></label>
                            <input 
                                value={formName}
                                onChange={e => setFormName(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                                placeholder="Ex: Financeiro WA"
                            />
                        </div>
                    </div>

                    {formType === 'WHATSAPP' && (
                        <div className="mb-4">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Channel</label>
                                    <select 
                                        value={waConfig.evolutionChannel}
                                        onChange={e => setWaConfig({ ...waConfig, evolutionChannel: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
                                    >
                                        <option value="baileys">Baileys</option>
                                        <option value="wo-cloud">API Oficial (Cloud)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Token <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text"
                                        value={waConfig.evolutionToken}
                                        onChange={e => setWaConfig({ ...waConfig, evolutionToken: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
                                        placeholder="Ex: A1291CA0CCD6..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Number</label>
                                    <input 
                                        type="text"
                                        value={waConfig.evolutionNumber}
                                        onChange={e => setWaConfig({ ...waConfig, evolutionNumber: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
                                        placeholder="Ex: 5511999999999"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {formType === 'EMAIL' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-4 bg-slate-950 rounded-lg border border-slate-800">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
                                <input value={emailConfig.email} onChange={e => setEmailConfig({...emailConfig, email: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white text-sm" type="email" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Senha (App Password)</label>
                                <input value={emailConfig.password} onChange={e => setEmailConfig({...emailConfig, password: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white text-sm" type="password" />
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-2">
                        <button onClick={resetForm} className="text-slate-400 hover:text-white px-4 py-2 text-sm transition">Cancelar</button>
                        <button 
                            onClick={editingConnection ? handleUpdate : handleCreate} 
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition"
                        >
                            {editingConnection ? 'Salvar Alterações' : 'Criar'}
                        </button>
                    </div>
                </div>
            )}

            {/* Connection Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto custom-scrollbar pb-6">
                {connections.map(conn => {
                    const rawQr = getQrForConnection(conn);
                    const isPairing = conn.status === 'PAIRING';
                    const isConnected = conn.status === 'CONNECTED';
                    const isThisConnecting = connectingId === conn.id;

                        return (
                        <div key={conn.id} className={clsx(
                            "bg-slate-900 border rounded-xl overflow-hidden flex flex-col group relative transition-all duration-300",
                            isConnected ? "border-emerald-500/40 shadow-lg shadow-emerald-500/5" :
                            isPairing ? "border-amber-500/40 shadow-lg shadow-amber-500/5 md:col-span-2 lg:col-span-2" :
                            "border-slate-800 hover:border-slate-600"
                        )}>
                            {/* Status Bar */}
                            <div className={clsx("h-1.5 w-full transition-all", 
                                isConnected ? "bg-emerald-500" : 
                                isPairing ? "bg-amber-500 animate-pulse" : 
                                "bg-slate-700"
                            )} />
                            
                            <div className="p-5 flex-1 flex flex-col">
                                {/* Card Header */}
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={clsx(
                                            "w-10 h-10 rounded-lg flex items-center justify-center border transition-all",
                                            isConnected ? "bg-emerald-500/10 border-emerald-500/30" :
                                            "bg-slate-800 border-slate-700"
                                        )}>
                                            {getIcon(conn.type)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-200 text-sm">{conn.name}</h3>
                                            <p className="text-xs text-slate-500 font-mono mt-0.5">{conn.type}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button 
                                            onClick={() => handleEdit(conn)} 
                                            className="text-slate-600 hover:text-indigo-400 transition p-1 rounded"
                                            title="Editar"
                                        >
                                            <Edit3 size={14} />
                                        </button>
                                        <button 
                                            onClick={(e) => handleDelete(conn.id, e)} 
                                            className="text-slate-600 hover:text-red-400 transition p-1 rounded"
                                            title="Excluir"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                {/* Card Body — QR or Status */}
                                <div className={clsx(
                                    "flex-1 flex flex-col items-center justify-center py-3",
                                    isPairing && (rawQr || conn.qrCode) ? "min-h-[340px]" : "min-h-[220px]"
                                )}>
                                    {isConnected ? (
                                        <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
                                            <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 relative">
                                                <CheckCircle size={40} className="text-emerald-500" />
                                                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                                                    <Wifi size={10} className="text-white" />
                                                </div>
                                            </div>
                                            <span className="text-slate-200 font-semibold text-sm">Pronto para uso</span>
                                            <span className="text-xs text-emerald-500/70 mt-1 flex items-center gap-1">
                                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                                Sincronizado
                                            </span>

                                            <button 
                                                onClick={() => {
                                                    api.post(`/whatsapp/${conn.id}/sync-contacts`)
                                                        .then(() => toast.success('Sincronização iniciada.'))
                                                        .catch(() => toast.error('Erro ao sincronizar.'));
                                                }}
                                                className="mt-4 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded-full border border-slate-700 transition flex items-center gap-1"
                                            >
                                                <RefreshCw size={10} /> Sincronizar Contatos
                                            </button>

                                            <button 
                                                onClick={() => setSettingsConnection(conn)}
                                                className="mt-2 text-[10px] bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-full border border-indigo-500/20 transition flex items-center gap-1 font-bold"
                                            >
                                                <Settings size={10} /> Ajustes da Instância
                                            </button>
                                        </div>
                                    ) : isPairing && rawQr ? (
                                        <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300 w-full">
                                            {renderQrCode(rawQr)}
                                            <span className="text-amber-400 text-sm font-semibold animate-pulse mt-2">
                                                Escaneie o QR Code
                                            </span>
                                            <span className="text-[11px] text-slate-500 mt-1">
                                                Abra WhatsApp → Aparelhos Conectados → Conectar
                                            </span>
                                        </div>
                                    ) : isPairing && conn.qrCode ? (
                                        <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300 w-full">
                                            {renderQrCode(conn.qrCode)}
                                            <span className="text-amber-400 text-sm font-semibold animate-pulse mt-2">
                                                Escaneie o QR Code
                                            </span>
                                            <span className="text-[11px] text-slate-500 mt-1">
                                                Abra WhatsApp → Aparelhos Conectados → Conectar
                                            </span>
                                        </div>
                                    ) : isThisConnecting ? (
                                        <div className="flex flex-col items-center text-indigo-400 animate-in fade-in">
                                            <Loader2 size={40} className="mb-3 animate-spin" />
                                            <span className="text-sm font-medium">Gerando QR Code...</span>
                                            <span className="text-[11px] text-slate-500 mt-1">Aguarde alguns segundos</span>
                                        </div>
                                    ) : isPairing ? (
                                        <div className="flex flex-col items-center text-amber-500 animate-in fade-in">
                                            <Loader2 size={40} className="mb-3 animate-spin" />
                                            <span className="text-sm font-medium">Aguardando QR Code...</span>
                                            <span className="text-[11px] text-slate-500 mt-1">Sincronizando com WhatsApp</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center text-slate-500">
                                            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-3">
                                                <WifiOff size={28} className="opacity-40" />
                                            </div>
                                            <span className="text-sm font-medium">Desconectado</span>
                                            <span className="text-[11px] text-slate-600 mt-1">Clique em "Conectar" para gerar QR Code</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Card Footer */}
                            <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-between items-center">
                                {getStatusBadge(conn.status)}
                                
                                {isConnected ? (
                                    <button 
                                        onClick={() => handleDisconnect(conn)}
                                        className="text-xs text-red-400 hover:text-red-300 hover:underline flex items-center gap-1 transition"
                                    >
                                        <Power size={12} /> Desconectar
                                    </button>
                                ) : isPairing ? (
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => handleConnect(conn)}
                                            className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
                                            title="Gerar novo QR Code"
                                        >
                                            <RefreshCw size={12} /> Novo QR
                                        </button>
                                        <button 
                                            onClick={() => handleDisconnect(conn)}
                                            className="text-xs text-slate-500 hover:text-red-400 flex items-center gap-1 transition"
                                        >
                                            <X size={12} /> Cancelar
                                        </button>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => handleConnect(conn)}
                                        disabled={isThisConnecting}
                                        className={clsx(
                                            "text-xs font-bold flex items-center gap-1 px-3 py-1.5 rounded-full border transition",
                                            isThisConnecting 
                                                ? "text-slate-500 border-slate-700 cursor-wait"
                                                : "text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20"
                                        )}
                                    >
                                        {isThisConnecting ? (
                                            <><Loader2 size={12} className="animate-spin" /> Conectando...</>
                                        ) : (
                                            <><RefreshCw size={12} /> Conectar</>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
                
                {connections.length === 0 && !loading && (
                    <div className="col-span-1 md:col-span-3 py-12 flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/50">
                        <Smartphone size={48} className="mb-4 opacity-50" />
                        <p className="font-medium">Nenhum canal conectado</p>
                        <p className="text-sm mt-1">Adicione WhatsApp, Instagram ou Email para começar.</p>
                    </div>
                )}

                {loading && connections.length === 0 && (
                    <div className="col-span-1 md:col-span-3 py-12 flex flex-col items-center justify-center text-slate-400">
                        <Loader2 size={32} className="animate-spin mb-3" />
                        <span>Carregando conexões...</span>
                    </div>
                )}
            </div>
        </div>

        {/* Modal Ajustes da Instância (EVOLUTION STYLE) */}
        {settingsConnection && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl h-[80vh] flex overflow-hidden animate-in fade-in zoom-in-95 shadow-2xl flex-col">
                    
                    {/* Header Evolutivo */}
                    <div className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="bg-indigo-500/10 p-2 rounded-lg">
                                <Smartphone className="text-indigo-400" size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white leading-tight">
                                    {settingsConnection.name}
                                </h3>
                                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                                    <span>Client: DR.X_Exchange</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            {getStatusBadge(settingsConnection.status)}
                            <button onClick={() => setSettingsConnection(null)} className="text-slate-500 hover:text-white transition bg-slate-800 p-2 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>
                    </div>
                    
                    {/* Layout Body (Sidebar + Content) */}
                    <div className="flex-1 flex overflow-hidden">
                        
                        {/* Sidebar Tabs */}
                        <div className="w-64 bg-slate-950/50 border-r border-slate-800 flex flex-col p-4 shrink-0 overflow-y-auto">
                            <button 
                                onClick={() => setActiveTab('dashboard')} 
                                className={clsx("flex items-center gap-3 w-full p-3 rounded-lg text-sm font-medium transition-all mb-1", activeTab === 'dashboard' ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-slate-300")}
                            >
                                <Zap size={18} /> Dashboard
                            </button>
                            <button 
                                onClick={() => setActiveTab('configurations')} 
                                className={clsx("flex items-center gap-3 w-full p-3 rounded-lg text-sm font-medium transition-all mb-1", activeTab === 'configurations' ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-slate-300")}
                            >
                                <Settings size={18} /> Configurations
                            </button>
                            <button 
                                onClick={() => setActiveTab('test')} 
                                className={clsx("flex items-center gap-3 w-full p-3 rounded-lg text-sm font-medium transition-all mb-1", activeTab === 'test' ? "bg-emerald-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-slate-300")}
                            >
                                <MessageCircle size={18} /> Aba de Teste
                            </button>
                            <button 
                                onClick={() => setActiveTab('events')} 
                                className={clsx("flex items-center gap-3 w-full p-3 rounded-lg text-sm font-medium transition-all mb-1", activeTab === 'events' ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-slate-300")}
                            >
                                <Zap size={18} /> Events (Webhooks)
                            </button>
                            <button 
                                onClick={() => setActiveTab('integrations')} 
                                className={clsx("flex items-center gap-3 w-full p-3 rounded-lg text-sm font-medium transition-all mb-1", activeTab === 'integrations' ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-slate-300")}
                            >
                                <Zap size={18} /> Integrations
                            </button>
                        </div>
                        
                        {/* Tab Content */}
                        <div className="flex-1 bg-slate-900 p-8 overflow-y-auto custom-scrollbar relative">
                            {activeTab === 'dashboard' && (
                                <div className="space-y-6 animate-in fade-in">
                                    <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl flex flex-col gap-4 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-bl-full pointer-events-none" />
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">ID da Instância (Identificador DR.X)</label>
                                        <div className="bg-slate-900 border border-slate-700/50 p-3 rounded-lg text-sm text-indigo-300 font-mono flex justify-between group cursor-copy" onClick={() => { navigator.clipboard.writeText(settingsConnection.id); toast.success('Copiado'); }}>
                                            <span>{settingsConnection.id}</span>
                                            <span className="text-slate-500 opacity-0 group-hover:opacity-100 transition">Copiar</span>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl flex flex-col gap-4">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            Status da Conexão
                                        </label>
                                        <div className="flex justify-between items-center bg-slate-900 border border-slate-700/50 p-4 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className={clsx("w-3 h-3 rounded-full animate-pulse", settingsConnection.status === 'CONNECTED' ? "bg-emerald-500" : "bg-red-500")} />
                                                <span className="text-white font-medium">Current Status: {settingsConnection.status}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => handleDisconnect(settingsConnection)}
                                                    className="bg-red-500/10 text-red-400 hover:bg-red-500/20 px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2"
                                                >
                                                    <Power size={14} /> LOGOUT
                                                </button>
                                                <button 
                                                    onClick={() => handleConnect(settingsConnection)}
                                                    className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2"
                                                >
                                                    <RefreshCw size={14} /> RECONNECT
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-6">
                                        <div className="bg-slate-950 border border-slate-800 p-6 rounded-xl flex flex-col items-center justify-center text-center">
                                            <Users size={32} className="text-slate-600 mb-3" />
                                            <span className="text-3xl font-black text-white">0</span>
                                            <span className="text-xs text-slate-400 mt-1 uppercase font-bold tracking-wider">Contatos</span>
                                        </div>
                                        <div className="bg-slate-950 border border-slate-800 p-6 rounded-xl flex flex-col items-center justify-center text-center">
                                            <MessageCircle size={32} className="text-slate-600 mb-3" />
                                            <span className="text-3xl font-black text-white">0</span>
                                            <span className="text-xs text-slate-400 mt-1 uppercase font-bold tracking-wider">Chats</span>
                                        </div>
                                        <div className="bg-slate-950 border border-slate-800 p-6 rounded-xl flex flex-col items-center justify-center text-center">
                                            <Shield size={32} className="text-slate-600 mb-3" />
                                            <span className="text-3xl font-black text-white">0</span>
                                            <span className="text-xs text-slate-400 mt-1 uppercase font-bold tracking-wider">Mensagens</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'configurations' && (
                                <div className="space-y-6 animate-in fade-in max-w-2xl">
                                    <h2 className="text-xl font-bold text-white mb-6">Device Configurations</h2>
                                    
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 mb-2">Versão do WhatsApp (whatsappVersion)</label>
                                            <input 
                                                id="configVersionInput"
                                                type="text"
                                                defaultValue={settingsConnection.config?.evolutionVersion || "2.3000.x"}
                                                placeholder="ex: 2.3000.x, ou deixe em branco para default do Baileys"
                                                className="w-full bg-slate-950 border border-slate-800 p-3 rounded-lg text-sm text-white focus:border-indigo-500 outline-none"
                                            />
                                            <p className="text-[10px] text-slate-500 mt-1">
                                                A configuração exata da Evolution dita que preencher este campo pode evitar loops ou falhas no QR no caso do Baileys exigir versão específica de Device.
                                            </p>
                                        </div>
                                        
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 mb-2">Webhook URL Global</label>
                                            <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-sm text-slate-300 font-mono">
                                                {window.location.origin.replace('5173', '3000')}/evolution/webhook
                                            </div>
                                        </div>
                                        
                                        <div className="pt-4 border-t border-slate-800">
                                            <button 
                                                onClick={handleSaveSettings}
                                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg text-sm font-bold transition">
                                                Salvar Alterações
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'test' && (
                                <div className="space-y-6 animate-in fade-in h-full flex flex-col">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <MessageCircle className="text-emerald-500" />
                                            <h2 className="text-xl font-bold text-white">Interface de Testes e Webhooks</h2>
                                        </div>
                                        {testEvents.length > 0 && (
                                            <button onClick={() => setTestEvents([])} className="text-xs text-slate-400 hover:text-white bg-slate-800 px-3 py-1 rounded">Limpar Logs</button>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-400 bg-emerald-500/10 text-emerald-300 p-3 border border-emerald-500/20 rounded-lg shrink-0">
                                        Utilize esta ferramenta para forçar o envio a partir da instância DR.X e receber instantaneamente (à direita) os webhooks gerados de qualquer mensagem recebida no seu celular.
                                    </p>
                                    
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
                                        
                                        {/* Painel de Envio */}
                                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 flex flex-col h-full">
                                            <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider">📤 Enviar Mensagem</h3>
                                            <div className="space-y-4 flex-1">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-400 mb-2">Número Alvo</label>
                                                    <input 
                                                        id="testTargetNum"
                                                        type="text"
                                                        placeholder="5511999999999"
                                                        className="w-full bg-slate-900 border border-slate-800 p-3 rounded-lg text-sm text-white focus:border-emerald-500 outline-none"
                                                    />
                                                </div>
                                                <div className="flex-1 flex flex-col">
                                                    <label className="block text-xs font-bold text-slate-400 mb-2">Mensagem (Payload TXT)</label>
                                                    <textarea 
                                                        id="testTargetMsg"
                                                        placeholder="Olá! Esta é uma mensagem de teste de diagnóstico."
                                                        className="w-full flex-1 min-h-[150px] bg-slate-900 border border-slate-800 p-3 rounded-lg text-sm text-white focus:border-emerald-500 outline-none resize-none"
                                                    />
                                                </div>
                                                <button 
                                                    onClick={() => {
                                                        const num = (document.getElementById('testTargetNum') as HTMLInputElement).value;
                                                        const text = (document.getElementById('testTargetMsg') as HTMLTextAreaElement).value;
                                                        if(!num || !text) return toast.error('Preencha os dados!');
                                                        toast.promise(api.post(`/whatsapp/${settingsConnection.id}/test-message`, { text, to: num }), {
                                                            loading: 'Disparando evento via Evolution...',
                                                            success: 'Enviado! (Verifique o log de webhook)',
                                                            error: 'Falha no repasse'
                                                        });
                                                    }}
                                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 mt-auto"
                                                >
                                                    <Zap size={16} /> Disparar Teste
                                                </button>
                                            </div>
                                        </div>

                                        {/* Painel de Recepção (Log) */}
                                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-0 flex flex-col h-full overflow-hidden">
                                            <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">📥 Webhoook Listener</h3>
                                            </div>
                                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-[#0d1117] font-mono text-[11px] text-emerald-400 leading-relaxed space-y-4">
                                                {testEvents.length === 0 ? (
                                                    <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
                                                        <Wifi size={32} className="mb-2" />
                                                        <p>Aguardando eventos...</p>
                                                    </div>
                                                ) : (
                                                    testEvents.map((evt, idx) => (
                                                        <div key={idx} className="border-l-2 border-emerald-500/50 pl-3">
                                                            <div className="text-slate-500 mb-1">[{evt._receivedAt}] Event: {evt.event}</div>
                                                            <pre className="whitespace-pre-wrap break-all pl-2 text-slate-300">
                                                                {JSON.stringify(evt, null, 2)}
                                                            </pre>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            )}
                            
                            {(activeTab === 'events' || activeTab === 'integrations') && (
                                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                    <Shield size={48} className="opacity-20 mb-4" />
                                    <span className="font-bold">Aba em Desenvolvimento</span>
                                    <span className="text-xs text-slate-600 mt-1 text-center max-w-sm">Esta seção espelhará exatamente as abas da Evolution v2 para controle de roteamentos e webhooks extras.</span>
                                </div>
                            )}

                        </div>
                    </div>

                </div>
            </div>
        )}
        </>
    );
}
