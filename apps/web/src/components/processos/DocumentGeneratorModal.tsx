import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { FileText, Loader2, Save, X, RefreshCw } from 'lucide-react';
import { RichTextEditor } from '../ui/RichTextEditor';
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
    onSuccess: (file: File) => void;
}

export function DocumentGeneratorModal({ processId, contactId, onClose, onSuccess }: DocumentGeneratorModalProps) {
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
        try {
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
        } catch (error) {
            console.error(error);
            toast.error('Erro ao gerar arquivo PDF');
        } finally {
            setRendering(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className={`bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${step === 'SELECT' ? 'max-w-md w-full' : 'max-w-5xl w-full h-[90vh]'}`}>
                {/* Header */}
                <div className="bg-slate-900 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                             <FileText size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Gerar Documento DrX</h3>
                            {step === 'EDIT' && (
                                <input 
                                    type="text"
                                    value={docTitle}
                                    onChange={e => setDocTitle(e.target.value)}
                                    className="bg-transparent border-b border-indigo-500/30 text-xs text-indigo-400 font-bold focus:border-indigo-400 outline-none w-full"
                                    placeholder="Título do Documento"
                                />
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition p-2">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden">
                    {step === 'SELECT' ? (
                        <div className="p-6 space-y-4">
                            {loading ? (
                                <div className="flex flex-col items-center py-10 gap-3">
                                    <Loader2 className="animate-spin text-indigo-500" size={32} />
                                    <p className="text-sm text-slate-500">Buscando modelos na biblioteca...</p>
                                </div>
                            ) : templates.length === 0 ? (
                                <div className="text-center py-10 space-y-2">
                                    <p className="text-slate-400">Nenhum modelo encontrado na biblioteca.</p>
                                    <p className="text-xs text-slate-600">Certifique-se de que os modelos estão cadastrados no módulo Biblioteca.</p>
                                </div>
                            ) : (
                                <>
                                    <label className="block text-sm font-medium text-slate-400">Selecione o Modelo</label>
                                    <select 
                                        value={selectedTemplateId}
                                        onChange={e => setSelectedTemplateId(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none transition-colors"
                                    >
                                        <option value="">-- Selecione um modelo --</option>
                                        {templates.map(t => (
                                            <option key={t.id} value={t.id}>{t.title}</option>
                                        ))}
                                    </select>

                                    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-800">
                                        <p className="text-xs text-slate-400 leading-relaxed italic">
                                            O DrX irá preencher automaticamente as variáveis (Nome, CPF, Endereço, etc) com base nos dados do cliente e do processo. Você poderá revisar e editar o texto antes de confirmar.
                                        </p>
                                    </div>

                                    <button 
                                        onClick={handleRender}
                                        disabled={rendering || !selectedTemplateId}
                                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-900/20"
                                    >
                                        {rendering ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
                                        Renderizar & Continuar
                                    </button>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col h-full bg-white">
                             <div className="flex-1 overflow-hidden">
                                <RichTextEditor 
                                    value={generatedContent}
                                    onChange={setGeneratedContent}
                                    className="h-full"
                                />
                             </div>
                        </div>
                    )}
                </div>

                {/* Footer (Only for Edit step) */}
                {step === 'EDIT' && (
                    <div className="bg-slate-900 px-6 py-4 border-t border-slate-800 flex justify-between items-center">
                        <button 
                            onClick={() => setStep('SELECT')}
                            className="text-slate-400 hover:text-white text-sm font-medium"
                        >
                            Voltar para seleção
                        </button>
                        <div className="flex gap-4">
                            <button 
                                onClick={onClose}
                                className="px-4 py-2 text-slate-400 hover:text-white text-sm font-medium"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleSave}
                                disabled={rendering}
                                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg font-bold flex items-center gap-2 transition shadow-lg shadow-emerald-900/20"
                            >
                                {rendering ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                {rendering ? 'Gerando PDF...' : 'Confirmar & Anexar PDF'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
