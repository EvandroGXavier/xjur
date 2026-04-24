import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../../services/api';
import { ArrowLeft, ExternalLink, FileText, Loader2, Pencil, Plus, Save, Sparkles, Trash2, Printer, Download, MessageCircle, Archive, BookOpen, Book, Settings, Info, X } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { clsx } from 'clsx';
import { RichTextEditor, RichTextEditorHandle } from '../ui/RichTextEditor';
import { DocumentGeneratorModal } from './DocumentGeneratorModal';
import { embeddedContentColor } from '../../utils/themeColors';
import { useHotkeys } from '../../hooks/useHotkeys';

interface ProcessDocument {
    id: string;
    title: string;
    content: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    msFileUrl?: string | null;
    templateId?: string | null;
    processId?: string | null;
    timelineId?: string | null;
    template?: { id: string; title: string } | null;
}

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const buildRenderableDocumentHtml = (content?: string | null) => {
    const raw = String(content || '');
    if (!raw.trim()) {
        return '<p>&nbsp;</p>';
    }

    const hasHtml = /<[a-z][\s\S]*>/i.test(raw);
    if (!hasHtml) {
        return `<div class="document-print-root" style="white-space: pre-wrap;">${escapeHtml(raw)}</div>`;
    }

    // Replace empty paragraphs or paragraphs with only a BR with a non-breaking space
    // and ensure they have some content to maintain layout height
    return raw
        .replace(/<p>\s*<\/p>/gi, '<p>&nbsp;</p>')
        .replace(/<p>\s*<br\s*\/?>\s*<\/p>/gi, '<p>&nbsp;</p>')
        .replace(/<br\s*\/?>/gi, '<br />&nbsp;');
};

export function ProcessDocumentsTab({ processId }: { processId: string }) {
    const [loading, setLoading] = useState(true);
    const [documents, setDocuments] = useState<ProcessDocument[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    const [processContactId, setProcessContactId] = useState<string | null>(null);

    const [isDocGenOpen, setIsDocGenOpen] = useState(false);
    const [isDocGenM365Open, setIsDocGenM365Open] = useState(false);

    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingDoc, setEditingDoc] = useState<ProcessDocument | null>(null);
    const [editorTitle, setEditorTitle] = useState('');
    const [editorContent, setEditorContent] = useState('');
    const [saving, setSaving] = useState(false);
    const [variablesVisible, setVariablesVisible] = useState(false);

    const editorRef = useRef<RichTextEditorHandle>(null);

    // AI improvement
    const [aiInstruction, setAiInstruction] = useState(
        'Aprimore a redação jurídica (clareza, coesão, persuasão), corrija português, mantenha estrutura Visual Law e preserve o sentido. Retorne apenas HTML pronto para Word Online.',
    );
    const [aiLoading, setAiLoading] = useState(false);
    const [showAiConfig, setShowAiConfig] = useState(false);

    const fetchProcessContext = async (signal?: AbortSignal) => {
        try {
            const res = await api.get(`/processes/${processId}`, { signal });
            const parties = Array.isArray(res.data?.processParties) ? res.data.processParties : [];
            const clientParty = parties.find((p: any) => p?.isClient) || parties[0];
            const derivedContactId =
                clientParty?.contactId || clientParty?.contact?.id || res.data?.contactId || res.data?.contact?.id || null;
            setProcessContactId(derivedContactId ? String(derivedContactId) : null);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchDocuments = async (signal?: AbortSignal) => {
        try {
            const res = await api.get(`/documents?processId=${processId}`, { signal });
            setDocuments(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error(err);
            toast.error('Erro ao carregar documentos do processo');
            setDocuments([]);
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        Promise.all([fetchProcessContext(controller.signal), fetchDocuments(controller.signal)])
            .finally(() => setLoading(false));
        return () => controller.abort();
    }, [processId]);

    const filteredDocs = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return documents;
        return documents.filter((d) => `${d.title || ''} ${d.template?.title || ''}`.toLowerCase().includes(q));
    }, [documents, searchTerm]);

    const openEditor = (doc: ProcessDocument) => {
        setEditingDoc(doc);
        setEditorTitle(doc.title || '');
        setEditorContent(doc.content || '');
        setIsEditorOpen(true);
    };

    useHotkeys({
        onSave: () => {
            if (isEditorOpen) {
                handleSaveDoc(true);
            }
        }
    });

    const handleSaveDoc = async (stayOpen = false) => {
        if (!editingDoc?.id) return;
        if (!editorTitle.trim()) {
            toast.warning('Informe um título');
            return;
        }
        try {
            setSaving(true);
            await api.patch(`/documents/${editingDoc.id}`, {
                title: editorTitle,
                content: editorContent,
            });
            toast.success('Documento atualizado');
            if (!stayOpen) {
                setIsEditorOpen(false);
            }
            await fetchDocuments();
        } catch (err) {
            console.error(err);
            toast.error('Erro ao salvar documento');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteDoc = async (docId: string) => {
        if (!confirm('Excluir este documento do processo?')) return;
        try {
            await api.delete(`/documents/${docId}`);
            toast.success('Documento excluído');
            await fetchDocuments();
        } catch (err) {
            console.error(err);
            toast.error('Erro ao excluir documento');
        }
    };

    const improveAllWithAi = async () => {
        const html = String(editorContent || '').trim();
        if (!html) {
            toast.warning('Documento vazio');
            return;
        }
        try {
            setAiLoading(true);
            const res = await api.post('/documents/ai/improve', {
                html,
                mode: 'FULL',
                instruction: aiInstruction,
                processId,
            });
            const nextHtml = String(res.data?.html || '').trim();
            if (!nextHtml) {
                toast.error('IA não retornou conteúdo');
                return;
            }
            setEditorContent(nextHtml);
            toast.success('Documento aprimorado com IA');
        } catch (err) {
            console.error(err);
            toast.error('Erro ao aprimorar com IA');
        } finally {
            setAiLoading(false);
        }
    };

    const improveSelectionWithAi = async () => {
        const selectedHtml = editorRef.current?.getSelectionHtml() || '';
        if (!selectedHtml.trim()) {
            toast.warning('Selecione um trecho do texto');
            return;
        }
        try {
            setAiLoading(true);
            const res = await api.post('/documents/ai/improve', {
                html: selectedHtml,
                mode: 'SELECTION',
                instruction: aiInstruction,
                processId,
            });
            const nextHtml = String(res.data?.html || '').trim();
            if (!nextHtml) {
                toast.error('IA não retornou conteúdo');
                return;
            }
            editorRef.current?.replaceSelectionHtml(nextHtml);
            toast.success('Trecho aprimorado com IA');
        } catch (err) {
            console.error(err);
            toast.error('Erro ao aprimorar trecho com IA');
        } finally {
            setAiLoading(false);
        }
    };

    const handlePrint = (doc: ProcessDocument) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast.error('Por favor, permita pop-ups para imprimir.');
            return;
        }
        const printableHtml = buildRenderableDocumentHtml(doc.content);
        printWindow.document.write(`
            <html>
                <head>
                    <title>${doc.title}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20mm; margin: 0; color: ${embeddedContentColor.textStrong}; background: ${embeddedContentColor.surface}; }
                        .document-print-root { white-space: normal; }
                        .document-print-root p:empty::before { content: "\\00a0"; }
                        .document-print-root p { min-height: 1em; }
                        @media print { body { padding: 0; margin: 0; } }
                    </style>
                </head>
                <body>${printableHtml}</body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        
        // Timeout to allow images/fonts to load
        setTimeout(() => {
            printWindow.print();
        }, 500);
    };

    const handleSavePdf = async (doc: ProcessDocument) => {
        const element = document.createElement('div');
        element.innerHTML = `
            <style>
                body { font-family: 'Calibri', 'Arial', sans-serif; }
                p { margin: 0; min-height: 1.2em; line-height: 1.5; }
                p:empty::before { content: "\\00a0"; }
                .document-print-root p:empty::before { content: "\\00a0"; }
                .rich-text-table { width: 100%; border-collapse: collapse; margin: 1em 0; }
                .rich-text-table td, .rich-text-table th { border: 1px solid #cbd5e1; padding: 8px; }
            </style>
            <div class="document-print-root">
                ${buildRenderableDocumentHtml(doc.content)}
            </div>
        `;
        element.style.padding = '20mm';
        element.style.color = 'black';
        element.style.backgroundColor = 'white';
        element.style.width = '800px';

        const opt = {
            margin: 0,
            filename: `${(doc.title || 'Documento').replace(/\s+/g, '_')}_${Date.now()}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        } as const;

        const renderPromise = html2pdf().from(element).set(opt).save();
        toast.promise(renderPromise, {
            loading: 'Gerando PDF...',
            success: 'PDF salvo com sucesso!',
            error: 'Falha ao salvar PDF',
        });
    };

    const handleSendWhatsApp = (doc: ProcessDocument) => {
        // Create a plain text version for messaging, or just send a generic message 
        // asking the user to send the PDF.
        const tempObj = document.createElement('div');
        tempObj.innerHTML = doc.content || '';
        const plainText = tempObj.innerText.trim();
        
        const message = encodeURIComponent(`*${doc.title}*\n\n${plainText.substring(0, 1000)}...`);
        const waUrl = `https://wa.me/?text=${message}`;
        window.open(waUrl, '_blank');
        toast.info('Abrindo WhatsApp...');
    };

    if (loading) {
        return (
            <div className="p-8 flex justify-center">
                <Loader2 className="animate-spin text-indigo-500" size={32} />
            </div>
        );
    }

    if (isEditorOpen) {
        return (
            <div className="fixed inset-0 z-[110] flex flex-col bg-slate-950 animate-in fade-in zoom-in duration-300">
                {/* Background Decor */}
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 via-transparent to-emerald-500/5 pointer-events-none" />
                
                {/* Top Header - Slim & Premium */}
                <header className="relative z-20 h-16 shrink-0 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/60 px-6 flex items-center justify-between shadow-xl">
                    <div className="flex items-center gap-6 flex-1 max-w-5xl">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20 shadow-lg shadow-indigo-500/5">
                                <FileText size={20} />
                            </div>
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full uppercase tracking-tighter border border-indigo-500/30">Studio</span>
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Editor de Processo</span>
                                </div>
                                <input
                                    value={editorTitle}
                                    onChange={(e) => setEditorTitle(e.target.value)}
                                    placeholder="Título do Documento"
                                    className="bg-transparent border-0 text-xl font-black text-white focus:ring-0 outline-none w-full placeholder:text-slate-700 p-0"
                                    autoFocus
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {editingDoc?.msFileUrl && (
                            <button
                                onClick={() => window.open(String(editingDoc.msFileUrl), '_blank')}
                                className="px-4 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
                            >
                                <ExternalLink size={14} /> Word Online
                            </button>
                        )}
                        <div className="h-8 w-px bg-slate-800 mx-2" />
                        <button
                            onClick={() => setIsEditorOpen(false)}
                            className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-800 text-slate-500 hover:text-white hover:border-slate-700 transition-all"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </header>

                <div className="flex-1 flex overflow-hidden relative">
                    {/* Sidebar de Ações (Esquerda) */}
                    <aside className="w-16 shrink-0 flex flex-col items-center py-6 gap-6 border-r border-slate-900 bg-slate-950 z-20">
                        <div className="flex flex-col items-center gap-1 group">
                            <button
                                onClick={() => setIsEditorOpen(false)}
                                className="p-3 rounded-xl bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white transition-all shadow-lg border border-slate-800"
                                title="Voltar"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">Sair</span>
                        </div>

                        <div className="h-px w-8 bg-slate-900" />

                        <div className="flex flex-col items-center gap-1 group">
                            <button
                                onClick={() => handleSaveDoc(true)}
                                disabled={saving}
                                className="p-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                                title="Salvar e Continuar (Ctrl+S)"
                            >
                                {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                            </button>
                            <span className="text-[9px] font-bold text-indigo-400/70 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">Salvar</span>
                        </div>

                        <div className="flex flex-col items-center gap-1 group">
                            <button
                                onClick={() => handleSaveDoc(false)}
                                disabled={saving}
                                className="p-3 rounded-xl bg-slate-900 text-slate-400 hover:bg-indigo-600 hover:text-white transition-all shadow-lg border border-slate-800"
                                title="Salvar e Sair"
                            >
                                <Archive size={20} />
                            </button>
                            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">Arquivar</span>
                        </div>

                        <div className="flex flex-col items-center gap-1 group">
                            <button
                                onClick={() => setVariablesVisible(!variablesVisible)}
                                className={clsx(
                                    "p-3 rounded-xl transition-all shadow-lg border",
                                    variablesVisible 
                                        ? "bg-indigo-600 text-white border-indigo-500 shadow-indigo-500/20" 
                                        : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800"
                                )}
                                title="Dicionário de Variáveis"
                            >
                                <Book size={20} />
                            </button>
                            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">Dicionário</span>
                        </div>

                        <div className="flex flex-col items-center gap-1 group mt-auto">
                            <button
                                className="p-3 rounded-xl bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white transition-all shadow-lg border border-slate-800"
                                title="Ajuda"
                            >
                                <BookOpen size={20} />
                            </button>
                            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">Ajuda</span>
                        </div>
                    </aside>

                    {/* Main Area */}
                    <main className="flex-1 flex flex-col min-w-0 bg-slate-950 relative">
                        {/* AI & Quick Settings Bar */}
                        <div className="h-14 shrink-0 bg-slate-900/30 border-b border-slate-900/50 flex items-center px-6 justify-between gap-4">
                            <div className="flex items-center gap-4 flex-1">
                                <div className="flex items-center gap-2">
                                    <Sparkles size={16} className="text-violet-400" />
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Copiloto IA</span>
                                </div>
                                <div className="h-8 w-px bg-slate-800" />
                                <div className="flex-1 flex items-center gap-2">
                                    <input
                                        value={aiInstruction}
                                        onChange={(e) => setAiInstruction(e.target.value)}
                                        className="flex-1 bg-transparent border-0 text-xs text-slate-300 placeholder:text-slate-600 focus:ring-0 outline-none"
                                        placeholder="Instruções para a IA (ex: aprimorar redação, revisar coesão)..."
                                    />
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={improveSelectionWithAi}
                                            disabled={aiLoading}
                                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-[10px] font-bold text-slate-300 flex items-center gap-1.5 transition-all"
                                        >
                                            {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                            Trecho
                                        </button>
                                        <button
                                            onClick={improveAllWithAi}
                                            disabled={aiLoading}
                                            className="px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/20 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all"
                                        >
                                            {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                            Full Doc
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => setShowAiConfig(!showAiConfig)}
                                    className={clsx(
                                        "p-2 rounded-lg transition-all",
                                        showAiConfig ? "bg-indigo-500/20 text-indigo-400" : "text-slate-500 hover:text-slate-300"
                                    )}
                                >
                                    <Settings size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Editor Canvas */}
                        <div className="flex-1 overflow-hidden">
                            <RichTextEditor
                                ref={editorRef}
                                value={editorContent}
                                onChange={setEditorContent}
                                className="h-full"
                                showVariables={true}
                                variablesVisible={variablesVisible}
                                onToggleVariables={() => setVariablesVisible(!variablesVisible)}
                                minHeight={860}
                                placeholder="Edite aqui o documento do processo com qualidade de peça final."
                            />
                        </div>
                    </main>

                    {/* Right Panel - Config / AI Details */}
                    {showAiConfig && (
                        <aside className="w-80 shrink-0 border-l border-slate-900 bg-slate-950 flex flex-col animate-in slide-in-from-right duration-300">
                            <div className="p-6 border-b border-slate-900 flex items-center justify-between">
                                <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                                    <Info size={14} className="text-indigo-400" /> Detalhes do Documento
                                </h4>
                                <button onClick={() => setShowAiConfig(false)} className="text-slate-600 hover:text-white transition">
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Metadata</label>
                                    <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-4 space-y-3">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-500 font-medium">Modelo Original</span>
                                            <span className="text-slate-300 font-bold truncate max-w-[120px]">{editingDoc?.template?.title || 'Personalizado'}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-500 font-medium">Criado em</span>
                                            <span className="text-slate-300 font-bold">{editingDoc?.createdAt ? new Date(editingDoc.createdAt).toLocaleDateString() : '-'}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-500 font-medium">Processo ID</span>
                                            <span className="text-slate-300 font-mono text-[10px]">{processId}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Status de Operação</label>
                                    <div className="flex items-center gap-3 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-xs text-emerald-400 font-bold">Online & Pronto para salvar</span>
                                    </div>
                                </div>
                            </div>
                        </aside>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <FileText size={18} className="text-indigo-400" /> Documentos do Processo
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                        Modelos gerados/editáveis do processo. Documentos criados nos Andamentos também aparecem aqui.
                    </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por título/modelo..."
                        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:w-72 lg:w-80"
                    />
                    <button
                        onClick={() => {
                            if (!processContactId) {
                                toast.warning('Defina um Cliente Principal nas Partes do processo para gerar documentos.');
                                return;
                            }
                            setIsDocGenOpen(true);
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold inline-flex items-center gap-2"
                    >
                        <Plus size={16} /> Novo
                    </button>
                    <button
                        onClick={() => {
                            if (!processContactId) {
                                toast.warning('Defina um Cliente Principal nas Partes do processo para gerar documentos.');
                                return;
                            }
                            setIsDocGenM365Open(true);
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold inline-flex items-center gap-2"
                        title="Gera e abre no Word Online"
                    >
                        <ExternalLink size={16} /> Word
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredDocs.map((doc) => (
                    <div
                        key={doc.id}
                        className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition group"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-white font-bold truncate">{doc.title}</div>
                                <div className="text-[11px] text-slate-500 mt-1 truncate">
                                    {doc.template?.title ? `Modelo: ${doc.template.title}` : 'Documento'}
                                    {doc.timelineId ? ' • Andamento' : ''}
                                </div>
                            </div>
                            <div className="flex gap-1 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
                                {doc.msFileUrl && (
                                    <button
                                        onClick={() => window.open(String(doc.msFileUrl), '_blank')}
                                        className="p-2 hover:bg-blue-600/15 text-blue-300 rounded-lg"
                                        title="Abrir no Word Online"
                                    >
                                        <ExternalLink size={16} />
                                    </button>
                                )}
                                <button
                                    onClick={() => handleSavePdf(doc)}
                                    className="p-2 hover:bg-slate-800 text-slate-300 rounded-lg"
                                    title="Baixar PDF"
                                >
                                    <Download size={16} />
                                </button>
                                <button
                                    onClick={() => handlePrint(doc)}
                                    className="p-2 hover:bg-slate-800 text-slate-300 rounded-lg"
                                    title="Imprimir"
                                >
                                    <Printer size={16} />
                                </button>
                                <button
                                    onClick={() => handleSendWhatsApp(doc)}
                                    className="p-2 hover:bg-emerald-600/15 text-emerald-400 rounded-lg"
                                    title="Compartilhar no WhatsApp"
                                >
                                    <MessageCircle size={16} />
                                </button>
                                <button
                                    onClick={() => openEditor(doc)}
                                    className="p-2 hover:bg-slate-800 text-slate-300 rounded-lg"
                                    title="Editar"
                                >
                                    <Pencil size={16} />
                                </button>
                                <button
                                    onClick={() => handleDeleteDoc(doc.id)}
                                    className="p-2 hover:bg-red-600/15 text-red-300 rounded-lg"
                                    title="Excluir"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="mt-3 text-xs text-slate-500 flex items-center justify-between">
                            <span>Atualizado: {new Date(doc.updatedAt).toLocaleDateString('pt-BR')}</span>
                            <span className="px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-[10px] text-slate-400 font-bold">
                                {String(doc.status || 'DRAFT')}
                            </span>
                        </div>
                    </div>
                ))}

                {filteredDocs.length === 0 && (
                    <div className="col-span-full text-center py-16 bg-slate-900/30 border-2 border-dashed border-slate-800 rounded-2xl">
                        <FileText size={44} className="mx-auto mb-3 text-slate-700" />
                        <div className="text-slate-400 font-bold">Nenhum documento neste processo</div>
                        <div className="text-xs text-slate-600 mt-1">Clique em “Novo” para gerar um documento a partir da Biblioteca.</div>
                    </div>
                )}
            </div>

            {isDocGenOpen && processContactId && (
                <DocumentGeneratorModal
                    processId={processId}
                    contactId={processContactId}
                    mode="LOCAL"
                    generatePdf={false}
                    onClose={() => setIsDocGenOpen(false)}
                    onSuccess={async () => {
                        setIsDocGenOpen(false);
                        await fetchDocuments();
                    }}
                />
            )}

            {isDocGenM365Open && processContactId && (
                <DocumentGeneratorModal
                    processId={processId}
                    contactId={processContactId}
                    mode="M365"
                    generatePdf={false}
                    onClose={() => setIsDocGenM365Open(false)}
                    onSuccess={async () => {
                        setIsDocGenM365Open(false);
                        await fetchDocuments();
                    }}
                />
            )}
        </div>
    );
}
