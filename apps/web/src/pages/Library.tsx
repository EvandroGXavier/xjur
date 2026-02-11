
import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    FileText, Plus, Search, Trash2, 
    BookOpen, Archive, Save, ArrowLeft 
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../services/api';
import { RichTextEditor } from '../components/ui/RichTextEditor';
import { clsx } from 'clsx';

interface Template {
    id: string;
    title: string;
    content: string;
    categoryId?: string;
    updatedAt: string;
}

interface DocumentHistory {
    id: string;
    title: string;
    status: string;
    createdAt: string;
}

export function Library() {
    const [activeTab, setActiveTab] = useState<'TEMPLATES' | 'HISTORY'>('TEMPLATES');
    const [templates, setTemplates] = useState<Template[]>([]);
    const [history, setHistory] = useState<DocumentHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Editor State
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
    const [editorContent, setEditorContent] = useState('');
    const [editorTitle, setEditorTitle] = useState('');

    useEffect(() => {
        const controller = new AbortController();
        fetchData(controller.signal);
        return () => controller.abort();
    }, [activeTab]);

    const fetchData = async (signal?: AbortSignal) => {
        setLoading(true);
        try {
            if (activeTab === 'TEMPLATES') {
                const res = await api.get('/documents/templates', { signal });
                setTemplates(res.data);
            } else {
                const res = await api.get('/documents', { signal }); // History
                setHistory(res.data);
            }
        } catch (err: any) {
            if (axios.isCancel(err)) return;
            console.error(err);
            toast.error('Erro ao carregar dados');
        } finally {
            setLoading(false);
        }
    };

    const handleNewTemplate = () => {
        setEditingTemplate(null);
        setEditorTitle('');
        setEditorContent('');
        setIsEditorOpen(true);
    };

    const handleEditTemplate = (tpl: Template) => {
        setEditingTemplate(tpl);
        setEditorTitle(tpl.title);
        setEditorContent(tpl.content);
        setIsEditorOpen(true);
    };

    const handleSaveTemplate = async () => {
        if (!editorTitle) {
            toast.warning('O título é obrigatório');
            return;
        }

        try {
            const payload = { title: editorTitle, content: editorContent };
            if (editingTemplate) {
                await api.put(`/documents/templates/${editingTemplate.id}`, payload);
                toast.success('Modelo atualizado!');
            } else {
                await api.post('/documents/templates', payload);
                toast.success('Modelo criado!');
            }
            setIsEditorOpen(false);
            fetchData();
        } catch (err) {
            console.error(err);
            toast.error('Erro ao salvar modelo');
        }
    };

    const handleDeleteTemplate = async (id: string) => {
        if (!confirm('Deseja excluir este modelo?')) return;
        try {
            await api.delete(`/documents/templates/${id}`);
            toast.success('Modelo excluído');
            fetchData();
        } catch (err) {
            toast.error('Erro ao excluir');
        }
    };

    if (isEditorOpen) {
        return (
            <div className="h-full flex flex-col bg-slate-950 animate-in fade-in slide-in-from-bottom-4">
                <div className="border-b border-slate-800 p-4 flex justify-between items-center bg-slate-900">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsEditorOpen(false)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition">
                            <ArrowLeft size={24} />
                        </button>
                        <div>
                            <input 
                                value={editorTitle}
                                onChange={e => setEditorTitle(e.target.value)}
                                placeholder="Título do Modelo (Ex: Procuração Ad Judicia)"
                                className="bg-transparent text-xl font-bold text-white focus:outline-none placeholder-slate-600 w-96"
                                autoFocus
                            />
                        </div>
                    </div>
                    <button 
                        onClick={handleSaveTemplate}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-2 transition"
                    >
                        <Save size={18} /> Salvar Modelo
                    </button>
                </div>
                <div className="flex-1 p-6 overflow-hidden">
                    <RichTextEditor 
                        value={editorContent} 
                        onChange={setEditorContent} 
                        showVariables={true} 
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-6 h-full flex flex-col bg-slate-950">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                     <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <BookOpen className="text-indigo-400" size={32} />
                        Biblioteca de Modelos
                    </h1>
                    <p className="text-slate-400 mt-1">Gerencie suas minutas, contratos e documentos padrão.</p>
                </div>
                <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                    <button 
                        onClick={() => setActiveTab('TEMPLATES')}
                        className={clsx("px-4 py-2 text-sm font-medium rounded-md transition", activeTab === 'TEMPLATES' ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-white")}
                    >
                        Modelos & Minutas
                    </button>
                    <button 
                        onClick={() => setActiveTab('HISTORY')}
                        className={clsx("px-4 py-2 text-sm font-medium rounded-md transition", activeTab === 'HISTORY' ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-white")}
                    >
                        Histórico Gerado
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex gap-4">
                <div className="relative flex-1 max-w-lg">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder={activeTab === 'TEMPLATES' ? "Buscar modelos..." : "Buscar documentos..."}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                </div>
                {activeTab === 'TEMPLATES' && (
                    <button onClick={handleNewTemplate} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg flex items-center gap-2 transition shadow-lg shadow-indigo-500/20">
                        <Plus size={20} /> Novo Modelo
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto pr-2">
                {activeTab === 'TEMPLATES' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {templates.map(tpl => (
                            <div key={tpl.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 group hover:border-indigo-500/50 transition cursor-pointer" onClick={() => handleEditTemplate(tpl)}>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition">
                                        <FileText size={24} /> 
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tpl.id); }} className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg" title="Excluir"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                                <h3 className="font-bold text-white text-lg mb-1 truncate">{tpl.title}</h3>
                                <p className="text-slate-500 text-sm">Atualizado em {new Date(tpl.updatedAt).toLocaleDateString()}</p>
                            </div>
                        ))}
                        {templates.length === 0 && !loading && (
                            <div className="col-span-full text-center py-20 text-slate-500">
                                <BookOpen size={48} className="mx-auto mb-4 opacity-20" />
                                <p>Nenhum modelo encontrado. Crie o primeiro!</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {history.map(doc => (
                            <div key={doc.id} className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex items-center justify-between hover:bg-slate-800/50 transition">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-slate-800 rounded text-slate-400"><Archive size={20} /></div>
                                    <div>
                                        <h4 className="font-medium text-white">{doc.title}</h4>
                                        <p className="text-xs text-slate-500">Criado em {new Date(doc.createdAt).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <span className={clsx("px-2 py-1 text-xs rounded border", doc.status === 'FINALIZED' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20")}>
                                    {doc.status === 'FINALIZED' ? 'Finalizado' : 'Rascunho'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
