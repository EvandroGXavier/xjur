import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../../services/api';
import { ArrowLeft, ExternalLink, FileText, Loader2, Pencil, Plus, Save, Sparkles, Trash2, Printer, Download, MessageCircle } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { clsx } from 'clsx';
import { RichTextEditor, RichTextEditorHandle } from '../ui/RichTextEditor';
import { DocumentGeneratorModal } from './DocumentGeneratorModal';
import { embeddedContentColor } from '../../utils/themeColors';

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

    const editorRef = useRef<RichTextEditorHandle>(null);

    // AI improvement
    const [aiInstruction, setAiInstruction] = useState(
        'Aprimore a redação jurídica (clareza, coesão, persuasão), corrija português, mantenha estrutura Visual Law e preserve o sentido. Retorne apenas HTML pronto para Word Online.',
    );
    const [aiLoading, setAiLoading] = useState(false);

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

    const handleSaveDoc = async () => {
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
            setIsEditorOpen(false);
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
        printWindow.document.write(`
            <html>
                <head>
                    <title>${doc.title}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20mm; margin: 0; color: ${embeddedContentColor.textStrong}; background: ${embeddedContentColor.surface}; }
                        @media print { body { padding: 0; margin: 0; } }
                    </style>
                </head>
                <body>${doc.content || ''}</body>
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
        element.innerHTML = doc.content || '';
        element.style.padding = '20mm';
        element.style.color = 'black';
        element.style.backgroundColor = 'white';

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
            <div className="flex min-h-[70vh] w-full flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 lg:min-h-[calc(100vh-220px)]">
                <div className="flex flex-col gap-4 border-b border-slate-800 bg-slate-900 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                        <button
                            onClick={() => setIsEditorOpen(false)}
                            className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div className="min-w-0 flex-1">
                            <input
                                value={editorTitle}
                                onChange={(e) => setEditorTitle(e.target.value)}
                                placeholder="Título do Documento"
                                className="w-full max-w-full bg-transparent text-base font-bold text-white placeholder-slate-600 focus:outline-none sm:text-lg lg:max-w-[70vw]"
                                autoFocus
                            />
                            <div className="text-xs text-slate-500 mt-1">
                                {editingDoc?.template?.title ? `Modelo: ${editingDoc.template.title}` : 'Documento do processo'}
                                {editingDoc?.timelineId ? ' • Vinculado a um andamento' : ''}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {editingDoc?.msFileUrl && (
                            <button
                                onClick={() => window.open(String(editingDoc.msFileUrl), '_blank')}
                                className="px-3 py-2 bg-blue-600/15 hover:bg-blue-600/25 text-blue-200 border border-blue-500/25 rounded-lg text-sm font-bold inline-flex items-center gap-2"
                                title="Abrir no Word Online"
                            >
                                <ExternalLink size={16} /> Word Online
                            </button>
                        )}
                        <button
                            onClick={handleSaveDoc}
                            disabled={saving}
                            className={clsx(
                                "px-4 py-2 rounded-lg font-bold inline-flex items-center gap-2 transition",
                                saving ? "bg-indigo-600/60 text-white" : "bg-indigo-600 hover:bg-indigo-700 text-white",
                            )}
                        >
                            <Save size={16} /> {saving ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </div>

                <div className="p-4 border-b border-slate-800 bg-slate-950">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        <div className="lg:col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                IA (Aprimorar peça)
                            </label>
                            <textarea
                                value={aiInstruction}
                                onChange={(e) => setAiInstruction(e.target.value)}
                                rows={2}
                                className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="Instruções para a IA (ex: reforçar fundamentos, ajustar pedidos, revisar coesão)."
                            />
                        </div>
                        <div className="flex items-end gap-2">
                            <button
                                onClick={improveSelectionWithAi}
                                disabled={aiLoading}
                                className="flex-1 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-bold text-slate-200 inline-flex items-center justify-center gap-2"
                                title="Substitui o trecho selecionado"
                            >
                                <Sparkles size={14} /> Trecho
                            </button>
                            <button
                                onClick={improveAllWithAi}
                                disabled={aiLoading}
                                className="flex-1 px-3 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg text-xs font-bold text-white inline-flex items-center justify-center gap-2"
                                title="Substitui o documento inteiro"
                            >
                                <Sparkles size={14} /> Documento
                            </button>
                        </div>
                    </div>
                    {aiLoading && (
                        <div className="mt-2 text-xs text-slate-500 inline-flex items-center gap-2">
                            <Loader2 className="animate-spin" size={14} /> IA processando...
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-hidden bg-white">
                    <RichTextEditor
                        ref={editorRef}
                        value={editorContent}
                        onChange={setEditorContent}
                        className="h-full"
                        showVariables={false}
                        minHeight={860}
                        placeholder="Edite aqui o documento do processo com qualidade de peça final."
                    />
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
