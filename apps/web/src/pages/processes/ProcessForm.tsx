import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { toast } from 'sonner';
import {
    ArrowLeft,
    Save,
    Loader2,
    FileText,
    Users,
    Calendar,
    Activity,
    FolderSync,
    ExternalLink,
    Search,
    RefreshCcw,
} from 'lucide-react';
import { masks } from '../../utils/masks';
import { ProcessParties } from './ProcessParties';
import { ProcessoAndamentos } from '../../components/processos/ProcessoAndamentos';
import { ProcessAgenda } from '../../components/processos/ProcessAgenda';
import { CreatableSelect } from '../../components/ui/CreatableSelect';
import { useHotkeys } from '../../hooks/useHotkeys';
import { getOfficeFolderDisplayPath } from '../../utils/officePath';

const DEFAULT_AREAS = [
    { label: 'Civel', value: 'Civel' },
    { label: 'Trabalhista', value: 'Trabalhista' },
    { label: 'Criminal', value: 'Criminal' },
    { label: 'Familia', value: 'Familia' },
    { label: 'Tributario', value: 'Tributario' },
    { label: 'Consumidor', value: 'Consumidor' },
    { label: 'Administrativo', value: 'Administrativo' },
    { label: 'Previdenciario', value: 'Previdenciario' },
];

const EMPTY_FORM = {
    title: '',
    cnj: '',
    court: '',
    courtSystem: '',
    vars: '',
    district: '',
    status: 'ATIVO',
    category: 'EXTRAJUDICIAL',
    area: '',
    subject: '',
    class: '',
    distributionDate: '',
    judge: '',
    value: 0,
    description: '',
    folder: '',
    metadata: null as any,
};

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

type ImportedParty = {
    name: string;
    type: string;
    document?: string;
    phone?: string;
    email?: string;
    oab?: string;
    representedNames?: string[];
};

export function ProcessForm() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditing = !!id && id !== 'new';

    const [activeTab, setActiveTab] = useState('MAIN');
    const [loading, setLoading] = useState(false);
    const [syncingMicrosoftFolder, setSyncingMicrosoftFolder] = useState(false);
    const [consultingCnj, setConsultingCnj] = useState(false);
    const [importedParties, setImportedParties] = useState<ImportedParty[]>([]);
    const [importedMovements, setImportedMovements] = useState<any[]>([]);
    const [lastConsultSummary, setLastConsultSummary] = useState('');
    const [form, setForm] = useState(EMPTY_FORM);

    useEffect(() => {
        if (isEditing) {
            void fetchProcess();
        }
    }, [id]);

    const mergeImportedDataIntoForm = (payload: any) => ({
        ...form,
        title: payload.title || form.title,
        cnj: payload.cnj ? masks.cnj(payload.cnj) : form.cnj,
        court: payload.court || form.court,
        courtSystem: payload.courtSystem || form.courtSystem,
        vars: payload.vars || form.vars,
        district: payload.district || form.district,
        status: normalizeLifecycleStatus(payload.status, form.status || 'ATIVO'),
        category: payload.cnj ? 'JUDICIAL' : form.category,
        area: payload.area || form.area,
        subject: payload.subject || form.subject,
        class: payload.class || form.class,
        distributionDate: payload.distributionDate
            ? String(payload.distributionDate).slice(0, 10)
            : form.distributionDate,
        judge: payload.judge || form.judge,
        value: typeof payload.value === 'number' && payload.value > 0 ? payload.value : form.value,
        description: payload.description || form.description,
        folder: payload.folder || form.folder,
        metadata: {
            ...(form.metadata && typeof form.metadata === 'object' ? form.metadata : {}),
            ...(payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}),
            proceduralStatus: payload.status || payload.metadata?.proceduralStatus || form.metadata?.proceduralStatus || undefined,
        },
    });

    const fetchProcess = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/processes/${id}`);
            const data = res.data;
            setForm({
                title: data.title || '',
                cnj: data.cnj ? masks.cnj(data.cnj) : '',
                court: data.court || '',
                courtSystem: data.courtSystem || '',
                vars: data.vars || '',
                district: data.district || '',
                status: normalizeLifecycleStatus(data.status, 'ATIVO'),
                category: data.category || 'JUDICIAL',
                area: data.area || '',
                subject: data.subject || '',
                class: data.class || '',
                distributionDate: data.distributionDate ? String(data.distributionDate).slice(0, 10) : '',
                judge: data.judge || '',
                value: data.value ? parseFloat(data.value) : 0,
                description: data.description || '',
                folder: data.folder || data.msFolderUrl || '',
                metadata: data.metadata || null,
            });
            setImportedParties(Array.isArray(data.parties) ? data.parties : []);
            setImportedMovements(Array.isArray(data.movements) ? data.movements : []);
            setLastConsultSummary(
                Array.isArray(data.processParties) && data.processParties.length > 0
                    ? `${data.processParties.length} parte(s) sincronizadas no cadastro do processo${Array.isArray(data.processPartyRepresentations) && data.processPartyRepresentations.length > 0 ? ` e ${data.processPartyRepresentations.length} vinculo(s) de representacao` : ''}`
                    : Array.isArray(data.parties) && data.parties.length > 0
                    ? `${data.parties.length} parte(s) prontas para sincronizacao`
                    : '',
            );
        } catch {
            toast.error('Erro ao carregar processo');
            navigate('/processes');
        } finally {
            setLoading(false);
        }
    };

    useHotkeys({
        onNew: () => {
            if (activeTab === 'PARTIES') return;
            if (!isEditing) {
                document.getElementById('focus-title')?.focus();
            } else {
                navigate('/processes/new');
            }
        },
        onCancel: () => navigate('/processes'),
    });

    const fetchCnjData = async () => {
        if (!form.cnj.trim()) {
            toast.warning('Informe o CNJ antes de consultar');
            return null;
        }

        try {
            const official = await api.post('/processes/config/integrations/import-cnj', {
                cnj: form.cnj,
            });
            return official.data;
        } catch (error: any) {
            const fallback = await api.post('/processes/automator/cnj', {
                cnj: form.cnj,
            });
            return fallback.data;
        }
    };

    const handleConsultCnj = async (persistAfterFetch = false) => {
        setConsultingCnj(true);
        try {
            const imported = await fetchCnjData();
            if (!imported) return;

            const mergedForm = mergeImportedDataIntoForm(imported);
            const parties = Array.isArray(imported.parties) ? imported.parties : [];
            const movements = Array.isArray(imported.movements) ? imported.movements : [];
            setForm(mergedForm);
            setImportedParties(parties);
            setImportedMovements(movements);

            const lawyerCount = parties.filter(party => String(party.type || '').toUpperCase().includes('ADVOG')).length;
            const summary = `Capa atualizada${parties.length > 0 ? `, ${parties.length} parte(s) preparadas` : ''}${movements.length > 0 ? ` e ${movements.length} andamentos extraidos` : ''}. Revise nas abas acima.`;
            setLastConsultSummary(summary);

            if (persistAfterFetch && isEditing) {
                await api.patch(`/processes/${id}`, {
                    ...mergedForm,
                    parties,
                });
                toast.success('Processo consultado e atualizado com sucesso!');
                await fetchProcess();
                return;
            }

            toast.success('Consulta concluida. Revise os dados e salve quando estiver pronto.');
        } catch (error: any) {
            toast.error(
                error?.response?.data?.message ||
                error?.message ||
                'Erro ao consultar CNJ.',
            );
        } finally {
            setConsultingCnj(false);
        }
    };

    const handleSubmit = async (shouldClose: boolean) => {
        if (!form.title) {
            toast.warning('Titulo e obrigatorio');
            return;
        }

            const payload = {
                ...form,
                parties: importedParties.length > 0 ? importedParties : undefined,
            };

        setLoading(true);
        try {
            if (isEditing) {
                await api.patch(`/processes/${id}`, payload);
                toast.success('Processo atualizado!');
                if (shouldClose) navigate('/processes');
            } else {
                const res = await api.post('/processes', payload);
                toast.success('Processo criado!');
                navigate(shouldClose ? '/processes' : `/processes/${res.data.id}`);
            }
        } catch (err: any) {
            console.error(err);
            const message = err.response?.data?.message || err.message || 'Erro ao conectar com servidor';
            const errorDetail = err.response?.data || err;
            const errorString = typeof errorDetail === 'object' ? JSON.stringify(errorDetail, null, 2) : String(errorDetail);

            toast.error('Erro ao salvar processo', {
                description: message,
                action: {
                    label: 'Copiar Erro',
                    onClick: () => {
                        navigator.clipboard.writeText(errorString);
                        toast.success('Erro copiado!');
                    },
                },
                duration: 10000,
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSyncMicrosoftFolder = async () => {
        if (!isEditing || !id) {
            toast.warning('Salve o processo primeiro para criar a pasta Microsoft 365.');
            return;
        }

        try {
            setSyncingMicrosoftFolder(true);
            const response = await api.post(`/processes/${id}/microsoft-folder/sync`);
            const process = response.data?.process;

            if (process) {
                setForm(current => ({
                    ...current,
                    folder: process.folder || process.msFolderUrl || current.folder,
                }));
            }

            if (response.data?.success) {
                toast.success(response.data?.message || 'Pasta Microsoft 365 sincronizada.');
                return;
            }

            toast.warning(response.data?.message || 'Nao foi possivel sincronizar a pasta Microsoft 365.');
        } catch (error: any) {
            toast.error(
                error?.response?.data?.message ||
                error?.message ||
                'Erro ao sincronizar a pasta Microsoft 365.',
            );
        } finally {
            setSyncingMicrosoftFolder(false);
        }
    };

    if (loading && isEditing && !form.title) {
        return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>;
    }

    const inputClass = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors placeholder-slate-600';
    const labelClass = 'text-sm font-medium text-slate-300';

    const TabButton = ({ tabId, label, icon: Icon }: any) => (
        <button
            type="button"
            onClick={() => setActiveTab(tabId)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition ${
                activeTab === tabId
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
        >
            <Icon size={16} />
            {label}
        </button>
    );

    return (
        <div className="p-6 md:p-8 animate-in fade-in">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => navigate('/processes')} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-white">{isEditing ? 'Editar Processo' : 'Novo Processo'}</h1>
                    <p className="text-slate-500 text-sm mt-0.5">{isEditing ? `ID: ${id?.substring(0, 8)}...` : 'Preencha os dados do processo'}</p>
                </div>
            </div>

            {(isEditing || importedParties.length > 0 || importedMovements.length > 0) && (
                <div className="flex border-b border-slate-800 mb-6">
                    <TabButton tabId="MAIN" label="PRINCIPAL" icon={FileText} />
                    {(isEditing || importedParties.length > 0) && <TabButton tabId="PARTIES" label="PARTES" icon={Users} />}
                    {(isEditing || importedMovements.length > 0) && <TabButton tabId="TIMELINE" label="ANDAMENTOS" icon={Activity} />}
                    {isEditing && <TabButton tabId="AGENDA" label="AGENDA" icon={Calendar} />}
                </div>
            )}

            <div className="max-w-5xl">
                <div className={activeTab === 'MAIN' ? 'block' : 'hidden'}>
                    <form onSubmit={e => { e.preventDefault(); void handleSubmit(true); }} className="space-y-6">
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Identificacao</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <label className={labelClass}>Titulo / Nome do Caso *</label>
                                    <input id="focus-title" autoFocus value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={inputClass} placeholder="Ex: Acao de Cobranca - Joao vs Maria" required />
                                </div>
                                <div className="space-y-1.5">
                                    <label className={labelClass}>Numero CNJ</label>
                                    <div className="flex gap-2">
                                        <input value={form.cnj} onChange={e => setForm({ ...form, cnj: masks.cnj(e.target.value) })} className={`${inputClass} font-mono`} placeholder="0000000-00.0000.0.00.0000" />
                                        <button type="button" onClick={() => void handleConsultCnj(false)} disabled={consultingCnj} className="inline-flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-2.5 text-sm font-medium text-indigo-300 transition hover:bg-indigo-500/20 disabled:opacity-50">
                                            {consultingCnj ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                                            Consultar
                                        </button>
                                    </div>
                                    {isEditing && (
                                        <button type="button" onClick={() => void handleConsultCnj(true)} disabled={consultingCnj || !form.cnj} className="inline-flex items-center gap-2 text-xs font-medium text-emerald-300 hover:text-emerald-200 disabled:opacity-50">
                                            {consultingCnj ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                                            Consultar e atualizar agora
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <label className={labelClass}>Categoria</label>
                                    <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={inputClass}>
                                        <option value="EXTRAJUDICIAL">Extrajudicial</option>
                                        <option value="JUDICIAL">Judicial</option>
                                        <option value="ADMINISTRATIVO">Administrativo</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className={labelClass}>Status</label>
                                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inputClass}>
                                        <option value="ATIVO">Ativo</option>
                                        <option value="EM_ANDAMENTO">Em Andamento</option>
                                        <option value="SUSPENSO">Suspenso</option>
                                        <option value="ARQUIVADO">Arquivado</option>
                                        <option value="ENCERRADO">Encerrado</option>
                                    </select>
                                </div>
                            </div>
                            {lastConsultSummary && (
                                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                                    {lastConsultSummary}
                                </div>
                            )}
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Detalhes Juridicos</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <div className="space-y-1.5"><label className={labelClass}>Tribunal</label><input value={form.court} onChange={e => setForm({ ...form, court: e.target.value })} className={inputClass} placeholder="TJMG, TRF1, TRT3..." /></div>
                                <div className="space-y-1.5"><label className={labelClass}>Sistema</label><input value={form.courtSystem} onChange={e => setForm({ ...form, courtSystem: e.target.value })} className={inputClass} placeholder="PJe, Eproc, Projudi..." /></div>
                                <div className="space-y-1.5"><label className={labelClass}>Classe Processual</label><input value={form.class} onChange={e => setForm({ ...form, class: e.target.value })} className={inputClass} placeholder="Procedimento Comum, Execucao..." /></div>
                                <div className="space-y-1.5"><label className={labelClass}>Vara / Orgao</label><input value={form.vars} onChange={e => setForm({ ...form, vars: e.target.value })} className={inputClass} placeholder="2a Vara Civel" /></div>
                                <div className="space-y-1.5"><label className={labelClass}>Comarca</label><input value={form.district} onChange={e => setForm({ ...form, district: e.target.value })} className={inputClass} placeholder="Belo Horizonte" /></div>
                                <div className="space-y-1.5"><label className={labelClass}>Distribuicao</label><input type="date" value={form.distributionDate} onChange={e => setForm({ ...form, distributionDate: e.target.value })} className={inputClass} /></div>
                                <div className="space-y-1.5"><label className={labelClass}>Magistrado</label><input value={form.judge} onChange={e => setForm({ ...form, judge: e.target.value })} className={inputClass} placeholder="Dr. Joao da Silva" /></div>
                                <div className="space-y-1.5">
                                    <label className={labelClass}>Valor da Causa</label>
                                    <input value={masks.currency(Math.round(form.value * 100).toString())} onChange={e => {
                                        const raw = e.target.value.replace(/\D/g, '');
                                        setForm({ ...form, value: raw ? parseFloat(raw) / 100 : 0 });
                                    }} className={inputClass} placeholder="R$ 0,00" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Classificacao e Notas</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-1.5 min-w-[200px]">
                                    <label className={labelClass}>Area</label>
                                    <CreatableSelect value={form.area} onChange={val => setForm({ ...form, area: val })} options={DEFAULT_AREAS} placeholder="Selecione ou digite a area..." className="!bg-slate-950" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className={labelClass}>Assunto</label>
                                    <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className={inputClass} placeholder="Acao de Cobranca, Indenizacao..." />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className={labelClass}>Pasta na Nuvem</label>
                                <div className="flex flex-col gap-3 md:flex-row">
                                    <input value={form.folder} onChange={e => setForm({ ...form, folder: e.target.value })} className={inputClass} placeholder="Link da pasta Microsoft 365 ou caminho legado" />
                                    <button type="button" onClick={handleSyncMicrosoftFolder} disabled={!isEditing || syncingMicrosoftFolder || loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-sm font-medium text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-50">
                                        {syncingMicrosoftFolder ? <Loader2 size={16} className="animate-spin" /> : <FolderSync size={16} />}
                                        Criar/Sincronizar Pasta Microsoft 365
                                    </button>
                                    {form.folder && (
                                        <button type="button" onClick={() => window.open(form.folder, '_blank', 'noopener,noreferrer')} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-700">
                                            <ExternalLink size={16} />
                                            Abrir Pasta
                                        </button>
                                    )}
                                </div>
                                {form.folder && (
                                    <p className="text-xs text-slate-400">
                                        Visualizacao curta: <span className="font-mono text-indigo-300">{getOfficeFolderDisplayPath(form.folder)}</span>
                                    </p>
                                )}
                                <p className="text-xs text-slate-500">
                                    O teste do Microsoft 365 apenas valida acesso. Este botao cria ou sincroniza a pasta real do processo e suas subpastas padrao.
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <label className={labelClass}>Descricao / Objeto</label>
                                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={`${inputClass} min-h-[120px]`} placeholder="Descreva o objeto da acao ou do caso..." />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pb-6 border-t border-slate-800 pt-6">
                            <button type="button" onClick={() => navigate('/processes')} className="px-6 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition">Cancelar (ESC)</button>
                            <button type="button" onClick={() => void handleSubmit(false)} disabled={loading} className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-2 transition disabled:opacity-50 shadow-lg shadow-blue-500/20">
                                {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                Salvar
                            </button>
                            <button type="button" onClick={() => void handleSubmit(true)} disabled={loading} className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center gap-2 transition disabled:opacity-50 shadow-lg shadow-indigo-500/20">
                                {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                Salvar e Sair
                            </button>
                        </div>
                    </form>
                </div>

                {activeTab === 'PARTIES' && (
                    <div className="animate-in fade-in">
                        {isEditing ? (
                            <ProcessParties processId={id!} />
                        ) : (
                            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                                <div className="p-4 border-b border-slate-800 bg-slate-800/50">
                                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Visualizacao Previa: Partes Importadas</h3>
                                    <p className="text-xs text-slate-400 mt-1">Estas partes serao salvas e vinculadas ao processo assim que voce clicar em Salvar.</p>
                                </div>
                                <div className="divide-y divide-slate-800">
                                    {importedParties.map((party, idx) => (
                                        <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 border border-slate-700">
                                                    <Users size={20} />
                                                </div>
                                                <div>
                                                    <div className="font-medium text-white">{party.name}</div>
                                                    <div className="text-xs text-slate-500">{party.type} {party.document && `| ${party.document}`}</div>
                                                </div>
                                            </div>
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                                String(party.type || '').includes('ADVOG') ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 
                                                String(party.type || '').includes('AUTOR') ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                                'bg-slate-700/50 text-slate-400 border border-slate-600'
                                            }`}>
                                                {party.type}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'TIMELINE' && (
                    <div className="animate-in fade-in">
                        {isEditing ? (
                            <ProcessoAndamentos processId={id!} />
                        ) : (
                            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                                <div className="p-4 border-b border-slate-800 bg-slate-800/50">
                                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Visualizacao Previa: Ultimos Andamentos</h3>
                                    <p className="text-xs text-slate-400 mt-1">Os ultimos andamentos serao importados para a linha do tempo do processo.</p>
                                </div>
                                <div className="divide-y divide-slate-800">
                                    {importedMovements.map((mov, idx) => (
                                        <div key={idx} className="p-4 flex gap-4 hover:bg-slate-800/30 transition">
                                            <div className="min-w-[100px] text-xs text-slate-500 pt-1 font-mono">
                                                {mov.date ? new Date(mov.date).toLocaleDateString('pt-BR') : '-'}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-slate-200">{mov.description}</div>
                                                {mov.type && <div className="text-[10px] text-slate-600 uppercase mt-1">{mov.type}</div>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                
                {isEditing && activeTab === 'AGENDA' && <div className="animate-in fade-in"><ProcessAgenda processId={id!} /></div>}
            </div>
        </div>
    );
}
