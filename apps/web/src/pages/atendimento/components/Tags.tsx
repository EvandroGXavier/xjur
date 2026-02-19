
import { useState, useEffect } from 'react';
import { Tags as TagsIcon, Plus, Trash2, Edit, Search, X, Palette, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { api } from '../../../services/api';

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
];

export function TagsManager() {
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
        scope: ['CONTACT'] as string[],
    });

    useEffect(() => {
        fetchTags();
    }, []);

    const fetchTags = async () => {
        try {
            const response = await api.get('/tags');
            setTags(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Erro ao buscar etiquetas:', error);
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
                // Update
                try {
                    await api.patch(`/tags/${editingId}`, formData);
                } catch {
                    // Fallback local
                    setTags(tags.map(t => t.id === editingId ? { ...t, ...formData } : t));
                }
                toast.success('Tag atualizada!');
            } else {
                // Create
                try {
                    const res = await api.post('/tags', formData);
                    setTags([...tags, res.data]);
                } catch {
                    // Fallback local
                    const newTag: Tag = {
                        id: Math.random().toString(36).substr(2, 9),
                        ...formData,
                        usage: 0,
                        active: true,
                    };
                    setTags([...tags, newTag]);
                }
            }

            resetForm();
            await fetchTags();
            toast.success(editingId ? 'Tag atualizada!' : 'Tag criada!');
        } catch (error) {
            toast.error('Erro ao salvar tag');
        }
    };

    const handleEdit = (tag: Tag) => {
        setEditingId(tag.id);
        setFormData({
            name: tag.name,
            color: tag.color,
            textColor: tag.textColor || '#ffffff',
            scope: tag.scope || ['CONTACT'],
        });
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir esta tag? Ela será removida de todos os registros.')) return;
        
        try {
            await api.delete(`/tags/${id}`);
        } catch {
            // Fallback local
        }
        setTags(tags.filter(t => t.id !== id));
        toast.success('Tag excluída');
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
        setFormData({ name: '', color: '#6366f1', textColor: '#ffffff', scope: ['CONTACT'] });
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
        <div className="flex-1 flex flex-col bg-slate-950 p-6 md:p-8 animate-in fade-in zoom-in-95 duration-300 h-full overflow-hidden">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <TagsIcon className="text-pink-400" />
                        Etiquetas
                    </h2>
                    <p className="text-slate-400 mt-1">Organize atendimentos, contatos e processos com tags visuais.</p>
                </div>
                <div className="flex gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input 
                            type="text"
                            placeholder="Buscar tags..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-pink-500 w-full md:w-64"
                        />
                    </div>
                    <button 
                        onClick={() => { resetForm(); setIsFormOpen(true); }}
                        className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition shadow-lg shadow-pink-500/20"
                    >
                        <Plus size={16} /> Nova Tag
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden">
                
                {/* Form (Takes 1 column when open) */}
                {isFormOpen && (
                    <div className="bg-slate-900 border border-pink-500/30 rounded-xl p-6 animate-in slide-in-from-left-4 h-fit">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white">
                                {editingId ? 'Editar Tag' : 'Nova Tag'}
                            </h3>
                            <button onClick={resetForm} className="text-slate-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Name */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Nome da Tag</label>
                                <input 
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-pink-500"
                                    placeholder="Ex: VIP, Lead Quente..."
                                />
                            </div>

                            {/* Color Picker */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-2 flex items-center gap-1">
                                    <Palette size={14} /> Cor
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {PRESET_COLORS.map(color => (
                                        <button
                                            key={color}
                                            onClick={() => setFormData({ ...formData, color, textColor: getContrastColor(color) })}
                                            className={clsx(
                                                "w-8 h-8 rounded-lg border-2 transition-all hover:scale-110",
                                                formData.color === color ? "border-white scale-110 ring-2 ring-white/20" : "border-transparent"
                                            )}
                                            style={{ backgroundColor: color }}
                                        >
                                            {formData.color === color && <Check size={16} className="mx-auto" style={{ color: getContrastColor(color) }} />}
                                        </button>
                                    ))}
                                </div>
                                {/* Preview */}
                                <div className="mt-3 flex items-center gap-2">
                                    <span className="text-xs text-slate-500">Preview:</span>
                                    <span 
                                        className="px-3 py-1 rounded-full text-xs font-bold"
                                        style={{ backgroundColor: formData.color, color: formData.textColor }}
                                    >
                                        {formData.name || 'Tag'}
                                    </span>
                                </div>
                            </div>

                            {/* Scope */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-2">Escopo (onde usar)</label>
                                <div className="flex flex-wrap gap-2">
                                    {SCOPE_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => toggleScope(opt.value)}
                                            className={clsx(
                                                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                                                formData.scope.includes(opt.value)
                                                    ? "bg-slate-800 border-slate-600 text-white"
                                                    : "bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300"
                                            )}
                                        >
                                            <span className={clsx(formData.scope.includes(opt.value) && opt.color)}>
                                                {opt.label}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-2 pt-2">
                                <button onClick={resetForm} className="px-4 py-2 text-slate-400 hover:text-white text-sm">
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleSave} 
                                    className="bg-pink-600 hover:bg-pink-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition shadow-lg shadow-pink-500/20"
                                >
                                    {editingId ? 'Atualizar' : 'Criar Tag'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tags Grid */}
                <div className={clsx("overflow-y-auto custom-scrollbar", isFormOpen ? "lg:col-span-2" : "lg:col-span-3")}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredTags.map(tag => (
                            <div 
                                key={tag.id} 
                                className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-600 transition group"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <span 
                                        className="px-3 py-1 rounded-full text-xs font-bold"
                                        style={{ backgroundColor: tag.color, color: tag.textColor || '#fff' }}
                                    >
                                        {tag.name}
                                    </span>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleEdit(tag)} className="p-1 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded">
                                            <Edit size={14} />
                                        </button>
                                        <button onClick={() => handleDelete(tag.id)} className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex gap-1 flex-wrap">
                                        {(tag.scope || []).map(s => (
                                            <span key={s} className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded font-mono uppercase tracking-wider">
                                                {s === 'CONTACT' ? 'Cont.' : s === 'PROCESS' ? 'Proc.' : s === 'FINANCE' ? 'Fin.' : 'Task'}
                                            </span>
                                        ))}
                                    </div>
                                    <span className="text-[10px] text-slate-500">
                                        {tag.usage} uso{tag.usage !== 1 ? 's' : ''}
                                    </span>
                                </div>
                            </div>
                        ))}

                        {filteredTags.length === 0 && !loading && (
                            <div className="col-span-full text-center py-12 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/50">
                                <TagsIcon size={40} className="mx-auto mb-3 opacity-50" />
                                <p className="font-medium">Nenhuma tag encontrada</p>
                                <p className="text-sm mt-1">Crie tags para organizar seus atendimentos.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
