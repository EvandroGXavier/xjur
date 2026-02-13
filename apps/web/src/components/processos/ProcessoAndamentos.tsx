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
import { toast } from 'sonner';

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
    // Legacy fields
    title: string;
    type: string;
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

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        date: '',
        internalDate: '',
        fatalDate: '',
        type: 'MOVEMENT'
    });

    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            date: new Date().toISOString().slice(0, 16),
            internalDate: '',
            fatalDate: '',
            type: 'MOVEMENT'
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

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
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
            } else {
                await api.post(`/processes/${processId}/timelines`, data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                toast.success('Andamento criado!');
            }
            resetForm();
            fetchTimelines();
        } catch (error) {
            console.error(error);
            toast.error('Erro ao salvar andamento.');
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
            type: item.type
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

    const [previewDoc, setPreviewDoc] = useState<{ url: string; title: string; x: number; y: number } | null>(null);
    const [closeTimeout, setCloseTimeout] = useState<NodeJS.Timeout | null>(null);

    const handleMouseEnterDoc = (e: React.MouseEvent, url: string, title: string) => {
        if (closeTimeout) {
            clearTimeout(closeTimeout);
            setCloseTimeout(null);
        }
        
        const rect = (e.target as HTMLElement).closest('a')?.getBoundingClientRect();
        if (rect) {
            // Calculate best position
            const spaceRight = window.innerWidth - rect.right;
            const spaceBottom = window.innerHeight - rect.bottom;
            
            let x = rect.right + 10;
            let y = rect.top - 20;

            // If not enough space on right, show on left
            if (spaceRight < 620) {
                x = rect.left - 610;
            }
            
            // If not enough space on bottom, show slightly up
            if (spaceBottom < 720) {
                y = Math.max(10, window.innerHeight - 720);
            }

            setPreviewDoc({
                url,
                title,
                x,
                y
            });
        }
    };

    const handleMouseLeaveDoc = () => {
        const timeout = setTimeout(() => {
            setPreviewDoc(null);
        }, 300); // 300ms delay to allow moving to the popup
        setCloseTimeout(timeout);
    };

    const handleMouseEnterPreview = () => {
        if (closeTimeout) {
            clearTimeout(closeTimeout);
            setCloseTimeout(null);
        }
    };

    const handleMouseLeavePreview = () => {
        const timeout = setTimeout(() => {
             setPreviewDoc(null);
        }, 300);
        setCloseTimeout(timeout);
    };

    const formatDateDisplay = (dateStr?: string) => {
        if (!dateStr) return '-';
        try {
            return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="space-y-4 animate-in fade-in relative">
            {/* Document Preview Modal (Mini Browser) */}
            {previewDoc && (
                <div 
                    className="fixed z-[9999] bg-slate-800 border border-slate-600 rounded-lg shadow-2xl flex flex-col overflow-hidden w-[600px] h-[700px] animate-in fade-in zoom-in-95 duration-200"
                    style={{ top: previewDoc.y, left: previewDoc.x }}
                    onMouseEnter={handleMouseEnterPreview}
                    onMouseLeave={handleMouseLeavePreview}
                >
                    {/* Header */}
                    <div className="bg-slate-900 px-3 py-2 border-b border-slate-700 flex items-center justify-between handle cursor-move select-none">
                        <div className="flex items-center gap-2 text-slate-300">
                             <FileText size={14} className="text-indigo-400" />
                             <span className="text-xs font-medium truncate max-w-[350px]">{previewDoc.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                             <a 
                                href={previewDoc.url} 
                                target="_blank"
                                rel="noopener noreferrer" 
                                className="text-slate-400 hover:text-white"
                                title="Abrir em Nova Aba"
                            >
                                <span className="text-[10px] font-bold border border-slate-600 px-1 rounded hover:bg-slate-700">EXT</span>
                            </a>
                            <button 
                                onClick={() => setPreviewDoc(null)}
                                className="text-slate-400 hover:text-red-400 p-0.5 rounded hover:bg-slate-800 transition"
                            >
                                <span className="font-bold text-xs">✕</span>
                            </button>
                        </div>
                    </div>
                    {/* Content */}
                    <div className="flex-1 bg-white relative">
                        {/* We use an iframe to display PDF/images served by the backend */}
                         <iframe 
                            src={previewDoc.url} 
                            className="w-full h-full border-0 bg-slate-100"
                            title="Document Preview"
                        />
                    </div>
                </div>
            )}

            {/* Header Actions */}
            <div className="flex justify-between items-center bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-200">Andamentos & Prazos</h2>
                    <Badge variant="info">{timelines.length}</Badge>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => {
                            setEditingItem(null);
                            setFormData({
                                title: '',
                                description: '',
                                date: new Date().toISOString().slice(0, 16),
                                internalDate: '',
                                fatalDate: '',
                                type: 'MOVEMENT'
                            });
                            setIsFormOpen(true);
                        }}
                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition"
                    >
                        <Plus size={16} />
                        Novo Andamento
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

            {/* Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs bg-white text-slate-900 border-collapse">
                        <thead className="bg-[#f0f0f0] text-slate-700 font-bold border-b-2 border-slate-300">
                            <tr>
                                <th className="px-2 py-1 w-12 text-center border-r border-slate-200">#</th>
                                <th className="px-2 py-1 w-32 border-r border-slate-200">Data/Hora</th>
                                <th className="px-2 py-1 w-1/4 border-r border-slate-200">Evento</th>
                                <th className="px-2 py-1 border-r border-slate-200">Descrição</th>
                                <th className="px-2 py-1 w-24 border-r border-slate-200">Usuário</th>
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
                            ) : timelines.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                                        Nenhum andamento registrado.
                                    </td>
                                </tr>
                            ) : (
                                timelines.map((item, idx) => (
                                    <tr 
                                        key={item.id} 
                                        className={`hover:bg-yellow-50 transition-colors group ${
                                            idx % 2 === 0 ? 'bg-white' : 'bg-[#f8f9fa]'
                                        }`}
                                    >
                                        <td className="px-2 py-1.5 text-center font-mono text-slate-600 border-r border-slate-200 text-[11px] align-top">
                                            {item.internalSequence || timelines.length - idx}
                                        </td>
                                        <td className="px-2 py-1.5 border-r border-slate-200 text-slate-700 font-medium whitespace-nowrap align-top">
                                            {formatDateDisplay(item.date)}
                                        </td>
                                        <td className="px-2 py-1.5 border-r border-slate-200 align-top">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-[#0056b3] text-sm hover:underline cursor-pointer">
                                                    {item.title}
                                                </span>
                                                {/* Eproc style origin/type */}
                                                <div className="flex gap-1 mt-0.5">
                                                    {getOriginBadge(item.origin)}
                                                    {item.type && <span className="text-[10px] bg-slate-100 px-1 rounded border border-slate-200">{item.type}</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-2 py-1.5 border-r border-slate-200 text-slate-800 align-top">
                                            <div className="flex flex-col gap-1">
                                                <div dangerouslySetInnerHTML={{ __html: item.description || '' }} className="prose prose-sm max-w-none text-xs text-slate-800" />
                                                
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
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-2 py-1.5 border-r border-slate-200 text-slate-600 text-xs align-top">
                                            {item.metadata?.user || 'sistema'}
                                        </td>
                                        <td className="px-2 py-1.5 text-left align-top min-w-[120px]">
                                            <div className="flex flex-col gap-1 items-start">
                                                {item.metadata?.attachments?.map((att: any, attIdx: number) => {
                                                    const docUrl = `${getApiUrl()}/processes/timelines/attachments/${encodeURIComponent(att.fileName)}`;
                                                    return (
                                                        <div key={attIdx} className="relative group/doc">
                                                            <a 
                                                                href={docUrl} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-1.5 text-[11px] text-blue-600 hover:text-blue-800 hover:underline group/link py-0.5"
                                                                title={att.originalName}
                                                                    onMouseEnter={(e) => handleMouseEnterDoc(e, docUrl, att.originalName)}
                                                                onMouseLeave={handleMouseLeaveDoc}
                                                            >
                                                                <FileText size={14} className="text-blue-500 group-hover/link:text-blue-700" />
                                                                <span className="truncate max-w-[140px]">{att.originalName}</span>
                                                            </a>
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
                                Cancelar
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

                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Título / Resumo</label>
                                <input 
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
                            
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Descrição Detalhada</label>
                                <textarea 
                                    value={formData.description}
                                    onChange={e => setFormData({...formData, description: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white focus:border-indigo-500 outline-none h-24 resize-none"
                                />
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

                            <div className="flex justify-end gap-3 pt-4">
                                <button 
                                    type="button"
                                    onClick={resetForm}
                                    className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-900/20"
                                >
                                    Salvar Andamento
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
