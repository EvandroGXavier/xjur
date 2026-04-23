import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { FileText, Loader2, Save, X, RefreshCw, Cloud } from 'lucide-react';
import { RichTextEditor } from '../ui/RichTextEditor';
import { clsx } from 'clsx';
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
                element.innerHTML = generatedContent;
                element.style.padding = '40px';
                element.style.color = 'black';
                element.style.backgroundColor = 'white';
                
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
                        <div className="p-8 space-y-6">
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
                        <div className="flex flex-col h-full bg-slate-950">
                             <div className="flex-1 overflow-hidden">
                                <RichTextEditor 
                                    value={generatedContent}
                                    onChange={setGeneratedContent}
                                    showVariables={true}
                                    minHeight={900}
                                    placeholder="Revise o documento gerado antes de salvar."
                                    className="h-full border-0 rounded-none shadow-none"
                                />
                             </div>
                        </div>
                    )}
                </div>

                {/* Footer (Only for Edit step) */}
                {step === 'EDIT' && (
                    <div className="relative z-10 bg-slate-900/90 backdrop-blur-md px-6 py-5 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-4 text-slate-500 italic text-[11px] font-medium sm:block hidden">
                            <span className="flex items-center gap-1.5"><FileText size={12} /> O documento será anexado automaticamente à linha do tempo após a confirmação.</span>
                        </div>
                        
                        <div className="flex w-full sm:w-auto gap-4">
                            <button 
                                onClick={onClose}
                                className="flex-1 sm:flex-none px-6 py-3 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl text-sm font-bold transition-all active:scale-95"
                            >
                                Descartar
                            </button>
                            <button 
                                onClick={handleSave}
                                disabled={rendering}
                                className={clsx(
                                    "flex-1 sm:flex-none px-8 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-3 transition-all active:scale-95 shadow-2xl",
                                    mode === 'M365' 
                                        ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40"
                                        : "bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-900/40"
                                )}
                            >
                                {rendering ? <Loader2 className="animate-spin" size={18} /> : (mode === 'M365' ? <Cloud size={18} /> : <Save size={18} />)}
                                {rendering 
                                    ? (mode === 'M365' ? 'ENVIANDO PARA NUVEM...' : (generatePdf ? 'GERANDO PDF...' : 'SALVANDO...')) 
                                    : (mode === 'M365' ? 'GERAR M365 & ABRIR' : (generatePdf ? 'CONFIRMAR & ANEXAR PDF' : 'SALVAR NO PROCESSO'))}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
