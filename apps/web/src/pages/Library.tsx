
import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    FileText, Plus, Search, Trash2, 
    BookOpen, Archive, Save, ArrowLeft, Tag as TagIcon, X, Settings2, Sparkles, RefreshCw, Shield
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../services/api';
import { RichTextEditor } from '../components/ui/RichTextEditor';
import { useHotkeys } from '../hooks/useHotkeys';
import { clsx } from 'clsx';
import { getUser } from '../auth/authStorage';

interface Category {
    id: string;
    name: string;
    parentId?: string | null;
}

interface Template {
    id: string;
    title: string;
    content: string;
    categoryId?: string | null;
    updatedAt: string;
    description?: string | null;
    tags?: any;
    globalTags?: any;
    tagIds?: any;
    preferredStorage?: string | null;
    metadata?: any;
    isSystemTemplate?: boolean;
    systemKey?: string | null;
    sourceTemplateId?: string | null;
}

interface GlobalTag {
    id: string;
    name: string;
    color: string;
    textColor?: string;
}

interface DocumentHistory {
    id: string;
    title: string;
    status: string;
    createdAt: string;
}

export function Library() {
    const isSuperAdmin = (() => {
        const baseEmails = ['evandro@conectionmg.com.br'];
        const envEmails = String((import.meta as any)?.env?.VITE_SUPERADMIN_EMAILS || '')
            .split(',')
            .map((x: string) => x.trim().toLowerCase())
            .filter(Boolean);
        const allowed = new Set([...baseEmails, ...envEmails].map((x) => x.toLowerCase()));
        const u = getUser();
        const email = String(u?.email || '').trim().toLowerCase();
        return Boolean(email && allowed.has(email));
    })();

    const [activeTab, setActiveTab] = useState<'TEMPLATES' | 'HISTORY'>('TEMPLATES');
    const [templates, setTemplates] = useState<Template[]>([]);
    const [history, setHistory] = useState<DocumentHistory[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Editor State
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
    const [editorContent, setEditorContent] = useState('');
    const [editorTitle, setEditorTitle] = useState('');
    const [editorDescription, setEditorDescription] = useState('');
    const [editorCategoryId, setEditorCategoryId] = useState('');
    const [editorPreferredStorage, setEditorPreferredStorage] = useState<'WORD_ONLINE' | 'GOOGLE_DOCS' | ''>('WORD_ONLINE');
    const [editorTags, setEditorTags] = useState<GlobalTag[]>([]);
    const [editorLegacyTags, setEditorLegacyTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [editorMode, setEditorMode] = useState<'TENANT' | 'SYSTEM'>('TENANT');
    const [editorSystemKey, setEditorSystemKey] = useState('');
    const [availableLibraryTags, setAvailableLibraryTags] = useState<GlobalTag[]>([]);
    const [loadingLibraryTags, setLoadingLibraryTags] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [editorMetadataText, setEditorMetadataText] = useState('');
    const [editorReadOnly, setEditorReadOnly] = useState(false);

    useHotkeys({
        onNew: () => handleNewTemplate(),
        onCancel: () => setIsEditorOpen(false)
    });

    useEffect(() => {
        const controller = new AbortController();
        fetchData(controller.signal);
        if (activeTab === 'TEMPLATES') {
            fetchCategories(controller.signal);
        }
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

    const fetchCategories = async (signal?: AbortSignal) => {
        try {
            const res = await api.get('/documents/categories', { signal });
            setCategories(res.data || []);
        } catch (err: any) {
            if (axios.isCancel(err)) return;
            console.error(err);
        }
    };

    const normalizeTags = (tags: any): string[] => {
        const list = Array.isArray(tags) ? tags : [];
        return list
            .map((t) => String(t || '').trim())
            .filter(Boolean)
            .slice(0, 30);
    };

    const normalizeGlobalTags = (tags: any): GlobalTag[] => {
        const list = Array.isArray(tags) ? tags : [];
        return list
            .map((t) => ({
                id: String(t?.id || '').trim(),
                name: String(t?.name || '').trim(),
                color: String(t?.color || '#6366f1').trim(),
                textColor: t?.textColor ? String(t.textColor) : undefined,
            }))
            .filter((t) => t.id && t.name)
            .slice(0, 30);
    };

    const fetchLibraryTags = async (signal?: AbortSignal) => {
        try {
            setLoadingLibraryTags(true);
            const res = await api.get('/tags?scope=LIBRARY', { signal });
            setAvailableLibraryTags(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingLibraryTags(false);
        }
    };

    useEffect(() => {
        if (!isEditorOpen) return;
        const controller = new AbortController();
        fetchLibraryTags(controller.signal);
        return () => controller.abort();
    }, [isEditorOpen]);

    const setEditorFromTemplate = (tpl: Template | null) => {
        setEditingTemplate(tpl);
        const isSystemTpl = Boolean(tpl?.isSystemTemplate);
        setEditorMode(isSystemTpl ? 'SYSTEM' : 'TENANT');
        setEditorSystemKey(tpl?.systemKey || '');
        setEditorReadOnly(isSystemTpl && !isSuperAdmin);
        setEditorTitle(tpl?.title || '');
        setEditorContent(tpl?.content || '');
        setEditorDescription(tpl?.description || '');
        setEditorCategoryId(tpl?.categoryId || '');
        setEditorPreferredStorage((tpl?.preferredStorage as any) || 'WORD_ONLINE');
        setEditorLegacyTags(normalizeTags(tpl?.tags));
        setEditorTags(normalizeGlobalTags((tpl as any)?.globalTags));
        setTagInput('');
        setShowAdvanced(false);
        setEditorMetadataText(tpl?.metadata ? JSON.stringify(tpl.metadata, null, 2) : '');
    };

    const handleNewTemplate = () => {
        setEditorFromTemplate(null);
        setEditorMode('TENANT');
        setEditorSystemKey('');
        setEditorPreferredStorage('WORD_ONLINE');
        setIsEditorOpen(true);
    };

    const handleNewSystemTemplate = () => {
        setEditorFromTemplate(null);
        setEditorMode('SYSTEM');
        setEditorSystemKey('');
        setEditorPreferredStorage('WORD_ONLINE');
        setEditorLegacyTags([]);
        setEditorTags([]);
        setEditorReadOnly(!isSuperAdmin);
        setIsEditorOpen(true);
    };

    const handleEditTemplate = (tpl: Template) => {
        setEditorFromTemplate(tpl);
        setIsEditorOpen(true);
    };

    const isTagSelected = (id: string) => editorTags.some((t) => t.id === id);

    const handleToggleTag = (tag: GlobalTag) => {
        setEditorTags((prev) => {
            if (prev.some((t) => t.id === tag.id)) {
                return prev.filter((t) => t.id !== tag.id);
            }
            return [...prev, tag].slice(0, 30);
        });
    };

    const handleRemoveTag = (tagId: string) => {
        setEditorTags((prev) => prev.filter((t) => t.id !== tagId));
    };

    const handleAddOrCreateTag = async (raw: string) => {
        const cleaned = raw.trim().replace(/^#/, '');
        if (!cleaned) return;

        const existing = availableLibraryTags.find((t) => t.name.toLowerCase() === cleaned.toLowerCase());
        if (existing) {
            handleToggleTag(existing);
            return;
        }

        try {
            const res = await api.post('/tags', {
                name: cleaned,
                scope: ['LIBRARY'],
            });
            const created: GlobalTag = res.data;
            setAvailableLibraryTags((prev) => [created, ...prev]);
            handleToggleTag(created);
        } catch (err) {
            console.error(err);
            toast.error('Erro ao criar tag global');
        }
    };

    const handleCreateCategory = async () => {
        const name = (prompt('Nome da categoria') || '').trim();
        if (!name) return;
        try {
            await api.post('/documents/categories', { name });
            toast.success('Categoria criada');
            fetchCategories();
        } catch (err) {
            console.error(err);
            toast.error('Erro ao criar categoria');
        }
    };

    const handleCustomizeSystemTemplate = async () => {
        if (!editingTemplate?.id) return;
        try {
            const res = await api.post(`/documents/templates/${editingTemplate.id}/customize`);
            toast.success('Modelo copiado para seu escritório');
            setEditorFromTemplate(res.data);
        } catch (err) {
            console.error(err);
            toast.error('Erro ao personalizar modelo do sistema');
        }
    };

    const handleCustomizeFromCard = async (tpl: Template) => {
        try {
            const res = await api.post(`/documents/templates/${tpl.id}/customize`);
            toast.success('Modelo copiado para seu escritório');
            // Abre diretamente a cópia editável
            setEditorFromTemplate(res.data);
            setIsEditorOpen(true);
            fetchData();
        } catch (err) {
            console.error(err);
            toast.error('Erro ao personalizar modelo do sistema');
        }
    };

    const handleSaveTemplate = async () => {
        if (editorReadOnly) {
            toast.warning('Modelos do sistema não podem ser editados. Use "Personalizar".');
            return;
        }
        if (!editorTitle) {
            toast.warning('O título é obrigatório');
            return;
        }

        try {
            let parsedMetadata: any = undefined;
            if (editorMetadataText.trim()) {
                try {
                    parsedMetadata = JSON.parse(editorMetadataText);
                } catch {
                    toast.error('Metadata (JSON) inválido');
                    return;
                }
            }

            const isSystemMode = editorMode === 'SYSTEM';

            if (isSystemMode) {
                if (!isSuperAdmin) {
                    toast.error('Acesso restrito ao SuperAdmin');
                    return;
                }
                if (!editingTemplate && !editorSystemKey.trim()) {
                    toast.warning('O System Key é obrigatório para criar um modelo do sistema');
                    return;
                }

                const payload: any = {
                    title: editorTitle,
                    content: editorContent,
                    description: editorDescription || undefined,
                    tags: normalizeTags(editorLegacyTags),
                    preferredStorage: editorPreferredStorage || undefined,
                    metadata: parsedMetadata,
                };

                if (editingTemplate?.id) {
                    await api.put(`/documents/system/templates/${editingTemplate.id}`, payload);
                    toast.success('Modelo do sistema atualizado!');
                } else {
                    await api.post('/documents/system/templates', {
                        ...payload,
                        systemKey: editorSystemKey.trim(),
                    });
                    toast.success('Modelo do sistema criado!');
                }

                setIsEditorOpen(false);
                fetchData();
                return;
            }

            const payload: any = {
                title: editorTitle,
                content: editorContent,
                categoryId: editorCategoryId || undefined,
                description: editorDescription || undefined,
                tagIds: editorTags.length ? editorTags.map((t) => t.id) : undefined,
                preferredStorage: editorPreferredStorage || undefined,
                metadata: parsedMetadata,
            };

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

    const handleDeleteSystemTemplate = async (id: string) => {
        if (!isSuperAdmin) return toast.error('Acesso restrito ao SuperAdmin');
        if (!confirm('Excluir modelo do sistema? Isso pode impactar outras empresas.')) return;
        try {
            await api.delete(`/documents/system/templates/${id}`);
            toast.success('Modelo do sistema excluído');
            fetchData();
        } catch (err: any) {
            console.error(err);
            toast.error(err?.response?.data?.message || 'Erro ao excluir modelo do sistema');
        }
    };

    const handleForceSyncSystemLibrary = async () => {
        if (!isSuperAdmin) return toast.error('Acesso restrito ao SuperAdmin');
        if (!confirm('Forçar sincronização do sistema irá SOBRESCREVER os modelos do sistema pelo código. Continuar?')) return;
        try {
            await api.post('/documents/system/sync?force=true');
            toast.success('Modelos do sistema sincronizados (force)');
            fetchData();
        } catch (err) {
            console.error(err);
            toast.error('Erro ao sincronizar modelos do sistema');
        }
    };

    const categoryNameById = (id?: string | null) => {
        if (!id) return '';
        const c = categories.find((x) => x.id === id);
        return c?.name || '';
    };

    const filteredTemplates = templates.filter((tpl) => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return true;
        const legacy = Array.isArray(tpl.tags) ? tpl.tags.join(' ') : '';
        const globals = Array.isArray((tpl as any).globalTags) ? (tpl as any).globalTags.map((t: any) => t?.name).join(' ') : '';
        const hay = `${tpl.title || ''} ${tpl.description || ''} ${legacy} ${globals}`.toLowerCase();
        return hay.includes(q);
    });

    const filteredHistory = history.filter((doc) => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return true;
        return (doc.title || '').toLowerCase().includes(q);
    });

    if (isEditorOpen) {
        const isSystem = editorMode === 'SYSTEM';
        const canEditSystem = isSystem && isSuperAdmin;
        let metadataPreview: any = null;
        let metadataPreviewError = false;
        if (editorMetadataText.trim()) {
            try {
                metadataPreview = JSON.parse(editorMetadataText);
            } catch {
                metadataPreviewError = true;
            }
        }
        const internalCommentsPreview = Array.isArray(metadataPreview?.internalComments)
            ? (metadataPreview.internalComments as any[]).map((x) => String(x)).filter(Boolean).slice(0, 20)
            : [];
        const sectionsPreview = Array.isArray(metadataPreview?.sections)
            ? (metadataPreview.sections as any[]).slice(0, 20)
            : [];
        return (
            <div className="h-full flex flex-col bg-slate-950 animate-in fade-in slide-in-from-bottom-4">
                <div className="border-b border-slate-800 p-4 flex justify-between items-center bg-slate-900 gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsEditorOpen(false)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition">
                            <ArrowLeft size={24} />
                        </button>
                        <div>
                            <input 
                                value={editorTitle}
                                onChange={e => setEditorTitle(e.target.value)}
                                placeholder="Título do Modelo (Ex: Procuração Ad Judicia)"
                                className={clsx(
                                    "bg-transparent text-xl font-bold text-white focus:outline-none placeholder-slate-600 w-96",
                                    editorReadOnly && "opacity-80"
                                )}
                                autoFocus
                                disabled={editorReadOnly}
                            />
                            <div className="flex items-center gap-2 mt-1">
                                {isSystem && (
                                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                        <Sparkles size={14} /> Modelo do Sistema
                                    </span>
                                )}
                                {!!editingTemplate?.sourceTemplateId && !isSystem && (
                                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                        Copiado do Sistema
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {isSystem ? (
                            <>
                                {canEditSystem && (
                                    <>
                                        {!!editingTemplate?.id && (
                                            <button
                                                onClick={() => handleDeleteSystemTemplate(editingTemplate.id)}
                                                className="px-4 py-2 bg-red-500/15 hover:bg-red-500/25 text-red-300 rounded-lg font-bold flex items-center gap-2 transition border border-red-500/20"
                                                title="Excluir modelo do sistema"
                                            >
                                                <Trash2 size={18} /> Excluir
                                            </button>
                                        )}
                                        <button
                                            onClick={handleSaveTemplate}
                                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-2 transition"
                                            title="Salvar alterações no modelo do sistema"
                                        >
                                            <Save size={18} /> Salvar (Sistema)
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={handleCustomizeSystemTemplate}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold flex items-center gap-2 transition border border-slate-700"
                                    title="Cria uma cópia editável para seu escritório"
                                >
                                    <Sparkles size={18} /> Personalizar
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={handleSaveTemplate}
                                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-2 transition"
                            >
                                <Save size={18} /> Salvar Modelo
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex-1 p-6 overflow-hidden flex flex-col gap-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
                            <div className="text-xs font-bold text-slate-300 flex items-center gap-2">
                                <Settings2 size={16} /> Informações
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {isSystem && (
                                    <div className="md:col-span-2">
                                        <label className="text-xs text-slate-400">System Key (identificador do modelo do sistema)</label>
                                        <input
                                            value={editorSystemKey}
                                            onChange={(e) => setEditorSystemKey(e.target.value)}
                                            disabled={Boolean(editingTemplate?.id) || !canEditSystem}
                                            placeholder="Ex: CHA_CONTRATO_HONORARIOS"
                                            className="w-full mt-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500 disabled:opacity-70"
                                        />
                                        <p className="text-[11px] text-slate-500 mt-1">
                                            Use um identificador único e estável. Depois de criado, não pode ser alterado aqui.
                                        </p>
                                    </div>
                                )}
                                <div>
                                    <label className="text-xs text-slate-400">Categoria</label>
                                    <div className="flex gap-2 mt-1">
                                        <select
                                            value={editorCategoryId}
                                            onChange={(e) => setEditorCategoryId(e.target.value)}
                                            disabled={editorReadOnly}
                                            className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="">Sem categoria</option>
                                            {categories.map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    {c.parentId ? `- ${c.name}` : c.name}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={handleCreateCategory}
                                            disabled={editorReadOnly}
                                            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded border border-slate-700 text-sm"
                                            title="Criar categoria"
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                    {!!editorCategoryId && (
                                        <div className="text-xs text-slate-500 mt-1">Selecionada: {categoryNameById(editorCategoryId)}</div>
                                    )}
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400">Armazenamento</label>
                                    <select
                                        value={editorPreferredStorage}
                                        onChange={(e) => setEditorPreferredStorage(e.target.value as any)}
                                        disabled={editorReadOnly}
                                        className="w-full mt-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="WORD_ONLINE">Word Online (Microsoft 365)</option>
                                        <option value="GOOGLE_DOCS">Google Docs (Workspace)</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-slate-400">Descrição (orientações jurídicas)</label>
                                <textarea
                                    value={editorDescription}
                                    onChange={(e) => setEditorDescription(e.target.value)}
                                    disabled={editorReadOnly}
                                    rows={3}
                                    placeholder="Ex: Baseado no Art. 319 do CPC..."
                                    className="w-full mt-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500"
                                />
                                {(internalCommentsPreview.length > 0 || sectionsPreview.length > 0 || metadataPreviewError) && (
                                    <div className="mt-3 space-y-2">
                                        {metadataPreviewError && (
                                            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">
                                                Metadata (JSON) invÃ¡lido: corrija no modo avanÃ§ado para visualizar comentÃ¡rios/seÃ§Ãµes.
                                            </div>
                                        )}
                                        {internalCommentsPreview.length > 0 && (
                                            <div className="bg-amber-500/10 border border-amber-500/20 rounded p-2">
                                                <div className="text-[11px] font-bold text-amber-300 mb-1">ComentÃ¡rios Internos</div>
                                                <ul className="list-disc pl-4 text-xs text-amber-200/90 space-y-1">
                                                    {internalCommentsPreview.map((c) => (
                                                        <li key={c}>{c}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {sectionsPreview.length > 0 && (
                                            <div className="bg-slate-950 border border-slate-700 rounded p-2">
                                                <div className="text-[11px] font-bold text-slate-300 mb-1">SeÃ§Ãµes / Ajuda</div>
                                                <div className="space-y-1">
                                                    {sectionsPreview.map((s: any, idx: number) => (
                                                        <div key={String(s?.title || idx)} className="text-xs text-slate-300">
                                                            <span className="font-bold">{String(s?.title || 'SeÃ§Ã£o')}</span>
                                                            {s?.help ? <span className="text-slate-500"> - {String(s.help)}</span> : null}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3 lg:col-span-2">
                            <div className="text-xs font-bold text-slate-300 flex items-center gap-2">
                                <TagIcon size={16} /> Tags / Categoria rápida
                            </div>
                            <div className="flex gap-2">
                                <input
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key !== 'Enter' && e.key !== ',') return;
                                        e.preventDefault();

                                        const parts = tagInput.split(',').map((x) => x.trim()).filter(Boolean);
                                        setTagInput('');
                                        if (!parts.length) return;

                                        if (isSystem) {
                                            if (!canEditSystem) return;
                                            setEditorLegacyTags((prev) => normalizeTags([...prev, ...parts]));
                                            return;
                                        }

                                        for (const part of parts) {
                                            void handleAddOrCreateTag(part);
                                        }
                                    }}
                                    disabled={isSystem ? !canEditSystem : false}
                                    placeholder={isSystem ? "Digite e pressione Enter (ex: Cível, CPC, Sistema)" : "Digite e pressione Enter (ex: Cível, CPC, Contrato)"}
                                    className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const parts = tagInput.split(',').map((x) => x.trim()).filter(Boolean);
                                        setTagInput('');
                                        if (!parts.length) return;

                                        if (isSystem) {
                                            if (!canEditSystem) return;
                                            setEditorLegacyTags((prev) => normalizeTags([...prev, ...parts]));
                                            return;
                                        }

                                        for (const part of parts) void handleAddOrCreateTag(part);
                                    }}
                                    disabled={isSystem ? !canEditSystem : false}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded border border-slate-700 text-sm"
                                >
                                    Adicionar
                                </button>
                            </div>
                            {!isSystem && (
                                <div className="flex flex-wrap gap-2">
                                    {(availableLibraryTags || [])
                                        .filter((t) => {
                                            const q = tagInput.trim().toLowerCase();
                                            if (!q) return true;
                                            return (t.name || '').toLowerCase().includes(q);
                                        })
                                        .slice(0, 14)
                                        .map((tag) => (
                                            <button
                                                key={tag.id}
                                                type="button"
                                                onClick={() => handleToggleTag(tag)}
                                                className={clsx(
                                                    "px-2 py-1 rounded-full text-xs font-bold border transition",
                                                    isTagSelected(tag.id)
                                                        ? "bg-slate-800 border-slate-600"
                                                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700",
                                                )}
                                                style={{
                                                    borderColor: `${tag.color}80`,
                                                    color: isTagSelected(tag.id) ? tag.color : undefined,
                                                }}
                                                title={isTagSelected(tag.id) ? 'Remover tag' : 'Adicionar tag'}
                                            >
                                                <span className="inline-flex items-center gap-2">
                                                    <span
                                                        className="w-2 h-2 rounded-full"
                                                        style={{ backgroundColor: tag.color }}
                                                    />
                                                    {tag.name}
                                                </span>
                                            </button>
                                        ))}
                                    {loadingLibraryTags && (
                                        <span className="text-xs text-slate-500">Carregando tags...</span>
                                    )}
                                </div>
                            )}
                            <div className="flex flex-wrap gap-2">
                                {isSystem &&
                                    editorLegacyTags.map((t) => (
                                        <span
                                            key={t}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-950 text-slate-300 border border-slate-700 text-xs"
                                        >
                                            #{t}
                                            {canEditSystem && (
                                                <button
                                                    type="button"
                                                    onClick={() => setEditorLegacyTags((prev) => prev.filter((x) => x !== t))}
                                                    className="ml-1 p-0.5 rounded hover:bg-white/10"
                                                    title="Remover"
                                                >
                                                    <X size={12} />
                                                </button>
                                            )}
                                        </span>
                                    ))}
                                {!isSystem &&
                                    editorTags.map((t) => (
                                        <span
                                            key={t.id}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs"
                                            style={{
                                                backgroundColor: `${t.color}20`,
                                                borderColor: `${t.color}55`,
                                                color: t.color,
                                            }}
                                        >
                                            {t.name}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveTag(t.id)}
                                                className="ml-1 p-0.5 rounded hover:bg-white/10"
                                                title="Remover"
                                            >
                                                <X size={12} />
                                            </button>
                                        </span>
                                    ))}
                                {!isSystem && editorTags.length === 0 && (
                                    <span className="text-xs text-slate-500">Sem tags.</span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowAdvanced((v) => !v)}
                                className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-2 mt-1"
                            >
                                <Settings2 size={14} /> {showAdvanced ? 'Ocultar' : 'Mostrar'} avançado (metadata/Visual Law)
                            </button>
                            {showAdvanced && (
                                <div className="mt-2">
                                    <label className="text-xs text-slate-400">Metadata (JSON)</label>
                                    <textarea
                                        value={editorMetadataText}
                                        onChange={(e) => setEditorMetadataText(e.target.value)}
                                        disabled={editorReadOnly}
                                        rows={7}
                                        placeholder='{\n  \"sections\": [{\"title\": \"Dos Fatos\", \"help\": \"Descreva o ocorrido.\"}],\n  \"internalComments\": [\"Verificar pedido de Justiça Gratuita\"]\n}'
                                        className="w-full mt-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <RichTextEditor 
                            value={editorContent} 
                            onChange={setEditorContent} 
                            showVariables={true}
                            readOnly={editorReadOnly}
                            className={editorReadOnly ? "opacity-95" : undefined}
                        />
                    </div>
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
                     <div className="flex gap-2">
                        {isSuperAdmin && (
                            <>
                                <button
                                    onClick={handleForceSyncSystemLibrary}
                                    className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg flex items-center gap-2 transition border border-slate-700"
                                    title="Sincroniza (force) os modelos do sistema a partir do código"
                                >
                                    <RefreshCw size={18} /> Sync Sistema
                                </button>
                                <button
                                    onClick={handleNewSystemTemplate}
                                    className="px-5 py-3 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 font-medium rounded-lg flex items-center gap-2 transition border border-amber-500/20"
                                    title="Criar novo modelo do sistema (SuperAdmin)"
                                >
                                    <Shield size={18} /> Novo Sistema
                                </button>
                            </>
                        )}
                        <button
                            onClick={handleNewTemplate}
                            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg flex items-center gap-2 transition shadow-lg shadow-indigo-500/20"
                        >
                            <Plus size={20} /> Novo Modelo
                        </button>
                     </div>
                 )}
             </div>

             {/* Content */}
             <div className="flex-1 overflow-y-auto pr-2">
                 {activeTab === 'TEMPLATES' ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredTemplates.map(tpl => (
                             <div key={tpl.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 group hover:border-indigo-500/50 transition cursor-pointer" onClick={() => handleEditTemplate(tpl)}>
                                 <div className="flex justify-between items-start mb-4">
                                     <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition">
                                         <FileText size={24} /> 
                                     </div>
                                     <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                                        {tpl.isSystemTemplate ? (
                                            <>
                                                {isSuperAdmin && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteSystemTemplate(tpl.id); }}
                                                        className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg"
                                                        title="Excluir (Sistema)"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleCustomizeFromCard(tpl); }}
                                                    className="px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-1 transition"
                                                    title="Criar uma cópia editável para seu escritório"
                                                >
                                                    <Sparkles size={14} /> Personalizar
                                                </button>
                                            </>
                                        ) : (
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tpl.id); }} className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg" title="Excluir"><Trash2 size={16} /></button>
                                        )}
                                     </div>
                                 </div>
                                 <h3 className="font-bold text-white text-lg mb-1 truncate">{tpl.title}</h3>
                                 {tpl.isSystemTemplate && (
                                    <div className="mb-2">
                                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                            <Sparkles size={14} /> Sistema
                                        </span>
                                    </div>
                                 )}
                                 {!tpl.isSystemTemplate && (
                                    <div className="mb-2">
                                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                            Escritório
                                        </span>
                                    </div>
                                 )}
                                 {!!tpl.description && (
                                    <p className="text-slate-400 text-sm line-clamp-2 mb-2">{tpl.description}</p>
                                 )}
                                 {Array.isArray((tpl as any).globalTags) && ((tpl as any).globalTags as any[]).length > 0 ? (
                                    <div className="flex flex-wrap gap-1 mb-2">
                                        {((tpl as any).globalTags as any[]).slice(0, 3).map((t) => (
                                            <span
                                                key={String(t?.id || t?.name)}
                                                className="text-[11px] px-2 py-0.5 rounded-full border"
                                                style={{
                                                    backgroundColor: `${String(t?.color || '#6366f1')}20`,
                                                    borderColor: `${String(t?.color || '#6366f1')}55`,
                                                    color: String(t?.color || '#6366f1'),
                                                }}
                                            >
                                                {String(t?.name || '')}
                                            </span>
                                        ))}
                                        {((tpl as any).globalTags as any[]).length > 3 && (
                                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                                                +{((tpl as any).globalTags as any[]).length - 3}
                                            </span>
                                        )}
                                    </div>
                                 ) : Array.isArray(tpl.tags) && (tpl.tags as any[]).length > 0 ? (
                                    <div className="flex flex-wrap gap-1 mb-2">
                                        {(tpl.tags as any[]).slice(0, 3).map((t) => (
                                            <span
                                                key={String(t)}
                                                className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                                            >
                                                #{String(t)}
                                            </span>
                                        ))}
                                        {(tpl.tags as any[]).length > 3 && (
                                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                                                +{(tpl.tags as any[]).length - 3}
                                            </span>
                                        )}
                                    </div>
                                 ) : null}
                                 {!!tpl.categoryId && (
                                    <p className="text-slate-500 text-xs mb-1">Categoria: {categoryNameById(tpl.categoryId) || '—'}</p>
                                 )}
                                 <p className="text-slate-500 text-sm">Atualizado em {new Date(tpl.updatedAt).toLocaleDateString()}</p>
                             </div>
                         ))}
                        {filteredTemplates.length === 0 && !loading && (
                             <div className="col-span-full text-center py-20 text-slate-500">
                                 <BookOpen size={48} className="mx-auto mb-4 opacity-20" />
                                 <p>{searchTerm ? 'Nenhum modelo encontrado para a busca.' : 'Nenhum modelo encontrado. Crie o primeiro!'}</p>
                             </div>
                         )}
                     </div>
                 ) : (
                     <div className="space-y-2">
                        {filteredHistory.map(doc => (
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
