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
    Edit3
} from 'lucide-react';
import { useHotkeys } from '../../hooks/useHotkeys';
import { DocumentGeneratorModal } from './DocumentGeneratorModal';
import { AttachmentPreview } from '../ui/AttachmentPreview';

interface TimelineItem {
    id: string;
    description: string;
    displayId?: string;
    internalSequence?: number;
    origin?: 'TRIBUNAL_PJE' | 'TRIBUNAL_EPROC' | 'INTERNO' | 'IA';
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
        category: 'REGISTRO',
        status: 'PENDENTE',
        priority: 'MEDIA',
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
            category: 'REGISTRO',
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
        // Basic validation for workflow categories
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

            // Send current attachments (excluding removed ones)
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
                    // Switch to edit mode so it doesn't duplicate on next save
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
            // Fetch existing to append attachments
            const existing = timelines.find(t => t.id === concludeItemId);
            if (existing && existing.metadata && existing.metadata.attachments) {
                // Keep existing attachments
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

// ... inside render form ...

                            <div className="border border-slate-800 rounded p-3 bg-slate-950/50">
                                <label className="block text-sm font-medium text-slate-400 mb-2">Anexar Documento</label>
                                <div className="flex items-center gap-2 mb-3">
                                         <input 
                                            type="file" 
                                            multiple
                                            onChange={e => {
                                                if (e.target.files) {
                                                    setSelectedFiles(e.target.files);
                                                }
                                            }}
                                            className="text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500"
                                        />
                                </div>
                                
                                {/* Existing Attachments List in Edit Mode */}
                                {attachments.length > 0 && (
                                    <div className="space-y-1">
                                        <p className="text-xs text-slate-500 font-medium mb-1">Anexos Atuais:</p>
                                        {attachments.map((att: any, idx: number) => (
                                            <div key={idx} className="flex items-center justify-between bg-slate-900 border border-slate-800 p-2 rounded">
                                                <div className="flex items-center gap-2 text-xs text-emerald-400 overflow-hidden">
                                                    <FileText size={12} className="shrink-0" />
                                                    <span className="truncate">{att.originalName}</span>
                                                </div>
                                                <button 
                                                    type="button"
                                                    onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                                                    className="text-slate-500 hover:text-red-500 p-1"
                                                    title="Remover anexo"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

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

    const handleGenerateDocSuccess = async (file: File) => {
        if (!targetTimelineId || !processId) return;
        
        setIsSaving(true);
        try {
            const data = new FormData();
            data.append('files', file);

            await api.patch(`/processes/${processId}/timelines/${targetTimelineId}`, data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            toast.success('Documento PDF gerado e anexado com sucesso!');
            setIsDocGenOpen(false);
            setTargetTimelineId(null);
            fetchTimelines();
        } catch (error) {
            console.error(error);
            toast.error('Erro ao salvar documento PDF.');
        } finally {
            setIsSaving(false);
        }
    };

    const getOriginBadge = (origin?: string) => {
        switch (origin) {
            case 'TRIBUNAL_PJE':
            case 'TRIBUNAL_EPROC':
                return <Badge variant="info">TRIBUNAL</Badge>;
            case 'INTERNO':
                return <Badge variant="warning">INTERNO</Badge>;
            case 'IA':
                return <Badge variant="success">IA DR.X</Badge>;
            default:
                return <Badge variant="default">Geral</Badge>;
        }
    };

      const filteredTimelines = timelines.filter(t => (t.category || 'REGISTRO') === activeTab);

      return (
          <div className="space-y-4 animate-in fade-in relative">
              {/* Header Actions */}
            <div className="flex flex-col gap-4 bg-slate-900/50 p-4 rounded-lg border border-slate-800">
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
                            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition"
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

                {/* Tabs */}
                <div className="flex gap-2 border-b border-slate-800">
                    {(['REGISTRO', 'ACAO', 'AGENDA'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === tab 
                                    ? 'border-indigo-500 text-indigo-400' 
                                    : 'border-transparent text-slate-500 hover:text-slate-300'
                            }`}
                        >
                            {tab === 'REGISTRO' ? 'Histórico Geral' : tab === 'ACAO' ? 'Ações & Tarefas' : 'Agenda & Prazos'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs bg-white text-slate-900 border-collapse">
                        <thead className="bg-[#f0f0f0] text-slate-700 font-bold border-b-2 border-slate-300">
                            <tr>
                                <th className="px-2 py-1 w-12 text-center border-r border-slate-200">#</th>
                                <th className="px-2 py-1 w-40 border-r border-slate-200">Data/Hora (REIFC)</th>
                                <th className="px-2 py-1 w-1/4 border-r border-slate-200">Evento / Responsável</th>
                                <th className="px-2 py-1 border-r border-slate-200">Descrição</th>
                                <th className="px-2 py-1 w-32 border-r border-slate-200">Rastreabilidade (CR)</th>
                                <th className="px-2 py-1 w-24 text-center">Docs</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="animate-pulse bg-white">
                                        <td colSpan={6} className="px-4 py-4 text-center">
                                            <div className="h-4 bg-slate-200 rounded w-full"></div>
                                        </td>
                                    </tr>
                                ))
                            ) : filteredTimelines.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                                        Nenhum andamento na aba atual.
                                    </td>
                                </tr>
                            ) : (
                                filteredTimelines.map((item, idx) => (
                                    <tr 
                                        key={item.id} 
                                        className={`hover:bg-yellow-50 transition-colors group ${
                                            idx % 2 === 0 ? 'bg-white' : 'bg-[#f8f9fa]'
                                        }`}
                                    >
                                        <td className="px-2 py-1.5 text-center font-mono text-slate-600 border-r border-slate-200 text-[11px] align-top">
                                            {item.internalSequence || timelines.length - idx}
                                        </td>
                                        <td className="px-2 py-1.5 border-r border-slate-200 text-slate-700 font-medium align-top">
                                            <div className="flex flex-col gap-0.5 text-[10px]">
                                                <div className="flex items-center gap-1 group/r" title="REGISTRO: Data em que o andamento foi inserido no sistema">
                                                    <span className="font-bold text-slate-400 w-3 cursor-help">R:</span>
                                                    <span>{formatDateDisplay(item.createdAt)}</span>
                                                </div>
                                                <div className="flex items-center gap-1 group/e" title="EVENTO: Data real do andamento no tribunal/órgão">
                                                    <span className="font-bold text-blue-500 w-3 cursor-help">E:</span>
                                                    <span>{formatDateDisplay(item.date)}</span>
                                                </div>
                                                <div className="flex items-center gap-1 group/i" title="INTERNA: Prazo interno definido pelo escritório">
                                                    <span className="font-bold text-amber-500 w-3 cursor-help">I:</span>
                                                    <span>{item.internalDate ? formatDateDisplay(item.internalDate) : '-'}</span>
                                                </div>
                                                <div className="flex items-center gap-1 group/f" title="FATAL: Prazo fatal (peremptório)">
                                                    <span className="font-bold text-red-500 w-3 cursor-help">F:</span>
                                                    <span>{item.fatalDate ? formatDateDisplay(item.fatalDate) : '-'}</span>
                                                </div>
                                                <div className="flex items-center gap-1 group/c" title="CONCLUSÃO: Data em que a tarefa foi concluída">
                                                    <span className="font-bold text-emerald-500 w-3 cursor-help">C:</span>
                                                    <span>{item.completedAt ? formatDateDisplay(item.completedAt) : '-'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-2 py-1.5 border-r border-slate-200 align-top">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-[#0056b3] text-sm hover:underline cursor-pointer" onClick={() => openEdit(item)}>
                                                    {item.title}
                                                </span>
                                                {item.displayId && (
                                                    <div className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-violet-700">
                                                        <span className="rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5">ID PJe</span>
                                                        <span className="font-mono">{item.displayId}</span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-500 italic">
                                                    <span className="font-bold">Resp:</span>
                                                    <span className="text-slate-800 font-medium truncate max-w-[150px]">{item.responsibleName || 'Não definido'}</span>
                                                </div>
                                                {/* Eproc style origin/type */}
                                                <div className="flex gap-1 mt-1 items-center flex-wrap">
                                                    {getOriginBadge(item.origin)}
                                                    {item.type && <span className="text-[10px] bg-slate-100 px-1 rounded border border-slate-200">{item.type}</span>}
                                                    {item.status === 'CONCLUIDO' && (
                                                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1 rounded border border-emerald-200 font-bold">CONCLUÍDO</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-2 py-1.5 border-r border-slate-200 text-slate-800 align-top max-w-[400px]">
                                            <div className="flex flex-col gap-1">
                                                <div className="text-[11px] text-slate-800 whitespace-pre-wrap leading-relaxed">
                                                    {item.description}
                                                </div>
                                                
                                                {/* Meta infos like Prazos */}
                                                {(item.internalDate || item.fatalDate) && (
                                                    <div className="flex gap-2 mt-1 bg-slate-50 p-1 rounded border border-slate-100 w-fit">
                                                         {item.internalDate && (
                                                            <div className="flex items-center gap-1 text-[10px] text-amber-600 font-semibold" title="Prazo Interno">
                                                                <Clock size={10} />
                                                                <span>Int: {format(new Date(item.internalDate), 'dd/MM/yy', { locale: ptBR })}</span>
                                                            </div>
                                                        )}
                                                        {item.fatalDate && (
                                                            <div className="flex items-center gap-1 text-[10px] text-red-600 font-bold" title="Prazo Fatal">
                                                                <AlertTriangle size={10} />
                                                                <span>Fatal: {format(new Date(item.fatalDate), 'dd/MM/yy', { locale: ptBR })}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Actions Row */}
                                                <div className="flex gap-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity items-center">
                                                    <button onClick={() => openEdit(item)} className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5 font-medium" title="Editar">
                                                        <Edit3 size={10} /> Editar
                                                    </button>
                                                    <button onClick={() => handleDelete(item.id)} className="text-[10px] text-red-600 hover:underline flex items-center gap-0.5 font-medium" title="Excluir">
                                                        <Trash2 size={10} /> Excluir
                                                    </button>
                                                    {item.clientMessage && (
                                                        <button onClick={() => handleSendWhatsapp(item)} className="text-[10px] text-emerald-600 hover:underline flex items-center gap-0.5 font-medium" title="Mensagem Cliente">
                                                            <MessageCircle size={10} /> Whats
                                                        </button>
                                                    )}
                                                    {activeTab === 'ACAO' && item.status !== 'CONCLUIDO' && (
                                                        <button 
                                                            onClick={async () => {
                                                                    setConcludeItemId(item.id);
                                                            }}
                                                            className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded shadow-sm hover:bg-emerald-600 font-bold"
                                                        >
                                                            Tratar / Concluir
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={() => {
                                                            setTargetTimelineId(item.id);
                                                            setIsDocGenOpen(true);
                                                        }}
                                                        className="text-[10px] bg-indigo-500 text-white px-2 py-0.5 rounded shadow-sm hover:bg-indigo-600 font-bold flex items-center gap-1 transition"
                                                        title="Gerar PDF Local"
                                                    >
                                                        <FileText size={10} /> PDF
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            setTargetTimelineId(item.id);
                                                            setIsDocGenM365Open(true);
                                                        }}
                                                        className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded shadow-sm hover:bg-blue-500 font-bold flex items-center gap-1 transition"
                                                        title="Gerar via Template M365 (Word Online)"
                                                    >
                                                        <FileText size={10} /> M365 (Word)
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-2 py-1.5 border-r border-slate-200 text-slate-600 text-[10px] align-top">
                                            <div className="flex flex-col gap-1.5">
                                                {item.displayId && (
                                                    <div className="flex flex-col gap-0.5 rounded border border-violet-100 bg-violet-50/70 p-1" title="Identificador do documento/expediente no tribunal">
                                                        <div className="flex items-center gap-1">
                                                            <span className="font-bold text-violet-500 w-3">D:</span>
                                                            <span className="text-violet-700 font-bold uppercase text-[9px]">Documento:</span>
                                                        </div>
                                                        <span className="pl-4 font-mono font-semibold text-violet-900">{item.displayId}</span>
                                                    </div>
                                                )}
                                                <div className="flex flex-col gap-0.5" title={`Criado em: ${formatDateDisplay(item.createdAt)}`}>
                                                    <div className="flex items-center gap-1">
                                                        <span className="font-bold text-slate-400 w-3">C:</span>
                                                        <span className="text-slate-500 font-bold uppercase text-[9px]">Criado por:</span>
                                                    </div>
                                                    <span className="pl-4 truncate font-medium text-slate-700">{item.requesterName || 'sistema'}</span>
                                                </div>
                                                {item.responsibleHistory && item.responsibleHistory.length > 0 && (
                                                    <div className="flex flex-col gap-0.5 mt-1 border-t border-slate-100 pt-1">
                                                        <div className="flex items-center gap-1" title="RESPONSÁVEIS ANTERIORES">
                                                            <span className="font-bold text-slate-400 w-3">R:</span>
                                                            <span className="text-slate-500 font-bold uppercase text-[9px]">Anterior para atual:</span>
                                                        </div>
                                                        <div className="max-h-[80px] overflow-y-auto space-y-1 pr-1 pl-4 scrollbar-thin scrollbar-thumb-slate-200">
                                                            {item.responsibleHistory.map((h, i) => (
                                                                <div key={i} className="flex flex-col border-b border-slate-50 last:border-0 pb-0.5" title={`Em: ${formatDateDisplay(h.date)}`}>
                                                                    <span className={clsx("truncate text-[10px]", i === item.responsibleHistory!.length - 1 ? 'font-bold text-blue-600' : 'text-slate-400')}>
                                                                        {i + 1}. {h.name}
                                                                    </span>
                                                                    <span className="text-[8px] text-slate-400">{formatDateDisplay(h.date).split(' ')[0]}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-2 py-1.5 text-left align-top min-w-[120px]">
                                            <div className="flex flex-col gap-1 items-start">
                                                {item.metadata?.attachments?.map((att: any, attIdx: number) => {
                                                    const docUrl = `${getApiUrl()}/processes/timelines/attachments/${encodeURIComponent(att.fileName)}`;
                                                    return (
                                                        <div key={attIdx} className="relative group/doc flex">
                                                            <AttachmentPreview url={docUrl} title={att.originalName}>
                                                                <a 
                                                                    href={docUrl} 
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-1.5 text-[11px] text-blue-600 hover:text-blue-800 hover:underline group/link py-0.5"
                                                                    title={att.originalName}
                                                                >
                                                                    <FileText size={14} className="text-blue-500 group-hover/link:text-blue-700" />
                                                                    <span className="truncate max-w-[140px]">{att.originalName}</span>
                                                                </a>
                                                            </AttachmentPreview>
                                                        </div>
                                                    );
                                                })}
                                                
                                                {item.origin === 'TRIBUNAL_EPROC' && (
                                                     <button className="text-[#0056b3] hover:text-blue-800 flex items-center gap-1.5" title="Ver no Eproc">
                                                        <FileText size={14} />
                                                        <span className="text-[11px] font-bold">HTML</span>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Concluir Ação */}
            {concludeItemId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
                        <div className="flex items-center gap-3 text-emerald-400">
                            <AlertTriangle size={24} />
                            <h3 className="text-lg font-bold text-white">Concluir Tarefa</h3>
                        </div>
                        
                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-4">
                            <p className="text-slate-300 text-sm">
                                Para concluir esta ação, você pode anexar o documento finalizado ou gerar um a partir do template.
                            </p>
                            
                            <div className="border border-slate-800 rounded p-3 bg-slate-900/50">
                                <label className="block text-sm font-medium text-slate-400 mb-2">1. Anexar Arquivo Final</label>
                                <input 
                                    type="file" 
                                    multiple
                                    onChange={e => {
                                        if (e.target.files) {
                                            setConcludeFiles(e.target.files);
                                        }
                                    }}
                                    className="text-xs text-slate-400 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 w-full"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-slate-500 text-xs font-bold uppercase">Ou</span>
                                <div className="h-px bg-slate-800 flex-1"></div>
                            </div>

                            <div className="border border-slate-800 rounded p-3 bg-slate-900/50">
                                <label className="block text-sm font-medium text-slate-400 mb-2">2. Gerar via Template M365</label>
                                <button className="w-full text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded font-medium border border-slate-700 transition flex items-center justify-center gap-2">
                                    <FileText size={14} className="text-blue-400" />
                                    Abrir Word Online (Em Breve)
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex justify-end gap-3 pt-2">
                            <button 
                                onClick={() => {
                                    setConcludeItemId(null);
                                    setConcludeFiles(null);
                                }}
                                className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition text-sm"
                            >
                                Cancelar (ESC)
                            </button>
                            <button 
                                onClick={handleConcludeAction}
                                disabled={isSaving}
                                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-2 transition shadow-lg shadow-emerald-900/20 text-sm disabled:opacity-50"
                            >
                                {isSaving ? 'Enviando...' : 'Confirmar Conclusão'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmação WhatsApp */}
            {selectedMessage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
                        <div className="flex items-center gap-3 text-emerald-400">
                            <MessageCircle size={24} />
                            <h3 className="text-lg font-bold text-white">Enviar Mensagem ao Cliente</h3>
                        </div>
                        
                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                            <p className="text-slate-300 text-sm whitespace-pre-wrap font-sans">
                                {selectedMessage.clientMessage}
                            </p>
                        </div>
                        
                        <div className="flex justify-end gap-3 pt-2">
                            <button 
                                onClick={() => setSelectedMessage(null)}
                                className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            >
                                Cancelar (ESC)
                            </button>
                            <button 
                                onClick={confirmSendWhatsapp}
                                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-2 transition shadow-lg shadow-emerald-900/20"
                            >
                                <Send size={16} />
                                Confirmar Envio
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de CRUD Andamento */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
                        <div className="flex items-center gap-3 text-white">
                            <FileText size={24} className="text-indigo-400" />
                            <h3 className="text-lg font-bold">
                                {editingItem ? 'Editar Andamento' : 'Novo Andamento Manual'}
                            </h3>
                        </div>

                        <form onSubmit={(e) => { e.preventDefault(); handleSave(true); }} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Título / Resumo</label>
                                <input 
                                    autoFocus
                                    type="text" 
                                    value={formData.title}
                                    onChange={e => setFormData({...formData, title: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white focus:border-indigo-500 outline-none"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Data do Evento</label>
                                    <input 
                                        type="datetime-local" 
                                        value={formData.date}
                                        onChange={e => setFormData({...formData, date: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white focus:border-indigo-500 outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Bucket (Aba)</label>
                                    <select 
                                        value={formData.category}
                                        onChange={e => setFormData({...formData, category: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white focus:border-indigo-500 outline-none"
                                    >
                                        <option value="REGISTRO">Histórico Geral (Registro)</option>
                                        <option value="ACAO">Ação & Tarefa</option>
                                        <option value="AGENDA">Agenda (Prazo)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-emerald-400 mb-1">Workflow Template</label>
                                    <select 
                                        value={formData.templateCode}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setFormData({...formData, templateCode: val, title: val === 'WF_NOVA_DEMANDA' ? 'Início: Demanda' : formData.title});
                                        }}
                                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white focus:border-emerald-500 outline-none"
                                        disabled={!!editingItem} // Cannot change template after creation
                                    >
                                        <option value="">Nenhum</option>
                                        <option value="WF_NOVA_DEMANDA">Nova Demanda (Gera 4 Andamentos)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Tipo</label>
                                    <select 
                                        value={formData.type}
                                        onChange={e => setFormData({...formData, type: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white focus:border-indigo-500 outline-none"
                                    >
                                        <option value="MOVEMENT">Movimentação</option>
                                        <option value="MESSAGE">Mensagem</option>
                                        <option value="FILE">Arquivo</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Descrição Detalhada</label>
                                    <textarea 
                                        value={formData.description}
                                        onChange={e => setFormData({...formData, description: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white focus:border-indigo-500 outline-none h-24 resize-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Responsável Atual</label>
                                    <input 
                                        type="text" 
                                        value={formData.responsibleName}
                                        onChange={e => setFormData({...formData, responsibleName: e.target.value})}
                                        placeholder="Nome do responsável..."
                                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white focus:border-indigo-500 outline-none h-24"
                                    />
                                </div>
                            </div>

                            <div className="border border-slate-800 rounded p-3 bg-slate-950/50">
                                <label className="block text-sm font-medium text-slate-400 mb-2">Anexar Documento</label>
                                <div className="flex items-center gap-2 mb-3">
                                         <input 
                                            type="file" 
                                            multiple
                                            onChange={e => {
                                                if (e.target.files) {
                                                    setSelectedFiles(e.target.files);
                                                }
                                            }}
                                            className="text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500"
                                        />
                                </div>
                                
                                {/* Existing Attachments List in Edit Mode */}
                                {attachments.length > 0 && (
                                    <div className="space-y-1">
                                        <p className="text-xs text-slate-500 font-medium mb-1">Anexos Atuais:</p>
                                        {attachments.map((att: any, idx: number) => (
                                            <div key={idx} className="flex items-center justify-between bg-slate-900 border border-slate-800 p-2 rounded">
                                                <div className="flex items-center gap-2 text-xs text-emerald-400 overflow-hidden">
                                                    <FileText size={12} className="shrink-0" />
                                                    <span className="truncate">{att.originalName}</span>
                                                </div>
                                                <button 
                                                    type="button"
                                                    onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                                                    className="text-slate-500 hover:text-red-500 p-1"
                                                    title="Remover anexo"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-4">
                                <div>
                                    <label className="block text-sm font-medium text-amber-500 mb-1">Prazo Interno</label>
                                    <input 
                                        type="datetime-local" 
                                        value={formData.internalDate}
                                        onChange={e => setFormData({...formData, internalDate: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white focus:border-amber-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-red-500 mb-1">Prazo Fatal</label>
                                    <input 
                                        type="datetime-local" 
                                        value={formData.fatalDate}
                                        onChange={e => setFormData({...formData, fatalDate: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white focus:border-red-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                                <button 
                                    type="button"
                                    onClick={resetForm}
                                    className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                >
                                    Cancelar (ESC)
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => handleSave(false)}
                                    disabled={isSaving}
                                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-lg shadow-blue-900/20 disabled:opacity-50"
                                >
                                    {isSaving ? 'Salvando...' : 'Salvar'}
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => handleSave(true)}
                                    disabled={isSaving}
                                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-900/20 disabled:opacity-50"
                                >
                                    {isSaving ? 'Salvando...' : 'Salvar e Sair'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isDocGenOpen && processContactId && (
                <DocumentGeneratorModal 
                    processId={processId}
                    contactId={processContactId}
                    mode="LOCAL"
                    onClose={() => {
                        setIsDocGenOpen(false);
                        setTargetTimelineId(null);
                    }}
                    onSuccess={handleGenerateDocSuccess}
                />
            )}

            {isDocGenM365Open && processContactId && (
                <DocumentGeneratorModal 
                    processId={processId}
                    contactId={processContactId}
                    mode="M365"
                    onClose={() => {
                        setIsDocGenM365Open(false);
                        setTargetTimelineId(null);
                    }}
                    onSuccess={() => {
                        setIsDocGenM365Open(false);
                        setTargetTimelineId(null);
                        // Optional: refresh timelines to see the new document if needed.
                        fetchTimelines();
                    }}
                />
            )}
        </div>
    );
}
