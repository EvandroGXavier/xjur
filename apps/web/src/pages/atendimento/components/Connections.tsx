
import { useState, useEffect, useRef, useCallback } from 'react';
import { Smartphone, RefreshCw, Power, Plus, Mail, MessageCircle, Trash2, CheckCircle, Loader2, Edit3, X, Wifi, WifiOff, Zap } from 'lucide-react';
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
    const [connectingId, setConnectingId] = useState<string | null>(null);
    const [qrMap, setQrMap] = useState<Record<string, string>>({});
    const socketRef = useRef<Socket | null>(null);
    
    // Form State
    const [formName, setFormName] = useState('');
    const [formType, setFormType] = useState<'WHATSAPP' | 'INSTAGRAM' | 'EMAIL'>('WHATSAPP');
    const [emailConfig, setEmailConfig] = useState({ email: '', password: '' });

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
            if (formType === 'EMAIL') {
                if (!emailConfig.email || !emailConfig.password) return toast.error('Credenciais obrigatórias');
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
        setFormType(conn.type);
        setEmailConfig(conn.config?.email ? { email: conn.config.email, password: '' } : { email: '', password: '' });
        setIsCreating(false);
    };

    const resetForm = () => {
        setIsCreating(false);
        setEditingConnection(null);
        setFormName('');
        setFormType('WHATSAPP');
        setEmailConfig({ email: '', password: '' });
    };

    const getIcon = (type: string) => {
        switch(type) {
            case 'WHATSAPP': return <MessageCircle className="text-emerald-500" />;
            case 'INSTAGRAM': return <div className="text-pink-500 font-bold">IG</div>;
            case 'EMAIL': return <Mail className="text-blue-500" />;
            default: return <Smartphone />;
        }
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
                            <label className="block text-xs font-medium text-slate-400 mb-1">Nome (Identificação)</label>
                            <input 
                                value={formName}
                                onChange={e => setFormName(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                                placeholder="Ex: WhatsApp Comercial"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Tipo de Canal</label>
                            <select 
                                value={formType}
                                onChange={(e: any) => setFormType(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                                disabled={!!editingConnection}
                            >
                                <option value="WHATSAPP">WhatsApp Business</option>
                                <option value="INSTAGRAM">Instagram Direct</option>
                                <option value="EMAIL">Email (IMAP/SMTP)</option>
                            </select>
                        </div>
                    </div>

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
                                        </div>
                                    ) : isPairing && rawQr ? (
                                        <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300 w-full">
                                            {/* QR Code — Large and clear using SVG */}
                                            <div className="bg-white p-5 rounded-xl mb-4 shadow-xl shadow-black/20 ring-2 ring-amber-500/20">
                                                <QRCodeSVG 
                                                    value={rawQr} 
                                                    size={280}
                                                    level="H" 
                                                    includeMargin={true}
                                                    bgColor="#ffffff"
                                                    fgColor="#000000"
                                                />
                                            </div>
                                            <span className="text-amber-400 text-sm font-semibold animate-pulse">
                                                Escaneie o QR Code
                                            </span>
                                            <span className="text-[11px] text-slate-500 mt-1">
                                                Abra WhatsApp → Aparelhos Conectados → Conectar
                                            </span>
                                        </div>
                                    ) : isPairing && conn.qrCode ? (
                                        /* Fallback: use base64 QR from database (polling) */
                                        <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300 w-full">
                                            <div className="bg-white p-5 rounded-xl mb-4 shadow-xl shadow-black/20 ring-2 ring-amber-500/20">
                                                <img src={conn.qrCode} alt="QR Code" className="w-[280px] h-[280px] object-contain" />
                                            </div>
                                            <span className="text-amber-400 text-sm font-semibold animate-pulse">
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
                                            <span className="text-[11px] text-slate-600 mt-1">Clique em "Conectar" para iniciar</span>
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
    );
}
