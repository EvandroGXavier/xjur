import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { FileText, Loader2, Save, X, RefreshCw, Cloud, Archive, ArrowLeft, BookOpen, Book, Settings, Info } from 'lucide-react';
import { RichTextEditor } from '../ui/RichTextEditor';
import { clsx } from 'clsx';
import { useHotkeys } from '../../hooks/useHotkeys';
// @ts-ignore
import html2pdf from 'html2pdf.js';

interface Template {
    id: string;
    title: string;
}

interface DocumentGeneratorModalProps {
    processId: string;
    contactId: string; // The main client contact
    onClose: () => void;
    onSuccess: (file?: File) => void;
    mode?: 'LOCAL' | 'M365';
    timelineId?: string | null;
    generatePdf?: boolean;
    onDocumentSaved?: (documentId: string) => void;
}

export function DocumentGeneratorModal({ processId, contactId, onClose, onSuccess, mode = 'LOCAL', timelineId = null, generatePdf = true, onDocumentSaved }: DocumentGeneratorModalProps) {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [rendering, setRendering] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [generatedContent, setGeneratedContent] = useState('');
    const [docTitle, setDocTitle] = useState('');
    const [step, setStep] = useState<'SELECT' | 'EDIT'>('SELECT');
    const [variablesVisible, setVariablesVisible] = useState(true);
    const [showInfo, setShowInfo] = useState(false);

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            setLoading(true);
            const res = await api.get('/documents/templates');
            setTemplates(res.data);
        } catch (error) {
            toast.error('Erro ao carregar modelos da biblioteca');
        } finally {
            setLoading(false);
        }
    };

    const handleRender = async () => {
        if (!selectedTemplateId) {
            toast.warning('Selecione um modelo primeiro');
            return;
        }

        setRendering(true);
        try {
            const res = await api.post(`/documents/templates/${selectedTemplateId}/render`, {
                contactId,
                processId
            });
            
            const template = templates.find(t => t.id === selectedTemplateId);
            setDocTitle(template?.title || 'Documento Gerado');
            setGeneratedContent(res.data.content);
            setStep('EDIT');
        } catch (error) {
            console.error(error);
            toast.error('Erro ao processar as variáveis do modelo');
        } finally {
            setRendering(false);
        }
    };

    useHotkeys({
        onSave: () => {
            if (step === 'EDIT') {
                handleSave();
            }
        }
    });

    const handleSave = async () => {
        if (!generatedContent) {
            toast.error('O conteúdo do documento está vazio');
            return;
        }

        setRendering(true);

        if (mode === 'M365') {
            try {
                // Generate and upload directly to OneDrive
                const res = await api.post(`/documents/templates/${selectedTemplateId}/m365`, {
                    contactId,
                    processId,
                    timelineId,
                    content: generatedContent,
                });

                if (res.data.success && res.data.msFileUrl) {
                    toast.success('Documento gerado com sucesso no OneDrive!');
                    window.open(res.data.msFileUrl, '_blank');
                    if (res.data.documentId) onDocumentSaved?.(res.data.documentId);
                    onSuccess();
                } else {
                    toast.error(res.data.error || 'Erro ao enviar o documento para o OneDrive');
                }
            } catch (error) {
                console.error('M365 Generation error:', error);
                toast.error('Ocorreu um erro na integração com o Microsoft 365. Verifique se o Tenant está configurado.');
            } finally {
                setRendering(false);
            }
        } else {
            try {
                // 1) Salva como documento editável do processo (aba Documentos)
                const saved = await api.post('/documents', {
                    title: docTitle || 'Documento',
                    content: generatedContent,
                    templateId: selectedTemplateId || undefined,
                    processId,
                    timelineId: timelineId || undefined,
                    snapshot: {
                        contactId,
                        processId,
                        templateId: selectedTemplateId || null,
                        generatedAt: new Date().toISOString(),
                        source: 'LOCAL_EDITOR',
                    },
                });
                if (saved?.data?.id) onDocumentSaved?.(saved.data.id);

                // 2) Se não for para anexar PDF, encerra aqui
                if (!generatePdf) {
                    toast.success('Documento salvo no processo!');
                    onSuccess();
                    return;
                }

                // Create a temporary container for rendering
                const element = document.createElement('div');
                
                // Pre-process content to ensure blank lines are preserved
                // html2pdf can collapse empty paragraphs
                const processedContent = generatedContent
                    .replace(/<p>\s*<\/p>/gi, '<p>&nbsp;</p>')
                    .replace(/<p>\s*<br\s*\/?>\s*<\/p>/gi, '<p>&nbsp;</p>');

                element.innerHTML = `
                    <style>
                        body { font-family: 'Calibri', 'Arial', sans-serif; }
                        p { margin: 0; min-height: 1em; line-height: 1.5; }
                        p:empty::before { content: "\\00a0"; }
                        .rich-text-table { width: 100%; border-collapse: collapse; margin: 1em 0; }
                        .rich-text-table td, .rich-text-table th { border: 1px solid #cbd5e1; padding: 8px; }
                        .visual-law-box { page-break-inside: avoid; }
                    </style>
                    <div class="document-pdf-root">
                        ${processedContent}
                    </div>
                `;
                element.style.padding = '40px';
                element.style.color = 'black';
                element.style.backgroundColor = 'white';
                element.style.width = '800px'; // Force a reasonable width for layout calculations
                
                // PDF Options
                const opt = {
                    margin: 10,
                    filename: `${docTitle}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, logging: false },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                };

                // Generate PDF as Blob
                const worker = html2pdf().from(element).set(opt);
                const pdfBlob = await worker.output('blob');
                
                // Create File from Blob
                const fileName = `${docTitle.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
                const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
                
                onSuccess(file);
            } catch (error: any) {
                console.error('GERACAO ERRO', error, error?.response?.data);
                toast.error(`Erro: ${error?.response?.data?.message || error?.message || String(error)}`);
            } finally {
                setRendering(false);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-xl animate-in fade-in duration-500">
            {/* Background Gradient for Studio Look */}
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 via-transparent to-emerald-500/5 pointer-events-none" />

            <div className={`relative bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-700 ease-in-out ${
                step === 'SELECT' 
                    ? 'max-w-xl w-full mx-4 max-h-[85vh] scale-in-center' 
                    : 'w-full h-full sm:m-4 m-0 rounded-none sm:rounded-2xl border-none sm:border shadow-none sm:shadow-2xl'
            }`}>
                {/* Header */}
                <div className="relative z-10 bg-slate-900/80 backdrop-blur-md px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-5 flex-1 max-w-4xl">
                        <div className="hidden sm:flex p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20 shadow-lg shadow-indigo-500/5">
                             <FileText size={22} />
                        </div>
                        <div className="flex-1">
                            {step === 'SELECT' ? (
                                <div>
                                    <h3 className="text-xl font-black text-white tracking-tight">Biblioteca DrX</h3>
                                    <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">Document Designer</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full uppercase tracking-tighter border border-indigo-500/30">Studio</span>
                                        <h3 className="text-sm font-bold text-slate-300">Editando Documento</h3>
                                    </div>
                                    <input 
                                        type="text"
                                        value={docTitle}
                                        onChange={e => setDocTitle(e.target.value)}
                                        className="bg-transparent border-0 text-lg sm:text-2xl font-black text-white focus:ring-0 outline-none w-full placeholder:text-slate-700 transition-all p-0"
                                        placeholder="Título do Documento..."
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {step === 'EDIT' && (
                            <button 
                                onClick={() => setStep('SELECT')}
                                className="hidden md:flex flex-col items-center justify-center w-10 h-10 rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                                title="Voltar para seleção"
                            >
                                <RefreshCw size={18} />
                            </button>
                        )}
                        <button 
                            onClick={onClose} 
                            className="flex items-center justify-center w-10 h-10 rounded-xl border border-slate-800 bg-slate-900 text-slate-500 hover:text-white hover:border-slate-700 transition-all"
                        >
                            <X size={22} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden relative">
                    {step === 'SELECT' ? (
                        <div className="p-8 space-y-6 bg-slate-900/50">
                            {loading ? (
                                <div className="flex flex-col items-center py-20 gap-4">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 animate-pulse" />
                                        <Loader2 className="animate-spin text-indigo-500 relative" size={48} />
                                    </div>
                                    <p className="text-sm text-slate-400 font-medium tracking-wide">Buscando modelos na biblioteca inteligente...</p>
                                </div>
                            ) : templates.length === 0 ? (
                                <div className="text-center py-20 space-y-4">
                                    <div className="mx-auto w-16 h-16 bg-slate-800/50 rounded-2xl flex items-center justify-center text-slate-600">
                                        <FileText size={32} />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-slate-300 font-bold">Nenhum modelo encontrado</p>
                                        <p className="text-xs text-slate-500 max-w-xs mx-auto">Certifique-se de que os modelos estão cadastrados no módulo Biblioteca.</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Selecione o Modelo</label>
                                        <select 
                                            value={selectedTemplateId}
                                            onChange={e => setSelectedTemplateId(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-5 py-4 text-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all appearance-none cursor-pointer text-lg font-medium"
                                        >
                                            <option value="">-- Escolha um modelo da lista --</option>
                                            {templates.map(t => (
                                                <option key={t.id} value={t.id}>{t.title}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="bg-indigo-500/5 p-6 rounded-2xl border border-indigo-500/10 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-indigo-500/20" />
                                        <p className="text-sm text-slate-300 leading-relaxed relative z-10">
                                            <span className="text-indigo-400 font-black">Inteligência DrX:</span> As variáveis serão preenchidas automaticamente com base nos dados do cliente e do processo vinculado. Você poderá revisar cada detalhe antes de finalizar.
                                        </p>
                                    </div>

                                    <button 
                                        onClick={handleRender}
                                        disabled={rendering || !selectedTemplateId}
                                        className="group w-full py-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all shadow-xl shadow-indigo-950/40 active:scale-[0.98]"
                                    >
                                        {rendering ? <Loader2 className="animate-spin" size={24} /> : <RefreshCw size={24} className="group-hover:rotate-180 transition-transform duration-700" />}
                                        Renderizar & Abrir Studio
                                    </button>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="fixed inset-0 z-[120] flex flex-col bg-slate-950 animate-in fade-in zoom-in duration-300">
                            {/* Immersive Background */}
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-emerald-500/5 pointer-events-none" />

                            {/* Header Slim */}
                            <header className="relative z-20 h-16 shrink-0 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/60 px-6 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                                        <FileText size={20} />
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full uppercase tracking-tighter border border-emerald-500/30">Studio Gen</span>
                                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Geração de Documento</span>
                                        </div>
                                        <input
                                            value={docTitle}
                                            onChange={(e) => setDocTitle(e.target.value)}
                                            placeholder="Dê um título ao documento gerado..."
                                            className="bg-transparent border-0 text-xl font-black text-white focus:ring-0 outline-none w-[400px] placeholder:text-slate-700 p-0"
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={handleSave}
                                        disabled={rendering}
                                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
                                    >
                                        {rendering ? <Loader2 size={14} className="animate-spin" /> : <Cloud size={14} />} Gerar PDF
                                    </button>
                                    <div className="h-8 w-px bg-slate-800 mx-2" />
                                    <button
                                        onClick={onClose}
                                        className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-800 text-slate-500 hover:text-white hover:border-slate-700 transition-all"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </header>

                            <div className="flex-1 flex overflow-hidden relative">
                                {/* Sidebar de Atalhos (Esquerda) */}
                                <aside className="w-16 shrink-0 flex flex-col items-center py-6 gap-6 border-r border-slate-900 bg-slate-950 z-20 shadow-2xl">
                                    <div className="flex flex-col items-center gap-1 group">
                                        <button
                                            onClick={() => setStep('SELECT')}
                                            className="p-3 rounded-xl bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white transition-all shadow-lg border border-slate-800"
                                            title="Voltar para seleção"
                                        >
                                            <ArrowLeft size={20} />
                                        </button>
                                        <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">Voltar</span>
                                    </div>

                                    <div className="h-px w-8 bg-slate-900" />

                                    <div className="flex flex-col items-center gap-1 group">
                                        <button
                                            onClick={handleSave}
                                            disabled={rendering || !docTitle.trim()}
                                            className="p-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                                            title="Finalizar e Anexar"
                                        >
                                            {rendering ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                                        </button>
                                        <span className="text-[9px] font-bold text-indigo-400/70 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">Finalizar</span>
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
                                            onClick={() => setShowInfo(!showInfo)}
                                            className={clsx(
                                                "p-3 rounded-xl transition-all shadow-lg border",
                                                showInfo ? "bg-slate-800 text-white" : "bg-slate-900 text-slate-400"
                                            )}
                                            title="Informações"
                                        >
                                            <Settings size={20} />
                                        </button>
                                        <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">Ajustes</span>
                                    </div>
                                </aside>

                                {/* Editor Area */}
                                <main className="flex-1 flex flex-col min-w-0 bg-slate-950 overflow-hidden">
                                    <div className="flex-1 overflow-hidden">
                                        <RichTextEditor 
                                            value={generatedContent}
                                            onChange={setGeneratedContent}
                                            showVariables={true}
                                            variablesVisible={variablesVisible}
                                            onToggleVariables={() => setVariablesVisible(!variablesVisible)}
                                            minHeight={900}
                                            placeholder="Revise o documento gerado antes de salvar."
                                            className="h-full border-0 rounded-none shadow-none"
                                        />
                                    </div>
                                </main>

                                {/* Right Panel */}
                                {showInfo && (
                                    <aside className="w-80 shrink-0 border-l border-slate-900 bg-slate-950 flex flex-col animate-in slide-in-from-right">
                                        <div className="p-6 border-b border-slate-900 flex items-center justify-between">
                                            <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                                                <Info size={14} className="text-indigo-400" /> Detalhes da Geração
                                            </h4>
                                            <button onClick={() => setShowInfo(false)} className="text-slate-600 hover:text-white">
                                                <X size={16} />
                                            </button>
                                        </div>
                                        <div className="p-6 space-y-6">
                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fluxo DrX</label>
                                                <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800 text-xs text-slate-400 leading-relaxed">
                                                    Este documento foi gerado a partir do modelo <span className="text-indigo-400 font-bold">{templates.find(t => t.id === selectedTemplateId)?.title}</span>.
                                                    Todas as variáveis detectadas foram processadas em tempo real.
                                                </div>
                                            </div>
                                        </div>
                                    </aside>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
