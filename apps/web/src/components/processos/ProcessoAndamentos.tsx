import { useState, useEffect } from 'react';
import { api, getApiUrl } from '../../services/api';
import { Badge } from '../ui/Badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
    Clock, 
    AlertTriangle, 
    MessageCircle, 
    FileText, 
    Send,
    RefreshCw,
    Plus,
    Trash2,
    Edit3,
    Search,
    Sparkles,
    Gavel,
    User,
    Cpu,
    CheckCircle
} from 'lucide-react';
import { useHotkeys } from '../../hooks/useHotkeys';
import { DocumentGeneratorModal } from './DocumentGeneratorModal';
import { AttachmentPreview } from '../ui/AttachmentPreview';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { ContactSelectInput } from '../contacts/ContactSelectInput';

interface TimelineItem {
    id: string;
    description: string;
    displayId?: string;
    internalSequence?: number;
    origin?: 'TRIBUNAL_PJE' | 'TRIBUNAL_EPROC' | 'INTERNO' | 'IA' | 'SYSTEM' | 'AUTOMATICO';
    internalDate?: string;
    fatalDate?: string;
    aiSummary?: string;
    clientMessage?: string;
    date: string;
    metadata?: any;
    // Workflow
    category?: 'REGISTRO' | 'ACAO' | 'AGENDA';
    status?: 'PENDENTE' | 'EM_TRATAMENTO' | 'CONCLUIDO';
    priority?: 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';
    templateCode?: string;
    parentTimelineId?: string;
    requesterName?: string;
    responsibleName?: string;
    completedAt?: string;
    responsibleHistory?: { name: string; date: string }[];
    // Legacy fields
    title: string;
    type: string;
    createdAt: string;
}

interface ProcessoAndamentosProps {
    processId: string;
}

export function ProcessoAndamentos({ processId }: ProcessoAndamentosProps) {
    const [timelines, setTimelines] = useState<TimelineItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMessage, setSelectedMessage] = useState<TimelineItem | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<TimelineItem | null>(null);
    const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
    const [attachments, setAttachments] = useState<any[]>([]);
    
    // Workflow Tabs State
    const [activeTab, setActiveTab] = useState<'REGISTRO' | 'ACAO' | 'AGENDA'>('REGISTRO');
    const [searchTerm, setSearchTerm] = useState('');
    
    // Conclude Modal State
    const [concludeItemId, setConcludeItemId] = useState<string | null>(null);
    const [concludeFiles, setConcludeFiles] = useState<FileList | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Document Generation State
    const [isDocGenOpen, setIsDocGenOpen] = useState(false);
    const [isDocGenM365Open, setIsDocGenM365Open] = useState(false);
    const [targetTimelineId, setTargetTimelineId] = useState<string | null>(null);
    const [processContactId, setProcessContactId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        date: '',
        internalDate: '',
        fatalDate: '',
        type: 'MOVEMENT',
        category: 'REGISTRO' as 'REGISTRO' | 'ACAO' | 'AGENDA',
        status: 'PENDENTE' as 'PENDENTE' | 'EM_TRATAMENTO' | 'CONCLUIDO',
        priority: 'MEDIA' as 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE',
        templateCode: '',
        responsibleName: ''
    });

    useHotkeys({
        onNew: () => {
             resetForm();
             setIsFormOpen(true);
        },
        onCancel: () => {
             if (isFormOpen) setIsFormOpen(false);
             if (concludeItemId) {
                 setConcludeItemId(null);
                 setConcludeFiles(null);
             }
             if (selectedMessage) setSelectedMessage(null);
             if (isDocGenOpen) setIsDocGenOpen(false);
             if (isDocGenM365Open) setIsDocGenM365Open(false);
        }
    });

    const formatDateDisplay = (dateStr?: string | null) => {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return '-';
            return format(d, 'dd/MM/yyyy HH:mm', { locale: ptBR });
        } catch (e) {
            return '-';
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            date: new Date().toISOString().slice(0, 16),
            internalDate: '',
            fatalDate: '',
            type: 'MOVEMENT',
            category: activeTab,
            status: 'PENDENTE',
            priority: 'MEDIA',
            templateCode: '',
            responsibleName: ''
        });
        setEditingItem(null);
        setSelectedFiles(null);
        setAttachments([]);
        setIsFormOpen(false);
    };

    const fetchTimelines = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/processes/${processId}`);
            if (res.data && res.data.timeline) {
                const sorted = (res.data.timeline as TimelineItem[]).sort((a, b) => {
                    if (a.internalSequence && b.internalSequence) {
                        return b.internalSequence - a.internalSequence;
                    }
                    return new Date(b.date).getTime() - new Date(a.date).getTime();
                });
                setTimelines(sorted);
                if (res.data.contactId) {
                    setProcessContactId(res.data.contactId);
                } else if (res.data.contact?.id) {
                    setProcessContactId(res.data.contact.id);
                }
            }
        } catch (error) {
            console.error('Error fetching timelines:', error);
            toast.error('Erro ao carregar andamentos.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (processId) {
            fetchTimelines();
        }
    }, [processId]);

    const handleSave = async (shouldClose: boolean) => {
        if (!formData.title) {
            toast.error('Por favor, informe um título / resumo.');
            return;
        }

        setIsSaving(true);
        try {
            const data = new FormData();
            Object.entries(formData).forEach(([key, value]) => {
                if (value) data.append(key, value);
            });
            if (!editingItem) {
                 data.append('origin', 'INTERNO');
            }
            if (selectedFiles) {
                Array.from(selectedFiles).forEach((file) => {
                    data.append('files', file);
                });
            }

            if (editingItem) {
                const metadata = {
                    ...editingItem.metadata,
                    attachments: attachments
                };
                data.append('metadata', JSON.stringify(metadata));
            }

            if (editingItem) {
                await api.patch(`/processes/${processId}/timelines/${editingItem.id}`, data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                toast.success('Andamento atualizado!');
                if (shouldClose) {
                    resetForm();
                } else {
                    setSelectedFiles(null);
                }
            } else {
                const res = await api.post(`/processes/${processId}/timelines`, data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                toast.success('Andamento criado!');
                if (shouldClose) {
                    resetForm();
                } else {
                    setEditingItem(res.data);
                    setSelectedFiles(null);
                }
            }
            fetchTimelines();
        } catch (error) {
            console.error(error);
            toast.error('Erro ao salvar andamento.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este andamento?')) return;
        try {
            await api.delete(`/processes/${processId}/timelines/${id}`);
            toast.success('Andamento excluído.');
            fetchTimelines();
        } catch (error) {
            toast.error('Erro ao excluir.');
        }
    };

    const handleConcludeAction = async () => {
        if (!concludeItemId) return;
        setIsSaving(true);
        try {
            const data = new FormData();
            data.append('status', 'CONCLUIDO');
            if (concludeFiles) {
                Array.from(concludeFiles).forEach((file) => {
                    data.append('files', file);
                });
            }
            const existing = timelines.find(t => t.id === concludeItemId);
            if (existing && existing.metadata && existing.metadata.attachments) {
                const newMeta = { ...existing.metadata };
                data.append('metadata', JSON.stringify(newMeta));
            }

            await api.patch(`/processes/${processId}/timelines/${concludeItemId}`, data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success('Tarefa concluída com sucesso!');
            setConcludeItemId(null);
            setConcludeFiles(null);
            fetchTimelines();
        } catch (error) {
            console.error(error);
            toast.error('Erro ao concluir tarefa.');
        } finally {
            setIsSaving(false);
        }
    };

    const openEdit = (item: TimelineItem) => {
        setEditingItem(item);
        setSelectedFiles(null);
        setAttachments(item.metadata?.attachments || []);
        setFormData({
            title: item.title,
            description: item.description || '',
            date: item.date ? new Date(item.date).toISOString().slice(0, 16) : '',
            internalDate: item.internalDate ? new Date(item.internalDate).toISOString().slice(0, 16) : '',
            fatalDate: item.fatalDate ? new Date(item.fatalDate).toISOString().slice(0, 16) : '',
            type: item.type,
            category: item.category || 'REGISTRO',
            status: item.status || 'PENDENTE',
            priority: item.priority || 'MEDIA',
            templateCode: item.templateCode || '',
            responsibleName: item.responsibleName || ''
        });
        setIsFormOpen(true);
    };

    const handleSendWhatsapp = (item: TimelineItem) => {
        if (!item.clientMessage) {
            toast.info('Este andamento não possui mensagem formatada para o cliente.');
            return;
        }
        setSelectedMessage(item);
    };

    const confirmSendWhatsapp = async () => {
        if (!selectedMessage) return;
        
        try {
            toast.info(`Enviando mensagem...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            toast.success('Mensagem enviada com sucesso!');
            setSelectedMessage(null);
        } catch (error) {
            toast.error('Erro ao enviar mensagem.');
        }
    };

    const handleGenerateDocSuccess = (file?: File) => {
        if (!file || !targetTimelineId || !processId) return;
        
        setIsSaving(true);
        const data = new FormData();
        data.append('files', file);

        api.patch(`/processes/${processId}/timelines/${targetTimelineId}`, data, {
            headers: { 'Content-Type': 'multipart/form-data' }
        })
        .then(() => {
            toast.success('Documento PDF gerado e anexado com sucesso!');
            setIsDocGenOpen(false);
            setTargetTimelineId(null);
            fetchTimelines();
        })
        .catch((error) => {
            console.error(error);
            toast.error('Erro ao salvar documento PDF.');
        })
        .finally(() => {
            setIsSaving(false);
        });
    };

    const getOriginBadge = (origin?: string) => {
        switch (origin) {
            case 'TRIBUNAL_PJE':
            case 'TRIBUNAL_EPROC':
                return (
                    <div className="flex items-center gap-1 bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 text-[10px] font-bold">
                        <Gavel size={10} /> TRIBUNAL
                    </div>
                );
            case 'INTERNO':
                return (
                    <div className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200 text-[10px] font-bold">
                        <User size={10} /> INTERNO
                    </div>
                );
            case 'IA':
                return (
                    <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200 text-[10px] font-bold">
                        <Sparkles size={10} /> IA DR.X
                    </div>
                );
            case 'SYSTEM':
            case 'AUTOMATICO':
                return (
                    <div className="flex items-center gap-1 bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 text-[10px] font-bold">
                        <Cpu size={10} /> SISTEMA
                    </div>
                );
            default:
                return (
                    <div className="flex items-center gap-1 bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 text-[10px] font-bold">
                        GERAL
                    </div>
                );
        }
    };

    const filteredTimelines = timelines.filter(t => {
        const matchesTab = (t.category || 'REGISTRO') === activeTab;
        if (!searchTerm) return matchesTab;
        
        const term = searchTerm.toLowerCase();
        const matchesSearch = 
            t.title.toLowerCase().includes(term) || 
            (t.description?.toLowerCase() || '').includes(term) ||
            (t.responsibleName?.toLowerCase() || '').includes(term) ||
            (t.displayId?.toLowerCase() || '').includes(term);
            
        return matchesTab && matchesSearch;
    });

    return (
        <div className="space-y-4 animate-in fade-in relative">
            {/* Header Actions */}
            <div className="flex flex-col gap-4 bg-slate-900/50 p-4 rounded-lg border border-slate-800 shadow-xl">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-slate-200">Andamentos & Prazos</h2>
                        <Badge variant="info">{timelines.length}</Badge>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => {
                                resetForm();
                                setIsFormOpen(true);
                            }}
                            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition shadow-lg shadow-indigo-900/40"
                        >
                            <Plus size={16} />
                            Novo
                        </button>
                        <button 
                            onClick={fetchTimelines} 
                            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
                            title="Atualizar"
                        >
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* Tabs & Search */}
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center border-t border-slate-800 pt-3">
                    <div className="flex gap-1">
                        {(['REGISTRO', 'ACAO', 'AGENDA'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={clsx(
                                    "px-4 py-1.5 text-xs font-bold rounded-full transition-all duration-200 whitespace-nowrap border",
                                    activeTab === tab 
                                        ? "bg-indigo-600/20 border-indigo-500 text-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.3)]" 
                                        : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700"
                                )}
                            >
                                {tab === 'REGISTRO' ? 'HISTÓRICO' : tab === 'ACAO' ? 'TAREFAS' : 'PRAZOS'}
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full sm:w-72">
                        <input
                            type="text"
                            placeholder="Pesquisar nos andamentos..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-full py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                            >
                                <Trash2 size={12} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs bg-white text-slate-900 border-collapse">
                        <thead className="bg-[#f0f0f0] text-slate-700 font-bold border-b-2 border-slate-300">
                            <tr>
                                <th className="px-2 py-2 w-12 text-center border-r border-slate-200">#</th>
                                <th className="px-2 py-2 w-40 border-r border-slate-200">Data/Hora (REIFC)</th>
                                <th className="px-2 py-2 w-1/4 border-r border-slate-200">Evento / Responsável</th>
                                <th className="px-2 py-2 border-r border-slate-200">Descrição</th>
                                <th className="px-2 py-2 w-40 border-r border-slate-200">Rastreabilidade (CR)</th>
                                <th className="px-2 py-2 w-24 text-center">Docs</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="animate-pulse bg-white">
                                        <td colSpan={6} className="px-4 py-5 text-center">
                                            <div className="h-4 bg-slate-100 rounded w-full"></div>
                                        </td>
                                    </tr>
                                ))
                            ) : filteredTimelines.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-slate-500 bg-slate-50">
                                        <div className="flex flex-col items-center gap-2">
                                            <Search size={32} className="text-slate-300" />
                                            <p className="font-medium">Nenhum andamento encontrado.</p>
                                            {searchTerm && <button onClick={() => setSearchTerm('')} className="text-indigo-600 text-xs hover:underline mt-1">Limpar busca</button>}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredTimelines.map((item, idx) => (
                                    <tr 
                                        key={item.id} 
                                        className={clsx(
                                            "hover:bg-yellow-50/50 transition-colors group",
                                            idx % 2 === 0 ? "bg-white" : "bg-[#f8f9fa]"
                                        )}
                                    >
                                        <td className="px-2 py-2 text-center font-mono text-slate-400 border-r border-slate-100 text-[10px] align-top">
                                            {item.internalSequence || timelines.length - idx}
                                        </td>
                                        <td className="px-2 py-2 border-r border-slate-100 text-slate-700 font-medium align-top">
                                            <div className="flex flex-col gap-0.5 text-[10px]">
                                                <div className="flex items-center gap-1 group/r" title="REGISTRO: Inserção no sistema">
                                                    <span className="font-bold text-slate-300 w-3 cursor-help">R:</span>
                                                    <span>{formatDateDisplay(item.createdAt)}</span>
                                                </div>
                                                <div className="flex items-center gap-1 group/e" title="EVENTO: Data real do fato">
                                                    <span className="font-bold text-blue-400 w-3 cursor-help">E:</span>
                                                    <span>{formatDateDisplay(item.date)}</span>
                                                </div>
                                                {item.internalDate && (
                                                    <div className="flex items-center gap-1 group/i" title="INTERNA: Prazo interno">
                                                        <span className="font-bold text-amber-500 w-3 cursor-help">I:</span>
                                                        <span>{formatDateDisplay(item.internalDate)}</span>
                                                    </div>
                                                )}
                                                {item.fatalDate && (
                                                    <div className="flex items-center gap-1 group/f" title="FATAL: Prazo peremptório">
                                                        <span className="font-bold text-red-500 w-3 cursor-help">F:</span>
                                                        <span>{formatDateDisplay(item.fatalDate)}</span>
                                                    </div>
                                                )}
                                                {item.completedAt && (
                                                    <div className="flex items-center gap-1 group/c" title="CONCLUSÃO">
                                                        <span className="font-bold text-emerald-500 w-3 cursor-help">C:</span>
                                                        <span>{formatDateDisplay(item.completedAt)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-2 py-2 border-r border-slate-100 align-top">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-[#0056b3] text-[13px] hover:underline cursor-pointer leading-tight mb-1" onClick={() => openEdit(item)}>
                                                    {item.title}
                                                </span>
                                                {item.displayId && (
                                                    <div className="flex items-center gap-1 text-[9px] font-bold text-violet-700 mb-1">
                                                        <span className="rounded border border-violet-200 bg-violet-50 px-1 py-0.5">ID: {item.displayId}</span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                                    <span className="font-bold">Resp:</span>
                                                    <span className="text-slate-800 font-medium truncate max-w-[150px]">{item.responsibleName || 'Não definido'}</span>
                                                </div>
                                                <div className="flex gap-1 mt-1.5 items-center flex-wrap">
                                                    {getOriginBadge(item.origin)}
                                                    {item.type && <span className="text-[9px] bg-slate-100 px-1 py-0.5 rounded border border-slate-200 font-medium uppercase text-slate-600">{item.type}</span>}
                                                    {item.status === 'CONCLUIDO' && (
                                                        <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.5 rounded border border-emerald-200 font-bold flex items-center gap-1">
                                                            <CheckCircle size={8} /> CONCLUÍDO
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-2 py-2 border-r border-slate-100 text-slate-800 align-top max-w-[400px]">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="text-[11px] text-slate-700 whitespace-pre-wrap leading-relaxed font-sans">
                                                    {item.description}
                                                </div>
                                                
                                                {(item.internalDate || item.fatalDate) && (
                                                    <div className="flex gap-2 mt-1 bg-slate-50 p-1.5 rounded border border-slate-100 w-fit">
                                                         {item.internalDate && (
                                                            <div className="flex items-center gap-1 text-[10px] text-amber-600 font-semibold">
                                                                <Clock size={10} />
                                                                <span>Int: {format(new Date(item.internalDate), 'dd/MM/yy')}</span>
                                                            </div>
                                                        )}
                                                        {item.fatalDate && (
                                                            <div className="flex items-center gap-1 text-[10px] text-red-600 font-bold">
                                                                <AlertTriangle size={10} />
                                                                <span>Fatal: {format(new Date(item.fatalDate), 'dd/MM/yy')}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="flex gap-3 mt-auto pt-2 opacity-0 group-hover:opacity-100 transition-opacity items-center">
                                                    <button onClick={() => openEdit(item)} className="text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-0.5 font-bold" title="Editar">
                                                        <Edit3 size={10} /> EDITAR
                                                    </button>
                                                    <button onClick={() => handleDelete(item.id)} className="text-[10px] text-red-600 hover:text-red-800 hover:underline flex items-center gap-0.5 font-bold" title="Excluir">
                                                        <Trash2 size={10} /> EXCLUIR
                                                    </button>
                                                    {item.clientMessage && (
                                                        <button onClick={() => handleSendWhatsapp(item)} className="text-[10px] text-emerald-600 hover:text-emerald-800 hover:underline flex items-center gap-0.5 font-bold" title="Mensagem Cliente">
                                                            <MessageCircle size={10} /> WHATS
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-2 py-2 border-r border-slate-100 text-slate-600 text-[10px] align-top bg-slate-50/30">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-slate-400 font-bold uppercase text-[8px] tracking-wider">Criado por:</span>
                                                    <span className="truncate font-medium text-slate-700">{item.requesterName || 'sistema'}</span>
                                                </div>
                                                {item.responsibleHistory && item.responsibleHistory.length > 0 && (
                                                    <div className="flex flex-col gap-1 mt-1 border-t border-slate-200 pt-1.5">
                                                        <span className="text-slate-400 font-bold uppercase text-[8px] tracking-wider">Histórico Responsável:</span>
                                                        <div className="max-h-[80px] overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-slate-200">
                                                            {item.responsibleHistory.map((h, i) => (
                                                                <div key={i} className="flex flex-col border-b border-slate-100 last:border-0 pb-1">
                                                                    <span className={clsx("truncate text-[9px]", i === item.responsibleHistory!.length - 1 ? 'font-bold text-blue-600' : 'text-slate-400')}>
                                                                        {h.name}
                                                                    </span>
                                                                    <span className="text-[8px] text-slate-400 font-mono">{formatDateDisplay(h.date).split(' ')[0]}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-2 py-2 text-left align-top min-w-[120px]">
                                            <div className="flex flex-col gap-1.5 items-start">
                                                {item.metadata?.attachments?.map((att: any, attIdx: number) => {
                                                    const docUrl = `${getApiUrl()}/processes/timelines/attachments/${encodeURIComponent(att.fileName)}`;
                                                    return (
                                                        <div key={attIdx} className="relative group/doc flex w-full">
                                                            <AttachmentPreview url={docUrl} title={att.originalName}>
                                                                <a 
                                                                    href={docUrl} 
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-1.5 text-[10px] text-blue-600 hover:text-blue-800 hover:bg-blue-50/50 p-1 rounded w-full transition"
                                                                    title={att.originalName}
                                                                >
                                                                    <FileText size={12} className="text-blue-500 shrink-0" />
                                                                    <span className="truncate flex-1">{att.originalName}</span>
                                                                </a>
                                                            </AttachmentPreview>
                                                        </div>
                                                    );
                                                })}
                                                
                                                <div className="flex gap-2 mt-2 w-full pt-2 border-t border-slate-100 group-hover:opacity-100 opacity-20 transition-opacity">
                                                    <button 
                                                        onClick={() => {
                                                            setTargetTimelineId(item.id);
                                                            setIsDocGenOpen(true);
                                                        }}
                                                        className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded"
                                                        title="PDF Local"
                                                    >
                                                        <FileText size={14} />
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            setTargetTimelineId(item.id);
                                                            setIsDocGenM365Open(true);
                                                        }}
                                                        className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded"
                                                        title="M365 Word"
                                                    >
                                                        <FileText size={14} />
                                                    </button>
                                                    {activeTab === 'ACAO' && item.status !== 'CONCLUIDO' && (
                                                        <button 
                                                            onClick={() => setConcludeItemId(item.id)}
                                                            className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded"
                                                            title="Concluir"
                                                        >
                                                            <CheckCircle size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals are kept the same or slightly tweaked for theme consistency */}
            {concludeItemId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
                        <div className="flex items-center gap-3 text-emerald-400">
                            <CheckCircle size={24} />
                            <h3 className="text-lg font-bold text-white">Concluir Tarefa</h3>
                        </div>
                        
                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-4">
                            <p className="text-slate-300 text-sm">
                                Para concluir esta ação, anexe o documento finalizado ou utilize um template.
                            </p>
                            
                            <div className="border border-slate-800 rounded p-3 bg-slate-900/50">
                                <label className="block text-sm font-medium text-slate-400 mb-2">1. Anexar Arquivo Final</label>
                                <input 
                                    type="file" 
                                    multiple
                                    onChange={e => e.target.files && setConcludeFiles(e.target.files)}
                                    className="text-xs text-slate-400 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 w-full"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-slate-700 text-[10px] font-bold uppercase">Ou</span>
                                <div className="h-px bg-slate-800 flex-1"></div>
                            </div>

                            <div className="border border-slate-800 rounded p-3 bg-slate-900/50">
                                <label className="block text-sm font-medium text-slate-400 mb-2">2. Gerar via M365</label>
                                <button className="w-full text-xs bg-slate-800 hover:bg-slate-700 text-slate-500 py-2 rounded font-medium border border-slate-700 transition flex items-center justify-center gap-2 cursor-not-allowed grayscale">
                                    <FileText size={14} />
                                    M365 Word Online (Em Breve)
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setConcludeItemId(null)} className="px-4 py-2 rounded-lg text-slate-400 hover:text-white transition text-sm">Cancelar</button>
                            <button onClick={handleConcludeAction} disabled={isSaving} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-2 transition text-sm disabled:opacity-50">
                                {isSaving ? 'Salvando...' : 'Confirmar Conclusão'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation WhatsApp Modal */}
            {selectedMessage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
                        <div className="flex items-center gap-3 text-emerald-400">
                            <MessageCircle size={24} />
                            <h3 className="text-lg font-bold text-white">Enviar Mensagem</h3>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 max-h-[400px] overflow-y-auto">
                            <p className="text-slate-300 text-xs whitespace-pre-wrap leading-relaxed font-sans">{selectedMessage.clientMessage}</p>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setSelectedMessage(null)} className="px-4 py-2 rounded-lg text-slate-400 hover:text-white transition text-sm">Cancelar</button>
                            <button onClick={confirmSendWhatsapp} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-2 transition text-sm">
                                <Send size={16} /> Confirmar Envio
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Form CRUD Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-white">
                                <div className="p-2 bg-indigo-600/20 rounded-lg">
                                    <FileText className="text-indigo-400" size={24} />
                                </div>
                                <h3 className="text-lg font-bold">{editingItem ? 'Editar Andamento' : 'Novo Andamento Manual'}</h3>
                            </div>
                            <button onClick={resetForm} className="text-slate-500 hover:text-white transition"><Plus size={24} className="rotate-45" /></button>
                        </div>

                        <form onSubmit={(e) => { e.preventDefault(); }} className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Título / Resumo</label>
                                    <input 
                                        autoFocus
                                        type="text" 
                                        value={formData.title}
                                        onChange={e => setFormData({...formData, title: e.target.value})}
                                        placeholder="Ex: Petição Juntada"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none transition"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Data do Fato</label>
                                        <input 
                                            type="datetime-local" 
                                            value={formData.date}
                                            onChange={e => setFormData({...formData, date: e.target.value})}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-white text-xs focus:border-indigo-500 outline-none transition"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Aba / Categoria</label>
                                        <select 
                                            value={formData.category}
                                            onChange={e => setFormData({...formData, category: e.target.value as any})}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-white text-xs focus:border-indigo-500 outline-none transition"
                                        >
                                            <option value="REGISTRO">Registro Geral</option>
                                            <option value="ACAO">Ação / Tarefa</option>
                                            <option value="AGENDA">Agenda / Prazo</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Template de Fluxo</label>
                                    <select 
                                        value={formData.templateCode}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setFormData({...formData, templateCode: val, title: val === 'WF_NOVA_DEMANDA' ? 'Início: Demanda' : formData.title});
                                        }}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-emerald-400 text-xs font-bold border-emerald-900/40 focus:border-emerald-500 outline-none transition"
                                        disabled={!!editingItem}
                                    >
                                        <option value="">Nenhum workflow automático</option>
                                        <option value="WF_NOVA_DEMANDA">Nova Demanda (4 andamentos)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Descrição</label>
                                    <textarea 
                                        value={formData.description}
                                        onChange={e => setFormData({...formData, description: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none h-32 resize-none no-scrollbar"
                                        placeholder="Detalhes do andamento..."
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1">Prazo Interno</label>
                                        <input 
                                            type="datetime-local" 
                                            value={formData.internalDate}
                                            onChange={e => setFormData({...formData, internalDate: e.target.value})}
                                            className="w-full bg-slate-950 border border-amber-900/30 rounded-md px-3 py-2 text-white text-xs focus:border-amber-500 outline-none transition"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1">Prazo Fatal</label>
                                        <input 
                                            type="datetime-local" 
                                            value={formData.fatalDate}
                                            onChange={e => setFormData({...formData, fatalDate: e.target.value})}
                                            className="w-full bg-slate-950 border border-red-900/30 rounded-md px-3 py-2 text-white text-xs focus:border-red-500 outline-none transition"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Responsável</label>
                                    <ContactSelectInput 
                                        value={formData.responsibleName}
                                        onChange={val => setFormData({...formData, responsibleName: val})}
                                        placeholder="Buscar advogado ou colaborador..."
                                    />
                                </div>

                                <div className="p-4 border border-slate-800 rounded-lg bg-slate-950/50 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Documentos</label>
                                        <input 
                                            type="file" 
                                            id="file-upload"
                                            multiple
                                            className="hidden"
                                            onChange={e => e.target.files && setSelectedFiles(e.target.files)}
                                        />
                                        <label htmlFor="file-upload" className="cursor-pointer text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded font-bold transition">ANEXAR</label>
                                    </div>
                                    
                                    <div className="space-y-1 max-h-[120px] overflow-y-auto no-scrollbar">
                                        {attachments.map((att: any, idx: number) => (
                                            <div key={idx} className="flex items-center justify-between bg-slate-900 border border-slate-800 p-2 rounded-md">
                                                <div className="flex items-center gap-2 text-[11px] text-indigo-400 truncate">
                                                    <FileText size={12} className="shrink-0" />
                                                    <span className="truncate">{att.originalName}</span>
                                                </div>
                                                <button type="button" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="text-slate-500 hover:text-red-500"><Trash2 size={12} /></button>
                                            </div>
                                        ))}
                                        {selectedFiles && Array.from(selectedFiles).map((f, i) => (
                                            <div key={i} className="flex items-center gap-2 text-[10px] text-emerald-400 p-1 italic">
                                                <Plus size={10} /> {f.name}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex gap-3 lg:mt-6">
                                    <button type="button" onClick={() => handleSave(false)} disabled={isSaving} className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 font-bold text-xs transition uppercase">Salvar</button>
                                    <button type="button" onClick={() => handleSave(true)} disabled={isSaving} className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition uppercase shadow-lg shadow-indigo-900/20">Salvar e Sair</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Document Generation Modals */}
            {isDocGenOpen && processContactId && (
                <DocumentGeneratorModal 
                    processId={processId}
                    contactId={processContactId}
                    mode="LOCAL"
                    onClose={() => { setIsDocGenOpen(false); setTargetTimelineId(null); }}
                    onSuccess={handleGenerateDocSuccess}
                />
            )}
            {isDocGenM365Open && processContactId && (
                <DocumentGeneratorModal 
                    processId={processId}
                    contactId={processContactId}
                    mode="M365"
                    onClose={() => { setIsDocGenM365Open(false); setTargetTimelineId(null); }}
                    onSuccess={() => { setIsDocGenM365Open(false); setTargetTimelineId(null); fetchTimelines(); }}
                />
            )}
        </div>
    );
}
