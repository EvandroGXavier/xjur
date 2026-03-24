
import { useState, useEffect } from 'react';
import { Tags as TagsIcon, Plus, Trash2, Edit, Search, X, Palette, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { api } from '../../services/api';

interface Tag {
    id: string;
    name: string;
    color: string;
    textColor?: string;
    scope?: string[];
    usage: number;
    active: boolean;
}

const PRESET_COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
    '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
    '#64748b', '#d946ef', '#f43f5e', '#0ea5e9', '#a855f7',
];

const SCOPE_OPTIONS = [
    { value: 'CONTACT', label: 'Contato', color: 'text-blue-400' },
    { value: 'PROCESS', label: 'Processo', color: 'text-amber-400' },
    { value: 'FINANCE', label: 'Financeiro', color: 'text-emerald-400' },
    { value: 'TASK', label: 'Tarefa', color: 'text-pink-400' },
    { value: 'TICKET', label: 'Atendimento', color: 'text-indigo-400' },
];

export function TagsTab() {
    const [tags, setTags] = useState<Tag[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Form State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        color: '#6366f1',
        textColor: '#ffffff',
        scope: ['TICKET'] as string[],
    });

    useEffect(() => {
        fetchTags();
    }, []);

    const fetchTags = async () => {
        try {
            setLoading(true);
            const response = await api.get('/tags');
            setTags(Array.isArray(response.data) ? response.data : []);
        } catch (error: any) {
            console.error('[TAGS] Erro ao buscar etiquetas:', error);
            setTags([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.name.trim()) {
            toast.error('Nome da tag é obrigatório');
            return;
        }

        try {
            if (editingId) {
                await api.patch(`/tags/${editingId}`, formData);
                toast.success('Tag atualizada!');
            } else {
                await api.post('/tags', formData);
                toast.success('Tag criada!');
            }
            resetForm();
            await fetchTags();
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Erro ao salvar tag.';
            toast.error(msg);
        }
    };

    const handleEdit = (tag: Tag) => {
        setEditingId(tag.id);
        setFormData({
            name: tag.name,
            color: tag.color,
            textColor: tag.textColor || '#ffffff',
            scope: tag.scope || ['TICKET'],
        });
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir esta tag? Ela será removida de todos os registros.')) return;
        
        try {
            await api.delete(`/tags/${id}`);
            setTags(tags.filter(t => t.id !== id));
            toast.success('Tag excluída');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Erro ao excluir tag');
        }
    };

    const toggleScope = (scope: string) => {
        setFormData(prev => ({
            ...prev,
            scope: prev.scope.includes(scope) 
                ? prev.scope.filter(s => s !== scope) 
                : [...prev.scope, scope],
        }));
    };

    const resetForm = () => {
        setIsFormOpen(false);
        setEditingId(null);
        setFormData({ name: '', color: '#6366f1', textColor: '#ffffff', scope: ['TICKET'] });
    };

    const filteredTags = tags.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getContrastColor = (hex: string) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5 ? '#000000' : '#ffffff';
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Interno */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <TagsIcon className="text-pink-400" size={20} />
                        Gestão Global de Etiquetas
                    </h3>
                    <p className="text-slate-400 text-xs mt-1">
                        Defina tags que podem ser usadas em atendimentos, contatos, processos e tarefas.
                    </p>
                </div>
                <div className="flex gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input 
                            type="text"
                            placeholder="Buscar tags..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-pink-500 w-full md:w-48"
                        />
                    </div>
                    <button 
                        onClick={() => { resetForm(); setIsFormOpen(true); }}
                        className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition"
                    >
                        <Plus size={16} /> Nova Tag
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Form Sidebar */}
                {isFormOpen && (
                    <div className="lg:col-span-1 bg-slate-900 border border-pink-500/30 rounded-xl p-5 animate-in slide-in-from-left-4 h-fit sticky top-4">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                                {editingId ? 'Editar Tag' : 'Nova Tag'}
                            </h4>
                            <button onClick={resetForm} className="text-slate-400 hover:text-white">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome</label>
                                <input 
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-sm focus:border-pink-500 outline-none"
                                    placeholder="Ex: Urgente, VIP..."
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                                    <Palette size={12} /> Cor da Etiqueta
                                </label>
                                <div className="grid grid-cols-5 gap-2">
                                    {PRESET_COLORS.map(color => (
                                        <button
                                            key={color}
                                            onClick={() => setFormData({ ...formData, color, textColor: getContrastColor(color) })}
                                            className={clsx(
                                                "w-full aspect-square rounded-lg border-2 transition-all hover:scale-110 flex items-center justify-center",
                                                formData.color === color ? "border-white" : "border-transparent"
                                            )}
                                            style={{ backgroundColor: color }}
                                        >
                                            {formData.color === color && <Check size={14} style={{ color: getContrastColor(color) }} />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Permitir uso em:</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {SCOPE_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => toggleScope(opt.value)}
                                            className={clsx(
                                                "px-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all text-center",
                                                formData.scope.includes(opt.value)
                                                    ? "bg-slate-800 border-slate-600 text-white"
                                                    : "bg-slate-950 border-slate-800 text-slate-600 hover:text-slate-400"
                                            )}
                                        >
                                            <span className={clsx(formData.scope.includes(opt.value) && opt.color)}>
                                                {opt.label}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button 
                                    onClick={handleSave} 
                                    className="flex-1 bg-pink-600 hover:bg-pink-700 text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition"
                                >
                                    {editingId ? 'Salvar' : 'Criar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tags List */}
                <div className={clsx("grid grid-cols-1 sm:grid-cols-2 gap-3 h-fit", isFormOpen ? "lg:col-span-3" : "lg:col-span-4")}>
                    {filteredTags.map(tag => (
                        <div 
                            key={tag.id} 
                            className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition group flex flex-col gap-3"
                        >
                            <div className="flex justify-between items-start">
                                <span 
                                    className="px-3 py-1 rounded-full text-xs font-bold shadow-sm"
                                    style={{ backgroundColor: tag.color, color: tag.textColor || '#fff' }}
                                >
                                    {tag.name}
                                </span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEdit(tag)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors">
                                        <Edit size={14} />
                                    </button>
                                    <button onClick={() => handleDelete(tag.id)} className="p-1.5 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-slate-800/50 pt-2">
                                <div className="flex gap-1 flex-wrap">
                                    {(tag.scope || []).map(s => (
                                        <span key={s} className="text-[8px] px-1.5 py-0.5 bg-slate-950 text-slate-500 rounded border border-slate-800 font-bold uppercase tracking-tighter">
                                            {SCOPE_OPTIONS.find(o => o.value === s)?.label || s}
                                        </span>
                                    ))}
                                </div>
                                <span className="text-[10px] text-slate-600 font-medium">
                                    {tag.usage || 0} usos
                                </span>
                            </div>
                        </div>
                    ))}

                    {filteredTags.length === 0 && !loading && (
                        <div className="col-span-full text-center py-20 bg-slate-900/30 border-2 border-dashed border-slate-800 rounded-2xl">
                            <TagsIcon size={48} className="mx-auto mb-4 text-slate-700" />
                            <h4 className="text-slate-400 font-bold">Nenhuma etiqueta encontrada</h4>
                            <p className="text-slate-600 text-sm">Use o botão "Nova Tag" para começar.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

