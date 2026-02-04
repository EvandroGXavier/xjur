import { useState } from 'react';
import { Search, FileText, Check, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { api } from '../../services/api';
import { masks } from '../../utils/masks';

interface MagicProcessModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function MagicProcessModal({ isOpen, onClose, onSuccess }: MagicProcessModalProps) {
    const [mode, setMode] = useState<'JUDICIAL' | 'EXTRAJUDICIAL'>('JUDICIAL');
    const [cnj, setCnj] = useState('');
    const [loading, setLoading] = useState(false);
    const [previewData, setPreviewData] = useState<any>(null); // Dados retornados pelo Crawler
    const [step, setStep] = useState(1); // 1: Input, 2: Preview
    
    // Formulário manual para Casos
    const [caseForm, setCaseForm] = useState({
        title: '',
        client: '',
        description: '',
        folder: '',
        value: ''
    });

    const insertTemplate = () => {
        const template = `1. FATOS\n\nANALISE\n\nSUGESTÃO\n1.\n2.\n\n3. DOCUMENTAÇÃO NECESSÁRIA\n- Procuração Assinada\n- Declaração de Hipossuficiência\n`;
        setCaseForm(prev => ({ ...prev, description: prev.description + template }));
    };

    if (!isOpen) return null;

    const handleSearch = async () => {
        // ... (lógica anterior de busca)
        if (!cnj || cnj.length < 3) {
            toast.warning('Digite um termo de busca válido (mínimo 3 caracteres)');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/processes/automator/search', { term: cnj });
            const data = Array.isArray(response.data) ? response.data[0] : response.data;
            if (!data) throw new Error('Nenhum processo encontrado');
            setPreviewData(data);
            setStep(2);
            toast.success('Processo encontrado!');
        } catch (err) {
            console.error(err);
            toast.error('Nenhum processo encontrado com esses dados.');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveProcess = async () => {
        setLoading(true);
        try {
            await api.post('/processes', { ...previewData, category: 'JUDICIAL' });
            toast.success('Processo importado com sucesso!');
            onSuccess();
            onClose();
        } catch (err) {
            console.error(err);
            toast.error('Erro ao salvar processo');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveCase = async () => {
        if (!caseForm.title) {
            toast.warning('O título do caso é obrigatório');
            return;
        }

        setLoading(true);
        try {
            // Payload para Caso Extrajudicial
            const payload = {
                title: caseForm.title,
                category: 'EXTRAJUDICIAL',
                subject: caseForm.description, // Mapeando description para subject provisoriamente ou criando campo novo no createDTO
                description: caseForm.description,
                folder: caseForm.folder,
                value: caseForm.value ? parseFloat(caseForm.value.replace('R$', '').replace('.', '').replace(',', '.')) : 0,
                status: 'ATIVO',
            };

            await api.post('/processes', payload);
            toast.success('Caso criado com sucesso!');
            onSuccess();
            onClose();
        } catch (err) {
            console.error(err);
            toast.error('Erro ao criar caso');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fadeIn">
                {/* Header */}
                <div className="bg-slate-950 p-6 border-b border-slate-800 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                             {mode === 'JUDICIAL' ? (
                                <span className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg"><FileText size={20} /></span>
                             ) : (
                                <span className="p-2 bg-amber-500/20 text-amber-400 rounded-lg"><FileText size={20} /></span>
                             )}
                            {mode === 'JUDICIAL' ? 'Novo Processo Mágico' : 'Novo Caso / Consultivo'}
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">
                            {mode === 'JUDICIAL' ? 'Dr.X Automation: Digite o CNJ e nós buscamos os dados.' : 'Gerencie contratos, pareceres e demandas extrajudiciais.'}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition">✕</button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-800">
                    <button 
                        onClick={() => setMode('JUDICIAL')}
                        className={clsx("flex-1 py-3 text-sm font-medium transition", mode === 'JUDICIAL' ? "text-indigo-400 border-b-2 border-indigo-500 bg-indigo-500/5" : "text-slate-400 hover:text-white hover:bg-slate-800")}
                    >
                        ⚖️ Processo Judicial
                    </button>
                    <button 
                        onClick={() => setMode('EXTRAJUDICIAL')}
                        className={clsx("flex-1 py-3 text-sm font-medium transition", mode === 'EXTRAJUDICIAL' ? "text-amber-400 border-b-2 border-amber-500 bg-amber-500/5" : "text-slate-400 hover:text-white hover:bg-slate-800")}
                    >
                        📁 Caso / Consultivo
                    </button>
                </div>

                <div className="p-6">
                    {/* MODE: JUDICIAL */}
                    {mode === 'JUDICIAL' && (
                        <>
                            {step === 1 && (
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-300">Buscar por CNJ, CPF, CNPJ ou Nome</label>
                                        <div className="relative">
                                            <input 
                                                value={cnj}
                                                onChange={e => setCnj(e.target.value)}
                                                placeholder="Digite o número do processo, documento ou nome..."
                                                className="w-full bg-slate-800 border-slate-700 rounded-lg pl-4 pr-12 py-4 text-lg font-mono text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                                autoFocus
                                            />
                                            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                        </div>
                                    </div>

                                    <button 
                                        onClick={handleSearch}
                                        disabled={loading}
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2"
                                    >
                                        {loading ? <Loader2 className="animate-spin" /> : 'Buscar Processo Automaticamente'}
                                    </button>
                                </div>
                            )}

                            {step === 2 && previewData && (
                                <div className="space-y-6">
                                    {/* ... Preview content ... */} 
                                     <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-lg flex items-start gap-3">
                                        <Check className="text-emerald-400 mt-1" size={20} />
                                        <div>
                                            <h3 className="font-bold text-emerald-400">Processo Encontrado!</h3>
                                            <p className="text-emerald-200/70 text-sm">Confira os dados abaixo antes de importar.</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <InfoItem label="Tribunal" value={previewData.court} />
                                        <InfoItem label="Sistema" value={previewData.courtSystem} />
                                        <InfoItem label="Classe" value={previewData.class} />
                                        <InfoItem label="Status" value={previewData.status} />
                                    </div>

                                    <div className="flex gap-3 pt-4">
                                        <button onClick={() => setStep(1)} className="flex-1 bg-slate-800 text-white py-3 rounded-lg">Voltar</button>
                                        <button onClick={handleSaveProcess} disabled={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
                                            {loading ? <Loader2 className="animate-spin" /> : 'Confirmar Importação'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* MODE: EXTRAJUDICIAL */}
                    {mode === 'EXTRAJUDICIAL' && (
                        <div className="space-y-4 animate-fadeIn">
                             <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Título do Caso *</label>
                                <input 
                                    value={caseForm.title}
                                    onChange={e => setCaseForm({...caseForm, title: e.target.value})}
                                    placeholder="Ex: Análise Contratual - Empresa X"
                                    className="w-full bg-slate-800 border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                    autoFocus
                                />
                             </div>

                             <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-medium text-slate-300">Assunto / Descrição</label>
                                    <button 
                                        onClick={insertTemplate}
                                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                                    >
                                        <FileText size={12} /> Inserir Modelo Padrão
                                    </button>
                                </div>
                                <textarea 
                                    value={caseForm.description}
                                    onChange={e => setCaseForm({...caseForm, description: e.target.value})}
                                    placeholder="Descreva brevemente a demanda ou use o modelo..."
                                    className="w-full bg-slate-800 border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-amber-500 focus:outline-none min-h-[150px] font-mono text-sm"
                                />
                             </div>

                             <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Valor Estimado</label>
                                    <input 
                                        value={caseForm.value}
                                        onChange={e => setCaseForm({...caseForm, value: masks.currency(e.target.value)})}
                                        placeholder="R$ 0,00"
                                        className="w-full bg-slate-800 border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Pasta na Nuvem (Link)</label>
                                    <input 
                                        value={caseForm.folder}
                                        onChange={e => setCaseForm({...caseForm, folder: e.target.value})}
                                        placeholder="Z:\ ou Google Drive Link"
                                        className="w-full bg-slate-800 border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                    />
                                </div>
                             </div>

                             <button 
                                onClick={handleSaveCase}
                                disabled={loading}
                                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2 mt-4"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : 'Criar Caso'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function InfoItem({ label, value }: { label: string, value: string }) {
    return (
        <div className="bg-slate-800/50 p-3 rounded">
            <p className="text-xs text-slate-400 uppercase">{label}</p>
            <p className="font-medium text-white truncate" title={value}>{value || '-'}</p>
        </div>
    );
}
