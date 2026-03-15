
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

// Store raw QR strings from websocket (keyed by connectionId)
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
        return responseMessage.join(' ');
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
        case 'WHATSAPP':
            return 'WhatsApp';
        case 'TELEGRAM':
            return 'Telegram';
        case 'EMAIL':
            return 'Email';
        case 'INSTAGRAM':
            return 'Instagram';
        default:
            return type;
    }
};

const maskToken = (value?: string | null) => {
    const normalized = String(value || '').trim();
    if (!normalized) return '--';
    if (normalized.length <= 10) return normalized;
    return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
};

interface ConnectionsProps {
    onOpenHelp?: () => void;
}

export function Connections({ onOpenHelp }: ConnectionsProps) {
    const [connections, setConnections] = useState<Connection[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
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
    const [waConfig, setWaConfig] = useState(defaultWaConfig);
    const [telegramConfig, setTelegramConfig] = useState(defaultTelegramConfig);
    const [formError, setFormError] = useState<string | null>(null);

    const fetchConnections = useCallback(async () => {
        try {
            const response = await api.get<Connection[]>('/connections');
            setConnections(response.data);
            setLoadError(null);
        } catch (error) {
            console.error('Failed to fetch connections', error);
            setLoadError(getRequestErrorMessage(error, 'Nao foi possivel carregar as conexoes.'));
        } finally {
            setLoading(false);
        }
    }, [connections]);

    // Connect WebSocket for real-time updates
    useEffect(() => {
        const socketUrl = window.location.hostname === 'localhost' || window.location.hostname.includes('idx.google.com')
            ? `http://${window.location.hostname}:3000/whatsapp`
            : '/whatsapp';

        console.log('�xR Conectando WebSocket WhatsApp:', socketUrl);

        const socket = io(socketUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 20,
            reconnectionDelay: 2000,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('�S& WebSocket WhatsApp conectado');
        });

        socket.on('qr_code', (data: { connectionId: string; qr: string }) => {
            console.log(`�x� QR Code recebido para ${data.connectionId}`);
            qrRawCache[data.connectionId] = data.qr;
            setQrMap(prev => ({ ...prev, [data.connectionId]: data.qr }));
            
            // Also update connection status locally
            setConnections(prev => prev.map(c => 
                c.id === data.connectionId && c.type === 'WHATSAPP'
                    ? { ...c, status: 'PAIRING' as const }
                    : c
            ));
        });

        socket.on('connection:status', (data: { connectionId: string; status: string }) => {
            console.log(`�x� Status: ${data.connectionId} �  ${data.status}`);
            
            const connection = connections.find((item) => item.id === data.connectionId);

            setConnections(prev => prev.map(c => 
                c.id === data.connectionId 
                    ? { ...c, status: data.status as Connection['status'], qrCode: data.status === 'CONNECTED' ? undefined : c.qrCode }
                    : c
            ));

            if (data.status === 'CONNECTED' && connection?.type === 'WHATSAPP') {
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
            console.log('�R WebSocket desconectado');
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
    const handleCreateLegacy = async () => {
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
            if (formType === 'TELEGRAM') {
                payload.config = {
                    botToken: telegramConfig.botToken.trim(),
                    webhookBaseUrl: telegramConfig.webhookBaseUrl.trim(),
                };
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
    const handleUpdateLegacy = async () => {
        if (!editingConnection) return;
        if (!formName) return toast.error('Nome é obrigatório');
        
        try {
            const payload: any = { name: formName, type: formType };
            if (formType === 'WHATSAPP') {
                const { evolutionToken, evolutionNumber, evolutionChannel, ...currentConfig } = editingConnection.config || {};
                payload.config = {
                    ...currentConfig,
                    ...waConfig,
                    blockGroups: editingConnection.config?.blockGroups ?? true,
                    groupWhitelist: editingConnection.config?.groupWhitelist ?? []
                };
            }
            if (formType === 'EMAIL') {
                payload.config = emailConfig;
            }
            if (formType === 'TELEGRAM') {
                const currentConfig = editingConnection.config || {};
                payload.config = {
                    ...currentConfig,
                    botToken: telegramConfig.botToken.trim(),
                    webhookBaseUrl: telegramConfig.webhookBaseUrl.trim(),
                };
            }

            await api.patch(`/connections/${editingConnection.id}`, payload);
            toast.success('Conexão atualizada!');
            resetForm();
            fetchConnections();
        } catch (error) {
            toast.error('Erro ao atualizar conexão');
        }
    };
    const handleCreate = async () => {
        const trimmedName = formName.trim();
        if (!trimmedName) {
            const message = 'Nome e obrigatorio.';
            setFormError(message);
            return toast.error(message);
        }
        if (formType === 'TELEGRAM' && !telegramConfig.botToken.trim()) {
            const message = 'Bot Token e obrigatorio para criar conexoes do Telegram.';
            setFormError(message);
            return toast.error(message);
        }

        try {
            setIsSubmitting(true);
            setFormError(null);

            const payload: any = { name: trimmedName, type: formType };
            if (formType === 'WHATSAPP') {
                payload.config = {
                    blockGroups: true,
                    groupWhitelist: [],
                    ...(waConfig.evolutionApiKey.trim() ? { evolutionApiKey: waConfig.evolutionApiKey.trim() } : {}),
                    ...(waConfig.evolutionUrl.trim() ? { evolutionUrl: waConfig.evolutionUrl.trim() } : {}),
                    ...(waConfig.evolutionVersion.trim() ? { evolutionVersion: waConfig.evolutionVersion.trim() } : {}),
                };
            }
            if (formType === 'EMAIL') {
                payload.config = {
                    email: emailConfig.email.trim(),
                    password: emailConfig.password,
                };
            }
            if (formType === 'TELEGRAM') {
                payload.config = {
                    botToken: telegramConfig.botToken.trim(),
                    webhookBaseUrl: telegramConfig.webhookBaseUrl.trim(),
                };
            }

            const response = await api.post('/connections', payload);
            toast.success(`Conexao "${response.data?.name || trimmedName}" criada com sucesso.`);
            resetForm();
            await fetchConnections();
        } catch (error) {
            const message = getRequestErrorMessage(error, 'Erro ao criar conexao.');
            setFormError(message);
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdate = async () => {
        if (!editingConnection) return;

        const trimmedName = formName.trim();
        if (!trimmedName) {
            const message = 'Nome e obrigatorio.';
            setFormError(message);
            return toast.error(message);
        }

        try {
            setIsSubmitting(true);
            setFormError(null);

            const payload: any = { name: trimmedName, type: formType };
            if (formType === 'WHATSAPP') {
                const { evolutionToken, evolutionNumber, evolutionChannel, ...currentConfig } = editingConnection.config || {};
                payload.config = {
                    ...currentConfig,
                    ...waConfig,
                    blockGroups: editingConnection.config?.blockGroups ?? true,
                    groupWhitelist: editingConnection.config?.groupWhitelist ?? []
                };
            }
            if (formType === 'EMAIL') {
                payload.config = emailConfig;
            }
            if (formType === 'TELEGRAM') {
                const currentConfig = editingConnection.config || {};
                payload.config = {
                    ...currentConfig,
                    botToken: telegramConfig.botToken.trim(),
                    webhookBaseUrl: telegramConfig.webhookBaseUrl.trim(),
                };
            }

            await api.patch(`/connections/${editingConnection.id}`, payload);
            toast.success('Conexao atualizada com sucesso.');
            resetForm();
            await fetchConnections();
        } catch (error) {
            const message = getRequestErrorMessage(error, 'Erro ao atualizar conexao.');
            setFormError(message);
            toast.error(message);
        } finally {
            setIsSubmitting(false);
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
            const nextStatus = response.data?.status as Connection['status'] | undefined;
            const mergedConfig = {
                ...(connection.config || {}),
                webhookUrl: response.data?.webhookUrl ?? connection.config?.webhookUrl,
                botUsername: response.data?.botUsername ?? connection.config?.botUsername,
                botId: response.data?.botId ?? connection.config?.botId,
            };

            setConnections(prev => prev.map(item =>
                item.id === connection.id
                    ? { ...item, status: nextStatus ?? item.status, config: mergedConfig }
                    : item
            ));

            if (connection.type === 'TELEGRAM') {
                setConnectingId(null);
                toast.success(response.data?.message || 'Telegram conectado com sucesso.');
            } else {
                toast.info(response.data.message || 'Iniciando conexÃ£o...');
            }
            toast.info(response.data.message || 'Iniciando conexão...');
            // Don't clear connectingId here � wait for WebSocket status
            fetchConnections();
        } catch (error) {
            toast.error(getRequestErrorMessage(error, 'Falha ao conectar.'));
            setConnectingId(null);
        }
    };

    const handleDisconnect = async (connection: Connection) => {
        try {
            await api.post(`/connections/${connection.id}/disconnect`);
            toast.success(`${getConnectionTypeLabel(connection.type)} desconectado com sucesso.`);
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
            const statusData = response.data || {};
            const mergedConfig = {
                ...(connection.config || {}),
                webhookUrl: statusData.webhookUrl ?? connection.config?.webhookUrl,
                botUsername: statusData.botUsername ?? connection.config?.botUsername,
                pendingUpdateCount: statusData.pendingUpdateCount ?? connection.config?.pendingUpdateCount,
                lastErrorMessage: statusData.lastErrorMessage ?? null,
                lastErrorDate: statusData.lastErrorDate ?? null,
                contactsCount: statusData.contactsCount ?? connection.config?.contactsCount ?? 0,
                chatsCount: statusData.chatsCount ?? connection.config?.chatsCount ?? 0,
                messagesCount: statusData.messagesCount ?? connection.config?.messagesCount ?? 0,
            };

            setConnections(prev => prev.map(item =>
                item.id === connection.id
                    ? { ...item, status: statusData.status ?? item.status, config: mergedConfig }
                    : item
            ));

            setSettingsConnection(prev => {
                if (prev?.id && prev.id !== connection.id) {
                    return prev;
                }

                return prev
                    ? {
                        ...prev,
                        status: statusData.status ?? prev.status,
                        config: mergedConfig,
                    }
                    : {
                        ...connection,
                        status: statusData.status ?? connection.status,
                        config: mergedConfig,
                    };
            });

            if (connection.type === 'TELEGRAM') {
                if (statusData.lastErrorMessage) {
                    toast.warning(`Telegram: ${statusData.lastErrorMessage}`);
                } else {
                    toast.success(
                        statusData.status === 'CONNECTED'
                            ? `Telegram ativo. Pendentes: ${statusData.pendingUpdateCount ?? 0}`
                            : `Telegram em ${String(statusData.status || connection.status).toLowerCase()}.`,
                    );
                }
                return;
            }

            toast.success(`Status atualizado: ${statusData.status || connection.status}`);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Nao foi possivel atualizar o status.');
        }
    };

    const handleEdit = (conn: Connection) => {
        const legacyEvolutionUrl = typeof conn.config?.evolutionNumber === 'string' && conn.config.evolutionNumber.startsWith('http')
            ? conn.config.evolutionNumber
            : '';

        setEditingConnection(conn);
        setFormName(conn.name);
        setFormType(conn.type as any);
        setEmailConfig(conn.config?.email ? { email: conn.config.email, password: '' } : { email: '', password: '' });
        setWaConfig({ 
            evolutionApiKey: conn.config?.evolutionApiKey ?? conn.config?.evolutionToken ?? '',
            evolutionUrl: conn.config?.evolutionUrl ?? legacyEvolutionUrl,
            evolutionVersion: conn.config?.evolutionVersion ?? '2.3000.x'
        });
        setTelegramConfig({
            botToken: conn.config?.botToken ?? '',
            webhookBaseUrl: conn.config?.webhookBaseUrl ?? '',
        });
        setFormError(null);
        setIsCreating(false);
    };

    const resetForm = () => {
        setIsCreating(false);
        setEditingConnection(null);
        setFormName('');
        setFormType('WHATSAPP');
        setEmailConfig({ email: '', password: '' });
        setWaConfig(defaultWaConfig);
        setTelegramConfig(defaultTelegramConfig);
        setFormError(null);
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
        const telegramBotTokenInput = document.getElementById('telegramBotTokenInput') as HTMLInputElement | null;
        const telegramWebhookInput = document.getElementById('telegramWebhookBaseUrlInput') as HTMLInputElement | null;
        
        try {
            const updatedConfig = settingsConnection.type === 'TELEGRAM'
                ? {
                    ...(settingsConnection.config || {}),
                    botToken: telegramBotTokenInput?.value?.trim() || settingsConnection.config?.botToken || '',
                    webhookBaseUrl: telegramWebhookInput?.value?.trim() || '',
                }
                : {
                    ...(settingsConnection.config || {}),
                    evolutionVersion: newVersion
                };
            await api.patch(`/connections/${settingsConnection.id}`, { config: updatedConfig });
            
            setConnections(prev => prev.map(c => 
                c.id === settingsConnection.id ? { ...c, config: updatedConfig } : c
            ));
            setSettingsConnection(prev => prev ? { ...prev, config: updatedConfig } : prev);
            
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
            <div className="flex-1 flex h-full flex-col overflow-hidden bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 p-6 md:p-8 animate-in fade-in zoom-in-95 duration-300">
                {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Zap className="text-emerald-400" />
                        Conexões & Canais
                    </h2>
                    <p className="text-slate-400 mt-1">Gerencie seus canais de comunicação (WhatsApp, Email, Instagram).</p>
                </div>
                <div className="flex items-center gap-3">
                    {onOpenHelp && (
                        <button
                            onClick={onOpenHelp}
                            title="Ajuda (CTRL + F1)"
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition border border-slate-700"
                        >
                            <HelpCircle size={16} /> Ajuda
                        </button>
                    )}
                <button 
                    onClick={() => { resetForm(); setIsCreating(true); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition shadow-lg shadow-indigo-500/20"
                >
                    <Plus size={16} /> Nova Conexão
                </button>
                </div>
            </div>

            {loadError && (
                <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4 text-sm text-amber-100 shadow-lg shadow-black/10">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300" />
                    <div className="space-y-1">
                        <p className="font-semibold text-amber-50">Nao foi possivel sincronizar o modulo de conexoes.</p>
                        <p className="text-amber-100/80">{loadError}</p>
                        <p className="text-xs text-amber-100/70">Se a API estiver parada, a tela pode parecer vazia e a criacao vai falhar mesmo com o formulario preenchido.</p>
                    </div>
                </div>
            )}

            {/* Create/Edit Form */}
            {isFormOpen && (
                <div className="mx-auto mb-8 w-full max-w-5xl rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-6 shadow-2xl shadow-black/30 ring-1 ring-indigo-500/15 animate-in slide-in-from-top-4">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-white">
                            {editingConnection ? 'Editar Conexão' : 'Adicionar Canal'}
                        </h3>
                        <button onClick={resetForm} className="text-slate-500 hover:text-white transition">
                            <X size={18} />
                        </button>
                    </div>
                    <div className="mb-4 flex items-start gap-3 rounded-2xl border border-indigo-500/15 bg-indigo-500/10 px-4 py-4 text-sm text-slate-200">
                        <MessageCircle size={18} className="mt-0.5 shrink-0 text-emerald-300" />
                        <div className="space-y-1">
                            <p className="font-semibold text-white">Fluxo recomendado</p>
                            <p className="text-slate-300">Crie a instancia primeiro, depois clique em conectar para gerar o QR Code. Se a API estiver offline, o motivo real aparece abaixo.</p>
                        </div>
                    </div>
                    {formError && (
                        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-4 text-sm text-red-100">
                            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-300" />
                            <div>
                                <p className="font-semibold text-red-50">Nao foi possivel salvar a conexao.</p>
                                <p className="mt-1 text-red-100/80">{formError}</p>
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Tipo de Canal <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <select 
                                    value={formType}
                                    onChange={(e: any) => {
                                        setFormType(e.target.value);
                                        setFormError(null);
                                    }}
                                    className={selectClass}
                                    disabled={!!editingConnection}
                                >
                                    <option value="WHATSAPP">WhatsApp</option>
                                    <option value="EMAIL">Email</option>
                                    <option value="INSTAGRAM">Instagram</option>
                                    <option value="TELEGRAM">Telegram</option>
                                </select>
                                <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Nome da Conexão <span className="text-red-500">*</span></label>
                            <input 
                                value={formName}
                                onChange={e => {
                                    setFormName(e.target.value);
                                    setFormError(null);
                                }}
                                className={fieldClass}
                                placeholder="Ex: Financeiro WA"
                            />
                        </div>
                    </div>

                    {formType === 'WHATSAPP' && (
                        <div className={`mb-4 ${sectionClass}`}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">API Key da Evolution</label>
                                    <input 
                                        type="text"
                                        value={waConfig.evolutionApiKey}
                                        onChange={e => {
                                            setWaConfig({ ...waConfig, evolutionApiKey: e.target.value });
                                            setFormError(null);
                                        }}
                                        className={fieldClass}
                                        placeholder="Ex: A1291CA0CCD6..."
                                    />
                                    <p className={helpTextClass}>Se ficar em branco, a conexao usa a API key padrao do servidor.</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">URL da Evolution</label>
                                    <input 
                                        type="text"
                                        value={waConfig.evolutionUrl}
                                        onChange={e => {
                                            setWaConfig({ ...waConfig, evolutionUrl: e.target.value });
                                            setFormError(null);
                                        }}
                                        className={fieldClass}
                                        placeholder="Ex: http://localhost:8080"
                                    />
                                    <p className={helpTextClass}>Opcional. Preencha apenas se esta conexao usar uma Evolution diferente da configurada no backend.</p>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Versao do WhatsApp</label>
                                    <input 
                                        type="text"
                                        value={waConfig.evolutionVersion}
                                        onChange={e => {
                                            setWaConfig({ ...waConfig, evolutionVersion: e.target.value });
                                            setFormError(null);
                                        }}
                                        className={fieldClass}
                                        placeholder="Ex: 2.3000.x"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    {formType === 'EMAIL' && (
                        <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 ${sectionClass}`}>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
                                <input value={emailConfig.email} onChange={e => { setEmailConfig({...emailConfig, email: e.target.value}); setFormError(null); }} className={fieldClass} type="email" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Senha (App Password)</label>
                                <input value={emailConfig.password} onChange={e => { setEmailConfig({...emailConfig, password: e.target.value}); setFormError(null); }} className={fieldClass} type="password" />
                            </div>
                        </div>
                    )}
                    {formType === 'TELEGRAM' && (
                        <div className={`grid grid-cols-1 gap-4 mb-4 ${sectionClass} border-sky-500/20`}>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Bot Token <span className="text-red-500">*</span></label>
                                <input
                                    type="password"
                                    value={telegramConfig.botToken}
                                    onChange={e => { setTelegramConfig({ ...telegramConfig, botToken: e.target.value }); setFormError(null); }}
                                    className={fieldClass}
                                    placeholder="Ex: 123456789:AA..."
                                />
                                <p className={helpTextClass}>Use o token gerado pelo BotFather para registrar o webhook.</p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Webhook Base URL</label>
                                <input
                                    type="text"
                                    value={telegramConfig.webhookBaseUrl}
                                    onChange={e => { setTelegramConfig({ ...telegramConfig, webhookBaseUrl: e.target.value }); setFormError(null); }}
                                    className={fieldClass}
                                    placeholder="Ex: https://seu-dominio.com"
                                />
                                <p className={helpTextClass}>Opcional. Se ficar vazio, o backend usa TELEGRAM_WEBHOOK_BASE_URL ou APP_URL.</p>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
                        <button onClick={resetForm} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white">Cancelar</button>
                        <button 
                            onClick={editingConnection ? handleUpdate : handleCreate} 
                            disabled={isSubmitting}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60"
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
                    const isWhatsapp = conn.type === 'WHATSAPP';
                    const isTelegram = conn.type === 'TELEGRAM';
                    const botUsername = String(conn.config?.botUsername || '').trim();
                    const webhookUrl = String(conn.config?.webhookUrl || '').trim();
                    const lastTelegramError = String(conn.config?.lastErrorMessage || '').trim();

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

                                {/* Card Body � QR or Status */}
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
                                                {isTelegram ? 'Webhook sincronizado' : 'Sincronizado'}
                                            </span>

                                            {isWhatsapp && <button 
                                                onClick={() => {
                                                    api.post(`/whatsapp/${conn.id}/sync-contacts`)
                                                        .then(() => toast.success('Sincronização iniciada.'))
                                                        .catch(() => toast.error('Erro ao sincronizar.'));
                                                }}
                                                className="mt-4 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded-full border border-slate-700 transition flex items-center gap-1"
                                            >
                                                <RefreshCw size={10} /> Sincronizar Contatos
                                            </button>}

                                            <button 
                                                onClick={() => {
                                                    setSettingsConnection(conn);
                                                    setActiveTab('dashboard');
                                                    handleRefreshStatus(conn);
                                                }}
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
                                                Abra WhatsApp �  Aparelhos Conectados �  Conectar
                                            </span>
                                        </div>
                                    ) : isPairing && conn.qrCode ? (
                                        <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300 w-full">
                                            {renderQrCode(conn.qrCode)}
                                            <span className="text-amber-400 text-sm font-semibold animate-pulse mt-2">
                                                Escaneie o QR Code
                                            </span>
                                            <span className="text-[11px] text-slate-500 mt-1">
                                                Abra WhatsApp �  Aparelhos Conectados �  Conectar
                                            </span>
                                        </div>
                                    ) : isThisConnecting ? (
                                        <div className="flex flex-col items-center text-indigo-400 animate-in fade-in">
                                            <Loader2 size={40} className="mb-3 animate-spin" />
                                            <span className="text-sm font-medium">{isWhatsapp ? 'Gerando QR Code...' : 'Validando bot e webhook...'}</span>
                                            <span className="text-[11px] text-slate-500 mt-1">Aguarde alguns segundos</span>
                                        </div>
                                    ) : isPairing ? (
                                        <div className="flex flex-col items-center text-amber-500 animate-in fade-in">
                                            <Loader2 size={40} className="mb-3 animate-spin" />
                                            <span className="text-sm font-medium">{isWhatsapp ? 'Aguardando QR Code...' : 'Conectando canal...'}</span>
                                            <span className="text-[11px] text-slate-500 mt-1">{isWhatsapp ? 'Sincronizando com WhatsApp' : 'Validando token e sincronizando webhook'}</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center text-slate-500">
                                            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-3">
                                                <WifiOff size={28} className="opacity-40" />
                                            </div>
                                            <span className="text-sm font-medium">Desconectado</span>
                                            <span className="text-[11px] text-slate-600 mt-1">{isWhatsapp ? 'Clique em "Conectar" para gerar QR Code' : 'Clique em "Conectar" para validar o bot e registrar o webhook'}</span>
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
                                            title={isWhatsapp ? 'Gerar novo QR Code' : 'Tentar novamente'}
                                        >
                                            <RefreshCw size={12} /> {isWhatsapp ? 'Novo QR' : 'Tentar novamente'}
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
                        {loadError ? <AlertTriangle size={48} className="mb-4 text-amber-300/80" /> : <Smartphone size={48} className="mb-4 opacity-50" />}
                        <p className="font-medium">{loadError ? 'Nao foi possivel carregar os canais' : 'Nenhum canal conectado'}</p>
                        <p className="text-sm mt-1">Adicione WhatsApp, Telegram, Instagram ou Email para começar.</p>
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
                                    <span>Canal: {getConnectionTypeLabel(settingsConnection.type)}</span>
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
                                <Settings size={18} /> Configuracoes
                            </button>
                            <button 
                                onClick={() => setActiveTab('test')} 
                                className={clsx("flex items-center gap-3 w-full p-3 rounded-lg text-sm font-medium transition-all mb-1", activeTab === 'test' ? "bg-emerald-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-slate-300")}
                            >
                                <MessageCircle size={18} /> {settingsConnection.type === 'TELEGRAM' ? 'Diagnostico' : 'Aba de Teste'}
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
                                            <span className="text-3xl font-black text-white">{Number(settingsConnection.config?.contactsCount ?? 0)}</span>
                                            <span className="text-xs text-slate-400 mt-1 uppercase font-bold tracking-wider">Contatos</span>
                                        </div>
                                        <div className="bg-slate-950 border border-slate-800 p-6 rounded-xl flex flex-col items-center justify-center text-center">
                                            <MessageCircle size={32} className="text-slate-600 mb-3" />
                                            <span className="text-3xl font-black text-white">{Number(settingsConnection.config?.chatsCount ?? 0)}</span>
                                            <span className="text-xs text-slate-400 mt-1 uppercase font-bold tracking-wider">Chats</span>
                                        </div>
                                        <div className="bg-slate-950 border border-slate-800 p-6 rounded-xl flex flex-col items-center justify-center text-center">
                                            <Shield size={32} className="text-slate-600 mb-3" />
                                            <span className="text-3xl font-black text-white">{Number(settingsConnection.config?.messagesCount ?? 0)}</span>
                                            <span className="text-xs text-slate-400 mt-1 uppercase font-bold tracking-wider">Mensagens</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'configurations' && (
                                <div className="space-y-6 animate-in fade-in max-w-2xl">
                                    <h2 className="text-xl font-bold text-white mb-6">
                                        {settingsConnection.type === 'TELEGRAM' ? 'Configuracoes do Telegram' : 'Device Configurations'}
                                    </h2>
                                    
                                    <div className="space-y-4">
                                        {settingsConnection.type === 'TELEGRAM' && (
                                            <>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-400 mb-2">Bot Token</label>
                                                    <input 
                                                        id="telegramBotTokenInput"
                                                        type="password"
                                                        defaultValue={settingsConnection.config?.botToken || ''}
                                                        placeholder="123456789:AA..."
                                                        className="w-full bg-slate-950 border border-slate-800 p-3 rounded-lg text-sm text-white focus:border-indigo-500 outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-400 mb-2">Webhook Base URL</label>
                                                    <input 
                                                        id="telegramWebhookBaseUrlInput"
                                                        type="text"
                                                        defaultValue={settingsConnection.config?.webhookBaseUrl || ''}
                                                        placeholder="https://seu-dominio.com"
                                                        className="w-full bg-slate-950 border border-slate-800 p-3 rounded-lg text-sm text-white focus:border-indigo-500 outline-none"
                                                    />
                                                    <p className="text-[10px] text-slate-500 mt-1">
                                                        Use uma URL publica em HTTPS. URLs locais ou privadas falham no Telegram.
                                                    </p>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-400 mb-2">Webhook registrado</label>
                                                    <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-sm text-slate-300 font-mono break-all">
                                                        {settingsConnection.config?.webhookUrl || 'Ainda nao sincronizado'}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                        {settingsConnection.type !== 'TELEGRAM' && <div>
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
                                        </div>}
                                        
                                        {settingsConnection.type !== 'TELEGRAM' && <div>
                                            <label className="block text-xs font-bold text-slate-400 mb-2">Webhook URL Global</label>
                                            <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-sm text-slate-300 font-mono">
                                                {window.location.origin.replace('5173', '3000')}/api/evolution/webhook
                                            </div>
                                        </div>}
                                        
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
                                        {settingsConnection.type === 'TELEGRAM'
                                            ? 'Use este painel para acompanhar eventos do webhook do Telegram. Para testar o canal, envie uma mensagem diretamente ao bot.'
                                            : 'Utilize esta ferramenta para forcar o envio a partir da instancia DR.X e receber instantaneamente os webhooks gerados de qualquer mensagem recebida no seu celular.'}
                                    </p>
                                    
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
                                        
                                        {/* Painel de Envio */}
                                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 flex flex-col h-full">
                                            <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider">�x� Enviar Mensagem</h3>
                                            {settingsConnection.type === 'TELEGRAM' ? (
                                                <div className="space-y-4 text-sm text-slate-300">
                                                    <p>O Telegram nao usa disparo de teste local nem QR Code.</p>
                                                    <p>Para validar o canal, envie uma mensagem diretamente ao bot e acompanhe os eventos recebidos ao lado.</p>
                                                    <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-4 text-xs text-sky-100">
                                                        <div>Bot: @{settingsConnection.config?.botUsername || 'nao identificado'}</div>
                                                        <div className="mt-1 break-all">Webhook: {settingsConnection.config?.webhookUrl || 'nao sincronizado'}</div>
                                                    </div>
                                                </div>
                                            ) : (
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
                                            )}
                                        </div>

                                        {/* Painel de Recepção (Log) */}
                                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-0 flex flex-col h-full overflow-hidden">
                                            <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">�x� Webhoook Listener</h3>
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




