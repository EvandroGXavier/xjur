import { useState, useEffect } from 'react';
import { Search, FileText, Check, Loader2, Upload, User, DollarSign, Plus } from 'lucide-react';
import { ContactPickerGlobal } from '../../components/contacts/ContactPickerGlobal';
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
    const [previewData, setPreviewData] = useState<any>(null);
    const [step, setStep] = useState(1);
    
    // Formulário manual para Casos
    const [caseForm, setCaseForm] = useState({
        title: '',
        contactId: '',
        clientName: '',
        description: '',
        folder: '',
        value: ''
    });

    const [isDragging, setIsDragging] = useState(false);

    // ✅ RESET: Limpar tudo quando o modal abre ou fecha
    useEffect(() => {
        if (isOpen) {
            // Reset ao ABRIR
            setMode('JUDICIAL');
            setCnj('');
            setLoading(false);
            setPreviewData(null);
            setStep(1);
            setIsDragging(false);
            setCaseForm({
                title: '',
                contactId: '',
                clientName: '',
                description: '',
                folder: '',
                value: ''
            });
        }
    }, [isOpen]);

    const insertTemplate = () => {
        const template = `1. FATOS\n\nANALISE\n\nSUGESTÃO\n1.\n2.\n\n3. DOCUMENTAÇÃO NECESSÁRIA\n- Procuração Assinada\n- Declaração de Hipossuficiência\n`;
        setCaseForm(prev => ({ ...prev, description: prev.description + template }));
    };

    if (!isOpen) return null;

    const processFile = async (file: File) => {
        if (!file || file.type !== 'application/pdf') {
            toast.error('Por favor envie apenas arquivos PDF.');
            return;
        }

        setLoading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await api.post('/processes/import-pdf', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const data = response.data;
            if (!data) throw new Error('Falha ao processar PDF');
            
            setPreviewData({
                ...data,
                parties: data.parts,
                judge: data.judge || 'Não identificado', 
                courtSystem: data.courtSystem || 'PDF Import',
                class: data.class || 'A Classificar',
                area: data.area || 'Não identificada',
                vars: data.vars,
                district: data.district,
            });
            setStep(2);
            
            // Feedback detalhado
            const found = [];
            if (data.cnj) found.push('CNJ');
            if (data.parts?.length > 0) found.push(`${data.parts.length} parte(s)`);
            if (data.value) found.push('Valor');
            if (data.court) found.push('Tribunal');
            toast.success(`Dados extraídos: ${found.length > 0 ? found.join(', ') : 'Texto básico'}`);
        } catch (err) {
            console.error(err);
            toast.error('Erro ao ler PDF. Verifique se o arquivo contém texto selecionável.');
        } finally {
            setLoading(false);
            setIsDragging(false);
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) processFile(file);
        event.target.value = ''; // Reset input
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    };

    const handleSearch = async () => {
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

        if (caseForm.title.trim().length < 5) {
            toast.warning('O título precisa ter pelo menos 5 caracteres');
            return;
        }

        setLoading(true);
        try {
            // ✅ VALIDAÇÃO DE DUPLICATA: Verificar se já existe caso com mesmo título
            const existing = await api.get(`/processes?search=${encodeURIComponent(caseForm.title.trim())}`);
            const duplicates = (existing.data || []).filter(
                (p: any) => p.title?.toLowerCase().trim() === caseForm.title.toLowerCase().trim()
            );
            if (duplicates.length > 0) {
                toast.error(`Já existe um caso com o título "${caseForm.title}". Use um título diferente.`);
                setLoading(false);
                return;
            }

            const payload = {
                title: caseForm.title.trim(),
                contactId: caseForm.contactId,
                category: 'EXTRAJUDICIAL',
                subject: caseForm.description, 
                description: caseForm.description,
                folder: caseForm.folder,
                value: caseForm.value ? parseFloat(caseForm.value.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) : 0,
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
                            {mode === 'JUDICIAL' ? 'Use IA para ler PDF ou pesquise manualmente.' : 'Gerencie contratos, pareceres e demandas extrajudiciais.'}
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
                                    <label
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        className={clsx(
                                            "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition group relative overflow-hidden",
                                            isDragging ? "border-indigo-500 bg-indigo-500/10" : "border-slate-700 hover:border-indigo-500 hover:bg-slate-800/50"
                                        )}
                                    >
                                        <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} />
                                        {loading ? (
                                             <div className="flex flex-col items-center">
                                                <Loader2 className="animate-spin text-indigo-400 mb-2" size={32} />
                                                <p className="text-indigo-300 animate-pulse">Lendo autos do processo...</p>
                                             </div>
                                        ) : (
                                            <>
                                                <div className="p-4 bg-slate-800 rounded-full mb-3 group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition">
                                                    <Upload size={24} className="text-slate-400 group-hover:text-indigo-400" />
                                                </div>
                                                <p className="text-slate-300 font-medium">Arraste sua Petição Inicial ou Capa</p>
                                                <p className="text-slate-500 text-sm mt-1">Extraímos Autores, Réus e Valores com IA</p>
                                            </>
                                        )}
                                    </label>

                                    <div className="flex items-center gap-4">
                                        <div className="h-px bg-slate-800 flex-1"></div>
                                        <span className="text-slate-600 text-xs font-bold">OU DIGITE O NÚMERO</span>
                                        <div className="h-px bg-slate-800 flex-1"></div>
                                    </div>

                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <input 
                                                value={cnj}
                                                onChange={e => setCnj(e.target.value)}
                                                placeholder="CNJ, CPF ou Nome..."
                                                className="w-full bg-slate-800 border-slate-700 rounded-lg pl-4 pr-12 py-3 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                            />
                                            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                        </div>
                                        <button 
                                            onClick={handleSearch}
                                            disabled={loading}
                                            className="px-6 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition border border-slate-700"
                                        >
                                            Buscar
                                        </button>
                                    </div>
                                </div>
                            )}

                            {step === 2 && previewData && (
                                <div className="space-y-4">
                                     <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-lg flex items-start gap-3">
                                        <Check className="text-emerald-400 mt-1" size={20} />
                                        <div>
                                            <h3 className="font-bold text-emerald-400">Processo Encontrado!</h3>
                                            <p className="text-emerald-200/70 text-sm">Confira os dados abaixo antes de importar.</p>
                                        </div>
                                    </div>

                                    {/* Título */}
                                    {previewData.title && (
                                        <div className="bg-slate-800/50 p-3 rounded">
                                            <p className="text-xs text-slate-400 uppercase">Título</p>
                                            <p className="font-medium text-white">{previewData.title}</p>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-3">
                                        <InfoItem label="CNJ" value={previewData.cnj} />
                                        <InfoItem label="Tribunal" value={previewData.court} />
                                        <InfoItem label="Área" value={previewData.area} />
                                        <InfoItem label="Status" value={previewData.status} />
                                        {previewData.vars && <InfoItem label="Vara" value={previewData.vars} />}
                                        {previewData.district && <InfoItem label="Comarca" value={previewData.district} />}
                                        {previewData.judge && <InfoItem label="Magistrado" value={previewData.judge} />}
                                        {previewData.value && (
                                            <div className="bg-slate-800/50 p-3 rounded">
                                                <p className="text-xs text-slate-400 uppercase flex items-center gap-1"><DollarSign size={12} /> Valor</p>
                                                <p className="font-medium text-emerald-400">R$ {Number(previewData.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Partes */}
                                    {previewData.parties && previewData.parties.length > 0 && (
                                        <div className="bg-slate-800/50 p-3 rounded">
                                            <p className="text-xs text-slate-400 uppercase mb-2 flex items-center gap-1"><User size={12} /> Partes Identificadas</p>
                                            {previewData.parties.map((p: any, i: number) => (
                                                <div key={i} className="flex items-center gap-2 text-sm text-white py-1">
                                                    <span className={clsx(
                                                        "text-xs font-bold px-2 py-0.5 rounded",
                                                        p.type === 'AUTOR' ? "bg-blue-500/20 text-blue-400" : "bg-red-500/20 text-red-400"
                                                    )}>{p.type}</span>
                                                    <span>{p.name}</span>
                                                    {p.document && <span className="text-slate-500 text-xs">({p.document})</span>}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex gap-3 pt-2">
                                        <button onClick={() => setStep(1)} className="flex-1 bg-slate-800 text-white py-3 rounded-lg hover:bg-slate-700 transition">Voltar</button>
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
                                />
                             </div>

                             <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Cliente Principal</label>
                                <ContactPickerGlobal 
                                    onAdd={async (data) => {
                                        setCaseForm({
                                            ...caseForm,
                                            contactId: data.contactId,
                                            clientName: data.contactName || ''
                                        });
                                    }}
                                    onSelectContact={(id) => {
                                        setCaseForm({ ...caseForm, contactId: id });
                                    }}
                                    contactLabel="Buscar Cliente"
                                    hideRole={true}
                                    hideQualification={true}
                                    className="!bg-transparent !p-0 !border-0 !shadow-none"
                                    actionIcon={<Plus size={18} />}
                                    showAction={false}
                                />
                                {caseForm.contactId && (
                                    <p className="text-xs text-amber-500 flex items-center gap-1">
                                        <User size={12}/> Selecionado: {caseForm.clientName || 'ID: ' + caseForm.contactId}
                                    </p>
                                )}
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
