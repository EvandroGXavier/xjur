import { useEffect, useMemo, useState } from 'react';
import { Search, FileText, Check, Loader2, Upload, User, DollarSign, Plus } from 'lucide-react';
import { ContactPickerGlobal } from '../../components/contacts/ContactPickerGlobal';
import {
    applyImportedPartyClassification,
    buildImportedPartyReview,
    ProcessImportPartyReview,
    type ImportedPartyClassification,
} from '../../components/processos/ProcessImportPartyReview';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { api } from '../../services/api';
import { masks } from '../../utils/masks';

interface MagicProcessModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const normalizeLifecycleStatus = (value?: string | null, fallback = 'ATIVO') => {
    const normalized = String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, '_');

    const statusMap: Record<string, string> = {
        ATIVO: 'ATIVO',
        ATIVA: 'ATIVO',
        INATIVO: 'INATIVO',
        INATIVA: 'INATIVO',
        EM_ANDAMENTO: 'EM_ANDAMENTO',
        EM_ACOMPANHAMENTO: 'EM_ANDAMENTO',
        OPORTUNIDADE: 'OPORTUNIDADE',
        SUSPENSO: 'SUSPENSO',
        SUSPENSA: 'SUSPENSO',
        ARQUIVADO: 'ARQUIVADO',
        ARQUIVADA: 'ARQUIVADO',
        ENCERRADO: 'ENCERRADO',
        ENCERRADA: 'ENCERRADO',
    };

    return statusMap[normalized] || fallback;
};

export function MagicProcessModal({ isOpen, onClose, onSuccess }: MagicProcessModalProps) {
    const [mode, setMode] = useState<'JUDICIAL' | 'EXTRAJUDICIAL'>('EXTRAJUDICIAL');
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
    const [partyClassification, setPartyClassification] = useState<Record<string, ImportedPartyClassification>>({});

    const [isDragging, setIsDragging] = useState(false);
    const partyReview = useMemo(
        () => buildImportedPartyReview(Array.isArray(previewData?.parties) ? previewData.parties : []),
        [previewData?.parties],
    );

    // ✅ RESET: Limpar tudo quando o modal abre ou fecha
    useEffect(() => {
        if (isOpen) {
            // Reset ao ABRIR
            setMode('EXTRAJUDICIAL');
            setCnj('');
            setLoading(false);
            setPreviewData(null);
            setStep(1);
            setIsDragging(false);
            setPartyClassification({});
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

    useEffect(() => {
        setPartyClassification(current => {
            const next: Record<string, ImportedPartyClassification> = {};
            partyReview.principalParties.forEach(party => {
                if (current[party.reviewKey]) {
                    next[party.reviewKey] = current[party.reviewKey];
                    return;
                }
                if (party.isClient) {
                    next[party.reviewKey] = 'CLIENT';
                    return;
                }
                if (party.isOpposing) {
                    next[party.reviewKey] = 'OPPOSING';
                    return;
                }
                next[party.reviewKey] = '';
            });
            return next;
        });
    }, [partyReview]);

    const insertTemplate = () => {
        const template = `1. FATOS\n\nANALISE\n\nSUGESTÃO\n1.\n2.\n\n3. DOCUMENTAÇÃO NECESSÁRIA\n- Procuração Assinada\n- Declaração de Hipossuficiência\n`;
        setCaseForm(prev => ({ ...prev, description: prev.description + template }));
    };

    if (!isOpen) return null;

    const buildJudicialImportPayload = () => ({
        cnj: previewData?.cnj || '',
        title: previewData?.title || `Processo ${previewData?.cnj || ''}`,
        category: 'JUDICIAL',
        court: previewData?.court || '',
        courtSystem: previewData?.courtSystem || '',
        vars: previewData?.vars || '',
        district: previewData?.district || '',
        status: normalizeLifecycleStatus(previewData?.status, 'ATIVO'),
        area: previewData?.area || '',
        subject: previewData?.subject || '',
        class: previewData?.class || '',
        distributionDate: previewData?.distributionDate || undefined,
        judge: previewData?.judge || '',
        value: previewData?.value || 0,
        description: previewData?.description || '',
        folder: previewData?.folder || '',
        metadata: {
            ...(previewData?.metadata && typeof previewData.metadata === 'object' ? previewData.metadata : {}),
            proceduralStatus: previewData?.status || previewData?.metadata?.proceduralStatus || undefined,
        },
        parties: applyImportedPartyClassification(partyReview, partyClassification),
    });

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
            let data: any = null;

            try {
                const official = await api.post('/processes/config/integrations/import-cnj', { cnj });
                data = official.data;
            } catch {
                const response = await api.post('/processes/automator/search', { term: cnj });
                data = Array.isArray(response.data) ? response.data[0] : response.data;
            }

            if (!data) throw new Error('Nenhum processo encontrado');
            setPreviewData(data);
            setStep(2);
            toast.success(`Processo encontrado! ${Array.isArray(data.parties) ? `${data.parties.length} parte(s) pronta(s) para importar.` : ''}`);
        } catch (err) {
            console.error(err);
            toast.error('Nenhum processo encontrado com esses dados.');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveProcess = async () => {
        const unresolvedParties = partyReview.principalParties.filter(party => !partyClassification[party.reviewKey]);
        if (unresolvedParties.length > 0) {
            toast.warning('Classifique todas as partes principais como cliente ou contrário antes de importar.');
            return;
        }

        const clientCount = partyReview.principalParties.filter(party => partyClassification[party.reviewKey] === 'CLIENT').length;
        if (clientCount === 0) {
            toast.warning('Marque ao menos uma parte principal como cliente antes de importar.');
            return;
        }

        setLoading(true);
        try {
            const payload = buildJudicialImportPayload();
            await api.post('/processes', payload);
            toast.success('Processo importado com sucesso! Capa e partes foram sincronizadas.');
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error(err);
            toast.error('Erro ao salvar processo', {
                description: err?.response?.data?.message || err?.message || 'A API recusou a importacao do processo.',
            });
        } finally {
            setLoading(false);
        }
    };

    const applyDefaultClassification = () => {
        const next: Record<string, ImportedPartyClassification> = {};
        partyReview.activeParties.forEach(party => {
            next[party.reviewKey] = 'CLIENT';
        });
        partyReview.passiveParties.forEach(party => {
            next[party.reviewKey] = 'OPPOSING';
        });
        setPartyClassification(next);
    };

    const clearClassification = () => {
        const next: Record<string, ImportedPartyClassification> = {};
        partyReview.principalParties.forEach(party => {
            next[party.reviewKey] = '';
        });
        setPartyClassification(next);
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
                        onClick={() => setMode('EXTRAJUDICIAL')}
                        className={clsx("flex-1 py-3 text-sm font-medium transition", mode === 'EXTRAJUDICIAL' ? "text-amber-400 border-b-2 border-amber-500 bg-amber-500/5" : "text-slate-400 hover:text-white hover:bg-slate-800")}
                    >
                        📁 Extrajudicial
                    </button>
                    <button 
                        onClick={() => setMode('JUDICIAL')}
                        className={clsx("flex-1 py-3 text-sm font-medium transition", mode === 'JUDICIAL' ? "text-indigo-400 border-b-2 border-indigo-500 bg-indigo-500/5" : "text-slate-400 hover:text-white hover:bg-slate-800")}
                    >
                        ⚖️ Judicial / Administrativo
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
                                                placeholder="CNJ do processo..."
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
                                        <InfoItem label="CNJ" value={previewData.cnj ? masks.cnj(previewData.cnj) : '-'} />
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

                                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-300">Classificação Antes de Importar</p>
                                            <p className="mt-1 text-sm text-slate-400">
                                                Confirme quem é cliente e quem é contrário, mantendo autor/réu exatamente como veio do processo.
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={applyDefaultClassification}
                                                className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-300 transition hover:bg-emerald-500/15"
                                            >
                                                Ativo = Cliente
                                            </button>
                                            <button
                                                type="button"
                                                onClick={clearClassification}
                                                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-300 transition hover:border-slate-700 hover:bg-slate-900"
                                            >
                                                Limpar
                                            </button>
                                        </div>
                                    </div>

                                    {partyReview.principalParties.length > 0 ? (
                                        <ProcessImportPartyReview
                                            review={partyReview}
                                            classification={partyClassification}
                                            onClassificationChange={(reviewKey, value) =>
                                                setPartyClassification(current => ({
                                                    ...current,
                                                    [reviewKey]: value,
                                                }))
                                            }
                                        />
                                    ) : (
                                        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-500">
                                            Nenhuma parte principal foi identificada automaticamente neste PDF.
                                        </div>
                                    )}

                                    <div className="flex gap-3 pt-2">
                                        <button onClick={() => setStep(1)} className="flex-1 bg-slate-800 text-white py-3 rounded-lg hover:bg-slate-700 transition">Voltar</button>
                                        <button onClick={handleSaveProcess} disabled={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
                                            {loading ? <Loader2 className="animate-spin" /> : 'Confirmar Importação'}
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-400">
                                        Esta confirmação cadastra no mínimo a capa do processo e as partes encontradas na consulta.
                                    </p>
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
