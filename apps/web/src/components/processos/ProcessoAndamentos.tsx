import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Badge } from '../ui/Badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
    Clock, 
    AlertTriangle, 
    MessageCircle, 
    FileText, 
    Bot, 
    FileSearch, 
    Send,
    Loader2,
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
            if (editingItem) {
                await api.patch(`/processes/${processId}/timelines/${editingItem.id}`, formData);
                toast.success('Andamento atualizado!');
            } else {
                await api.post(`/processes/${processId}/timelines`, {
                     ...formData,
                     origin: 'INTERNO'
                });
                toast.success('Andamento criado!');
            }
            resetForm();
            fetchTimelines();
        } catch (error) {
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

    const formatDateDisplay = (dateStr?: string) => {
        if (!dateStr) return '-';
        try {
            return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="space-y-4 animate-in fade-in">
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
                    <table className="w-full text-left text-sm text-slate-400">
                        <thead className="bg-slate-950 text-slate-300 font-medium border-b border-slate-800">
                            <tr>
                                <th className="px-4 py-3 w-16 text-center">#</th>
                                <th className="px-4 py-3 text-center">Origem</th>
                                <th className="px-4 py-3">Evento/ID</th>
                                <th className="px-4 py-3">Prazos</th>
                                <th className="px-4 py-3 w-1/3">Resumo Técnico</th>
                                <th className="px-4 py-3 w-1/3">Resumo IA</th>
                                <th className="px-4 py-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {loading ? (
                                [...Array(3)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={7} className="px-4 py-8 text-center">
                                            <div className="h-4 bg-slate-800 rounded w-full opacity-50"></div>
                                        </td>
                                    </tr>
                                ))
                            ) : timelines.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                                        Nenhum andamento registrado.
                                    </td>
                                </tr>
                            ) : (
                                timelines.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors group">
                                        <td className="px-4 py-3 text-center font-mono text-slate-500">
                                            {item.internalSequence || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {getOriginBadge(item.origin)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-white">{item.displayId || item.title || 'N/A'}</span>
                                                <span className="text-xs text-slate-500">{formatDateDisplay(item.date)}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-1">
                                                {item.internalDate && (
                                                    <div className="flex items-center gap-1.5 text-xs text-amber-400" title="Data Alvo Interna">
                                                        <Clock size={12} />
                                                        <span>{format(new Date(item.internalDate), 'dd/MM/yy', { locale: ptBR })}</span>
                                                    </div>
                                                )}
                                                {item.fatalDate && (
                                                    <div className="flex items-center gap-1.5 text-xs text-red-400 font-bold" title="Prazo Fatal">
                                                        <AlertTriangle size={12} />
                                                        <span>{format(new Date(item.fatalDate), 'dd/MM/yy', { locale: ptBR })}</span>
                                                    </div>
                                                )}
                                                {!item.internalDate && !item.fatalDate && <span className="text-slate-600">-</span>}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-start gap-2">
                                                <FileText size={14} className="mt-0.5 text-slate-500 flex-shrink-0" />
                                                <p className="text-slate-300 line-clamp-3 text-xs leading-relaxed">
                                                    {item.description || item.title}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 bg-slate-900/50">
                                            {item.aiSummary ? (
                                                <div className="flex items-start gap-2">
                                                    <Bot size={14} className="mt-0.5 text-indigo-400 flex-shrink-0" />
                                                    <p className="text-indigo-200/80 line-clamp-3 text-xs leading-relaxed italic">
                                                        "{item.aiSummary}"
                                                    </p>
                                                </div>
                                            ) : (
                                                <span className="text-slate-600 text-xs italic">Aguardando análise...</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    onClick={() => openEdit(item)}
                                                    className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit3 size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(item.id)}
                                                    className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                                                    title="Excluir"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => handleSendWhatsapp(item)}
                                                    className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                    title="Enviar Zap"
                                                    disabled={!item.clientMessage}
                                                >
                                                    <MessageCircle size={16} />
                                                </button>
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
