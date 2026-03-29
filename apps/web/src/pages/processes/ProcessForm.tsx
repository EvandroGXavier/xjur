import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { toast } from 'sonner';
import {
    ArrowLeft,
    ArrowDownToLine,
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
    Gavel,
    Upload,
    User,
    Plus,
    DollarSign,
    Check,
    X,
    FolderOpen,
    Wand2,
} from 'lucide-react';
import { ContactPickerGlobal } from '../../components/contacts/ContactPickerGlobal';
import { masks } from '../../utils/masks';
import { ProcessParties } from './ProcessParties';
import { ProcessoAndamentos } from '../../components/processos/ProcessoAndamentos';
import { ProcessDocumentsTab } from '../../components/processos/ProcessDocumentsTab';
import { ProcessAgenda } from '../../components/processos/ProcessAgenda';
import { CreatableSelect } from '../../components/ui/CreatableSelect';
import { useHotkeys } from '../../hooks/useHotkeys';
import { clsx } from 'clsx';
import { getOfficeFolderDisplayPath } from '../../utils/officePath';
import { Financial } from '../Financial';
import { ImportedParty, CnjTimelineImportStatus, PdfDossierImportResult } from './types';

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

const DEFAULT_CATEGORIES = [
    { label: 'Extrajudicial', value: 'Extrajudicial' },
    { label: 'Judicial', value: 'Judicial' },
    { label: 'Administrativo', value: 'Administrativo' },
];

const DEFAULT_STATUSES = [
    { label: 'Ativo', value: 'ATIVO' },
    { label: 'Em Andamento', value: 'EM_ANDAMENTO' },
    { label: 'Suspenso', value: 'SUSPENSO' },
    { label: 'Arquivado', value: 'ARQUIVADO' },
    { label: 'Encerrado', value: 'ENCERRADO' },
    { label: 'Oportunidade', value: 'OPORTUNIDADE' },
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
    localFolder: '',
    code: '',
    metadata: null as any,
    workflowId: '',
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

const LAWYER_TERMS = ['ADVOGADO', 'PROCURADOR', 'DEFENSOR'];

const normalizeCnjDigits = (value?: string | null) => String(value || '').replace(/\D/g, '');

const formatMatchedSkillSummary = (drxSummary?: {
    matchedSkills?: Array<{ name?: string | null }>;
} | null) => {
    const names = Array.isArray(drxSummary?.matchedSkills)
        ? drxSummary.matchedSkills
              .map((skill) => String(skill?.name || '').trim())
              .filter(Boolean)
        : [];

    return names.length > 0 ? ` Skill aplicada: ${names.join(', ')}.` : '';
};

export function ProcessForm() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditing = !!id && id !== 'new';

    const [activeTab, setActiveTab] = useState('MAIN');
    const [loading, setLoading] = useState(false);
    const [syncingMicrosoftFolder, setSyncingMicrosoftFolder] = useState(false);
    const [localFolderStatus, setLocalFolderStatus] = useState<'idle'|'creating'|'opening'>('idle');
    const [consultingCnj, setConsultingCnj] = useState(false);
    const [checkingCnjTimelineStatus, setCheckingCnjTimelineStatus] = useState(false);
    const [importingCnjTimelines, setImportingCnjTimelines] = useState(false);
    const [isAddingAsAutor, setIsAddingAsAutor] = useState(true);
    const [importedParties, setImportedParties] = useState<ImportedParty[]>([]);
    const [importedMovements, setImportedMovements] = useState<any[]>([]);
    const [cnjTimelineStatus, setCnjTimelineStatus] = useState<CnjTimelineImportStatus | null>(null);
    const [savedProcessCnj, setSavedProcessCnj] = useState('');
    const [timelineRefreshToken, setTimelineRefreshToken] = useState(0);
    const [importingPdfDossier, setImportingPdfDossier] = useState(false);
    const [lastPdfImportSummary, setLastPdfImportSummary] = useState('');

    const [dynamicOptions, setDynamicOptions] = useState({
        categories: DEFAULT_CATEGORIES,
        statuses: DEFAULT_STATUSES,
        areas: DEFAULT_AREAS,
    });

    const [lastConsultSummary, setLastConsultSummary] = useState('');
    const [form, setForm] = useState(EMPTY_FORM);
    const [workflows, setWorkflows] = useState<any[]>([]);

    const loadDynamicOptions = async () => {
        try {
            const { data } = await api.get('/processes/filters/options');
            if (data) {
                const mapToOptions = (items: string[], defaults: { label: string, value: string }[]) => {
                    const existingVals = new Set(defaults.map(d => d.value.toUpperCase()));
                    const newOps = items
                        .filter(i => !existingVals.has(i.toUpperCase()))
                        .map(i => ({ label: i, value: i }));
                    return [...defaults, ...newOps];
                };

                setDynamicOptions({
                    categories: mapToOptions(data.categories || [], DEFAULT_CATEGORIES),
                    statuses: mapToOptions(data.statuses || [], DEFAULT_STATUSES),
                    areas: mapToOptions(data.areas || [], DEFAULT_AREAS),
                });
            }
        } catch (error) {
            console.error('Failed to load dynamic options', error);
        }
    };

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const res = await api.get('/workflows');
                if (res.data && Array.isArray(res.data)) {
                    setWorkflows(res.data.filter((w: any) => w.isActive) || []);
                }
            } catch (error) {
                console.error('Failed to load workflows', error);
            }
        };

        void fetchInitialData();
        void loadDynamicOptions();

        if (isEditing) {
            void fetchProcess();
            void fetchCnjTimelineStatus(id);
            return;
        }

        setCnjTimelineStatus(null);
        setSavedProcessCnj('');
        setLastPdfImportSummary('');
    }, [id, isEditing]);

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
        localFolder: payload.localFolder || form.localFolder,
        workflowId: form.workflowId,
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
            if (!data) throw new Error('Dados do processo não encontrados');

            setSavedProcessCnj(String(data.cnj || ''));
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
                value: data.value ? parseFloat(String(data.value)) : 0,
                description: data.description || '',
                folder: data.folder || data.msFolderUrl || '',
                localFolder: data.localFolder || '',
                code: data.code || '',
                metadata: data.metadata || null,
                workflowId: data.workflowId || '',
            });
            setImportedParties(Array.isArray(data.parties) ? data.parties : []);
            setImportedMovements(Array.isArray(data.movements) ? data.movements : []);
            
            setLastConsultSummary(
                Array.isArray(data.processParties) && data.processParties.length > 0
                    ? `${data.processParties.length} parte(s) sincronizadas`
                    : Array.isArray(data.parties) && data.parties.length > 0
                    ? `${data.parties.length} parte(s) prontas`
                    : '',
            );

            const pdfImport = data.metadata?.pdfDossierImport;
            setLastPdfImportSummary(
                pdfImport
                    ? `${pdfImport.importedCount || 0} andamentos extraídos do PDF.`
                    : '',
            );
        } catch (error: any) {
            console.error('Erro ao buscar processo:', error);
            toast.error('Erro ao carregar dados do processo para edição.');
            // Não redirige imediatamente para dar chance de ver o erro
        } finally {
            setLoading(false);
        }
    };

    const handleToggleImportedPartyStatus = (idx: number) => {
        setImportedParties(prev => prev.map((party, i) => {
            if (idx !== i) return party;
            
            const isLawyer = LAWYER_TERMS.some(term => party.type.toUpperCase().includes(term));
            if (isLawyer) return party;

            if (!party.isClient && !party.isOpposing) {
                return { ...party, isClient: true, isOpposing: false };
            } else if (party.isClient) {
                return { ...party, isClient: false, isOpposing: true };
            } else {
                return { ...party, isClient: false, isOpposing: false };
            }
        }));
    };

    const fetchCnjTimelineStatus = async (processId?: string) => {
        if (!processId) return;

        try {
            setCheckingCnjTimelineStatus(true);
            const res = await api.get(`/processes/${processId}/cnj-movements/status`);
            setCnjTimelineStatus(res.data);
        } catch (error) {
            console.error('Error fetching CNJ timeline status:', error);
            setCnjTimelineStatus(null);
        } finally {
            setCheckingCnjTimelineStatus(false);
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

        // NOVO: Validar Cliente Principal
        const hasClient = importedParties.some(p => p.isClient || (p.type && p.type.toUpperCase().includes('CLIENTE')));
        if (!hasClient) {
            toast.warning('Bloqueio de Segurança: Não é possível salvar um processo sem um Cliente Principal vinculado.', {
                description: 'Use o campo "Cliente Principal" na aba Identificação ou marque uma das partes como Cliente na aba Partes.',
                duration: 6000
            });
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
                await fetchProcess();
                await fetchCnjTimelineStatus(id);
                loadDynamicOptions(); // Atualizar opções dinâmicas
                if (shouldClose) navigate('/processes');
            } else {
                const res = await api.post('/processes', payload);
                toast.success('Processo criado!');
                loadDynamicOptions(); // Atualizar opções dinâmicas
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

    const handleImportCnjTimelines = async () => {
        if (!id) {
            toast.warning('Salve o processo antes de importar os andamentos oficiais.');
            return;
        }

        try {
            setImportingCnjTimelines(true);
            const response = await api.post(`/processes/${id}/cnj-movements/import`);
            const importedCount = Number(response.data?.importedCount || 0);
            const skippedCount = Number(response.data?.skippedCount || 0);

            toast.success(importedCount > 0 ? 'Andamentos oficiais importados.' : 'Nenhum novo andamento para importar.', {
                description:
                    importedCount > 0
                        ? `${importedCount} novo(s) andamento(s) adicionados e ${skippedCount} ja existente(s) preservados.`
                        : response.data?.message || 'O historico atual do processo foi preservado.',
            });

            setActiveTab('TIMELINE');
            setTimelineRefreshToken((current) => current + 1);
            await fetchProcess();
            await fetchCnjTimelineStatus(id);
        } catch (error: any) {
            toast.error(
                error?.response?.data?.message ||
                    error?.message ||
                    'Nao foi possivel importar os andamentos do CNJ.',
            );
        } finally {
            setImportingCnjTimelines(false);
        }
    };

    const handleImportProcessPdf = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file) {
            return;
        }

        if (file.type !== 'application/pdf') {
            toast.warning('Envie um arquivo PDF valido do processo.');
            return;
        }

        try {
            setImportingPdfDossier(true);
            const formData = new FormData();
            formData.append('file', file);

            const endpoint = isEditing && id ? `/processes/${id}/pdf-dossier/import` : '/processes/pdf-dossier/import';
            const response = await api.post(endpoint, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const result = response.data as PdfDossierImportResult;

            setLastPdfImportSummary(
                `${result.importedCount || 0} andamento(s) novo(s) a partir do PDF do processo, ${result.explicitFatalDateCount || 0} com prazo fatal expresso e ${result.cnjMovementCount || 0} movimento(s) oficiais considerados em paralelo.${formatMatchedSkillSummary(result.drxSummary)}`,
            );

            toast.success(result.importedCount > 0 ? 'PDF do processo importado com sucesso.' : 'PDF analisado sem novos andamentos.', {
                description:
                    result.message ||
                    `${result.importedCount || 0} registro(s) novo(s), ${result.skippedCount || 0} ja existente(s) preservado(s).`,
            });

            if (result.drxSummary?.answer) {
                toast.info('DrX-Claw gerou uma leitura operacional do processo.', {
                    description: `${result.drxSummary.answer.slice(0, 220)}${formatMatchedSkillSummary(result.drxSummary)}`.trim(),
                    duration: 10000,
                });
            }

            if (!isEditing && result.processId) {
                navigate(`/processes/${result.processId}`);
                return;
            }

            setActiveTab('PARTIES');
            setTimelineRefreshToken((current) => current + 1);
            await fetchProcess();
            if (id) {
                await fetchCnjTimelineStatus(id);
            }
        } catch (error: any) {
            toast.error(
                error?.response?.data?.message ||
                    error?.message ||
                    'Nao foi possivel importar o PDF do processo.',
            );
        } finally {
            setImportingPdfDossier(false);
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
                    localFolder: process.localFolder || current.localFolder,
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

    const handleSuggestLocalFolder = () => {
        if (!form.code) {
           toast.warning('O Registro Interno (ID) ainda não foi gerado. Salve o processo primeiro para usar a sugestão automática baseada no número do caso.');
           return null;
        }

        const baseDir = 'Z:';
        
        // Extrair nome do cliente das partes importadas
        const clientParty = importedParties.find(p => p.type === 'CLIENTE' || p.isClient);
        const clientName = clientParty ? clientParty.name.replace(/[<>:"\/\\|?*]/g, '').trim() : 'CLIENTE_NAO_IDENTIFICADO';
        
        const areaName = form.area ? form.area.replace(/[<>:"\/\\|?*]/g, '').trim() : 'GERAL';
        const internalId = form.code;
        
        // Padrão: Z:\NOME_CLIENTE\Area\REGISTRO_INTERNO
        const fullPath = `${baseDir}\\${clientName}\\${areaName}\\${internalId}`;
        
        setForm(current => ({ ...current, localFolder: fullPath }));
        return fullPath;
    };

    const handlePickLocalFolder = async () => {
        try {
            setLocalFolderStatus('opening');
            const res = await api.get('/processes/local-folder/pick');
            if (res.data?.success && res.data.path) {
                setForm(prev => ({ ...prev, localFolder: res.data.path }));
                toast.success('Pasta selecionada!');
            } else if (res.data?.message) {
                toast.info(res.data.message);
            }
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Erro ao abrir o seletor de pastas do Windows.');
        } finally {
            setLocalFolderStatus('idle');
        }
    };

    const handleCreateLocalFolder = async () => {
        let folderToCreate = form.localFolder;
        if (!folderToCreate) {
            folderToCreate = handleSuggestLocalFolder() || '';
            if (!folderToCreate) return;
        }
        if (!isEditing || !id) {
            toast.warning('Salve o processo no sistema antes de criar a pasta vinculada!');
            return;
        }

        try {
            setLocalFolderStatus('creating');
            const res = await api.post(`/processes/${id}/local-folder`, { path: folderToCreate });
            if (res.data?.success) {
                toast.success(res.data.message || 'Diretório vinculado.');
                setForm(prev => ({ ...prev, localFolder: res.data.localFolder }));
            }
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Erro ao criar diretório local.');
        } finally {
            setLocalFolderStatus('idle');
        }
    };

    const handleOpenLocalFolder = async () => {
        if (!form.localFolder || !id) return;
        
        // Se o que está na tela for diferente do que foi salvo, avisa para lincar
        try {
            setLocalFolderStatus('opening');
            const res = await api.post(`/processes/${id}/local-folder/open`);
            if (res.data?.success) toast.success('Windows Explorer aberto!', { duration: 1500 });
        } catch (error: any) {
            console.error('Erro ao abrir pasta', error);
            const msg = error?.response?.data?.message || '';
            if (msg.includes('DB vazio') || msg.includes('não configurada')) {
                toast.error('Este caminho ainda não foi vinculado ao processo. Clique em "Vincular" primeiro!');
            } else {
                toast.error(msg || 'Falha ao abrir pasta no Windows Explorer.');
            }
        } finally {
            setLocalFolderStatus('idle');
        }
    };

    if (loading && isEditing && !form.title) {
        return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>;
    }

    const inputClass = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors placeholder-slate-600';
    const labelClass = 'text-sm font-medium text-slate-300';
    const hasUnsavedCnjChange = isEditing && normalizeCnjDigits(form.cnj) !== normalizeCnjDigits(savedProcessCnj);
    const shouldShowCnjTimelineCard = isEditing || form.category === 'JUDICIAL' || Boolean(form.cnj);
    const cnjTimelineCardState = !isEditing
        ? {
              canImport: false,
              message: 'Salve o processo para liberar a importacao incremental dos andamentos oficiais do CNJ.',
              actionLabel: 'Salvar para habilitar',
              newMovementCount: 0,
              totalAvailableCount: 0,
              importedTimelineCount: 0,
              lastSourceUpdateAt: null,
              sourceSystem: null,
              sourceCourt: null,
          }
        : hasUnsavedCnjChange
        ? {
              canImport: false,
              message: 'O numero CNJ foi alterado. Salve o processo para consultar e importar o historico correto.',
              actionLabel: 'Salvar para atualizar CNJ',
              newMovementCount: 0,
              totalAvailableCount: 0,
              importedTimelineCount: cnjTimelineStatus?.importedTimelineCount || 0,
              lastSourceUpdateAt: cnjTimelineStatus?.lastSourceUpdateAt || null,
              sourceSystem: cnjTimelineStatus?.sourceSystem || null,
              sourceCourt: cnjTimelineStatus?.sourceCourt || null,
          }
        : cnjTimelineStatus;
    const cnjTimelineCardClass = cnjTimelineCardState?.canImport
        ? 'border-emerald-500/20 bg-emerald-500/10'
        : 'border-amber-500/20 bg-amber-500/10';
    const cnjTimelineBadgeClass = cnjTimelineCardState?.canImport
        ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200'
        : 'border-amber-500/30 bg-amber-500/15 text-amber-100';
    const pdfDossierInputId = isEditing ? `process-dossier-upload-${id}` : 'process-dossier-upload';
    const pdfDossierInputControlId = `${pdfDossierInputId}-control`;

    const TabButton = ({ tabId, label, icon: Icon, hasIndicator }: any) => (
        <button
            type="button"
            onClick={() => setActiveTab(tabId)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition relative ${
                activeTab === tabId
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
        >
            <Icon size={16} />
            {label}
            {hasIndicator && (
                <span className="absolute top-2 right-1.5 w-2 h-2 bg-amber-500 rounded-full border border-slate-900 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
            )}
        </button>
    );

    const hasUnclassifiedParties = Array.isArray(importedParties)
        ? importedParties.some((party) => {
              if (!party) return false;
              const partyType = String(party.type || '').toUpperCase();
              const isLawyer = LAWYER_TERMS.some((term) => partyType.includes(term));
              if (isLawyer) return false;
              return !party.isClient && !party.isOpposing;
          })
        : false;

    return (
        <div className="p-6 md:p-8 animate-in fade-in">
            <input
                id={pdfDossierInputControlId}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(event) => void handleImportProcessPdf(event)}
            />
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
                <div className="flex border-b border-slate-800 mb-6 overflow-x-auto scroller-hidden">
                    <TabButton tabId="MAIN" label="PRINCIPAL" icon={FileText} />
                    <TabButton tabId="TJ" label="TJ" icon={Gavel} />
                    {(isEditing || importedParties.length > 0) && <TabButton tabId="PARTIES" label="PARTES" icon={Users} hasIndicator={hasUnclassifiedParties} />}
                    {(isEditing || importedMovements.length > 0) && <TabButton tabId="TIMELINE" label="ANDAMENTOS" icon={Activity} />}
                    {isEditing && <TabButton tabId="DOCUMENTS" label="DOCUMENTOS" icon={FolderOpen} />}
                    {isEditing && <TabButton tabId="AGENDA" label="AGENDA" icon={Calendar} />}
                    {isEditing && <TabButton tabId="FINANCIAL" label="FINANCEIRO" icon={DollarSign} />}
                </div>
            )}

            <div className="max-w-5xl">
                {!isEditing && importedParties.length === 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 animate-in slide-in-from-top-4 duration-500">
                        {/* IA Import Card */}
                        <div 
                            role="button"
                            tabIndex={0}
                            onClick={() => document.getElementById(pdfDossierInputControlId)?.click()}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') document.getElementById(pdfDossierInputControlId)?.click(); }}
                            className="group relative overflow-hidden bg-slate-900 border border-slate-700 rounded-2xl p-6 hover:border-indigo-500/50 hover:bg-slate-800/50 transition cursor-pointer shadow-lg outline-none focus:ring-2 focus:ring-indigo-500/50"
                        >
                            <div className="absolute top-0 right-0 p-2 bg-indigo-500 text-white text-[10px] font-bold rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity">POWERED BY DR.X</div>
                            <div className="flex items-center gap-5">
                                <div className="p-4 bg-indigo-500/10 text-indigo-400 rounded-2xl group-hover:scale-110 transition-transform">
                                    <Upload size={28} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">Importar PDF (IA)</h3>
                                    <p className="text-slate-400 text-sm mt-1">Carregar petição inicial ou capa para extração automática.</p>
                                </div>
                            </div>
                        </div>

                        {/* CNJ Search Card */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-amber-500/50 transition shadow-lg">
                            <div className="flex items-center gap-5">
                                <div className="p-4 bg-amber-500/10 text-amber-400 rounded-2xl">
                                    <Search size={28} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-white mb-2">Sincronização Judicial</h3>
                                    <div className="flex gap-2">
                                        <input 
                                            value={form.cnj} 
                                            onChange={e => setForm({...form, cnj: masks.cnj(e.target.value)})} 
                                            placeholder="CNJ (0000000-00...)"
                                            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 transition"
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => handleConsultCnj(false)}
                                            disabled={consultingCnj}
                                            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-bold shadow-md transition disabled:opacity-50"
                                        >
                                            {consultingCnj ? <Loader2 size={16} className="animate-spin" /> : 'Consultar'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                <div className={activeTab === 'MAIN' ? 'block' : 'hidden'}>
                    <form onSubmit={e => { e.preventDefault(); void handleSubmit(true); }} className="space-y-6">
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Identificacao</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <label className={labelClass}>Titulo / Nome do Caso *</label>
                                    <input id="focus-title" autoFocus value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={inputClass} placeholder="Ex: Ação de Cobrança - João vs Maria" required />
                                </div>
                                {!isEditing && (
                                    <div className="space-y-1.5">
                                    <div className="flex items-center justify-between mb-1">
                                        <label className={labelClass}>Cliente Principal</label>
                                        <label className="flex items-center gap-1.5 cursor-pointer group">
                                            <input 
                                                type="checkbox" 
                                                checked={isAddingAsAutor} 
                                                onChange={e => setIsAddingAsAutor(e.target.checked)}
                                                className="w-3 h-3 rounded border-slate-700 bg-slate-800 text-indigo-500 focus:ring-0 focus:ring-offset-0 transition-colors"
                                            />
                                            <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-300 transition-colors uppercase tracking-wider">
                                                {isAddingAsAutor ? 'Adicionar como Autor' : 'Adicionar como Réu'}
                                            </span>
                                        </label>
                                    </div>
                                    <ContactPickerGlobal 
                                        hideContactLabel={true}
                                        onAdd={async (data) => {
                                            setImportedParties([{ 
                                                name: data.contactName || '', 
                                                type: isAddingAsAutor ? 'AUTOR' : 'REU', 
                                                isClient: true,
                                                isOpposing: !isAddingAsAutor
                                            }]);
                                            if (!form.title) setForm(prev => ({ ...prev, title: `Ação - ${data.contactName}` }));
                                        }}
                                        onSelectContact={(cid, cname) => {
                                            setImportedParties([{ 
                                                name: cname || '', 
                                                type: isAddingAsAutor ? 'AUTOR' : 'REU', 
                                                isClient: true, 
                                                isOpposing: !isAddingAsAutor
                                            }]);
                                            if (!form.title) setForm(prev => ({ ...prev, title: `Ação - ${cname}` }));
                                        }}
                                        hideRole={true}
                                        hideQualification={true}
                                        className="!bg-slate-950 shadow-inner border-slate-800/50"
                                    />
                                </div>
                                )}
                                <div className="grid grid-cols-2 gap-5">
                                    <div className="space-y-1.5">
                                        <label className={labelClass}>Categoria</label>
                                        <CreatableSelect 
                                            value={form.category} 
                                            onChange={val => setForm({ ...form, category: val })} 
                                            onCreate={newVal => setDynamicOptions(prev => ({ ...prev, categories: [...prev.categories, { label: newVal, value: newVal }] }))}
                                            options={dynamicOptions.categories} 
                                            placeholder="Selecione ou digite..." 
                                            className="!bg-slate-950" 
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className={labelClass}>Status</label>
                                        <CreatableSelect 
                                            value={form.status} 
                                            onChange={val => setForm({ ...form, status: val })} 
                                            onCreate={newVal => setDynamicOptions(prev => ({ ...prev, statuses: [...prev.statuses, { label: newVal, value: newVal }] }))}
                                            options={dynamicOptions.statuses} 
                                            placeholder="Selecione ou digite..." 
                                            className="!bg-slate-950" 
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Classificacao e Notas</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <div className="space-y-1.5">
                                    <label className={labelClass}>Registro Interno (ID)</label>
                                    <div className="bg-slate-950 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-indigo-300 font-mono font-bold">
                                        {form.code || (isEditing ? 'GERANDO...' : 'SERÁ GERADO AO SALVAR')}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className={labelClass}>Area</label>
                                    <CreatableSelect 
                                        value={form.area} 
                                        onChange={val => setForm({ ...form, area: val })} 
                                        onCreate={newVal => setDynamicOptions(prev => ({ ...prev, areas: [...prev.areas, { label: newVal, value: newVal }] }))}
                                        options={dynamicOptions.areas} 
                                        placeholder="Selecione..." 
                                        className="!bg-slate-950" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className={labelClass}>Assunto</label>
                                    <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className={inputClass} placeholder="Acao de Cobranca..." />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-1 gap-5">
                                <div className="space-y-1.5">
                                    <label className={labelClass}>Esteira de Trabalho (Workflow Inicial)</label>
                                    <select 
                                        value={form.workflowId || ''} 
                                        onChange={e => setForm({ ...form, workflowId: e.target.value })} 
                                        className={inputClass}
                                        disabled={isEditing}
                                    >
                                        <option value="">{isEditing ? 'Configurada no início (Inalterável)' : 'Padrão do Sistema (se houver)'}</option>
                                        {workflows.map(wf => (
                                            <option key={wf.id} value={wf.id}>{wf.name} {wf.isDefault ? '(Padrão)' : ''}</option>
                                        ))}
                                    </select>
                                    {!isEditing && <p className="text-xs text-slate-500 mt-1">A esteira criará automaticamente as tarefas (andamentos) sequenciais para guiar este processo.</p>}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className={labelClass}>Pasta na Nuvem</label>
                                <div className="flex flex-col gap-3 md:flex-row">
                                    <input value={form.folder} onChange={e => setForm({ ...form, folder: e.target.value })} className={inputClass} placeholder="Link da pasta Microsoft 365 ou caminho legado" />
                                    <button type="button" onClick={handleSyncMicrosoftFolder} disabled={!isEditing || syncingMicrosoftFolder || loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-sm font-medium text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-50">
                                        {syncingMicrosoftFolder ? <Loader2 size={16} className="animate-spin" /> : <FolderSync size={16} />}
                                        Criar/Sincronizar Pasta
                                    </button>
                                </div>
                                {form.folder && (
                                    <p className="text-xs text-slate-400">
                                        Visualizacao curta: <span className="font-mono text-indigo-300">{getOfficeFolderDisplayPath(form.folder)}</span>
                                    </p>
                                )}
                            </div>

                            <div className="space-y-1.5 p-4 bg-slate-950/50 rounded-xl border border-slate-800/80">
                                <label className={labelClass}>
                                    Pasta Local (Computador)
                                    <span className="ml-2 text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">Windows Explorer nativo</span>
                                </label>
                                <div className="flex flex-col gap-3 md:flex-row">
                                    <div className="relative flex-1">
                                        <input 
                                            value={form.localFolder} 
                                            onChange={e => setForm({ ...form, localFolder: e.target.value })} 
                                            className={`${inputClass} pr-12`} 
                                            placeholder="Ex: C:\Processos\João_vs_Maria" 
                                        />
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                            <button 
                                                type="button" 
                                                onClick={handlePickLocalFolder}
                                                disabled={localFolderStatus !== 'idle'}
                                                title="Escolher Pasta Existente no Explorer"
                                                className="text-amber-400 hover:text-amber-300 p-1.5 rounded-md hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                                            >
                                                {localFolderStatus === 'opening' ? <Loader2 size={16} className="animate-spin" /> : <Search size={18} />}
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={handleSuggestLocalFolder}
                                                title="Sugerir Caminho Inteligente (Z:)"
                                                className="text-emerald-400 hover:text-emerald-300 p-1.5 rounded-md hover:bg-emerald-500/10 transition-colors"
                                            >
                                                <Wand2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {!form.localFolder ? (
                                        <button 
                                            type="button" 
                                            onClick={handleCreateLocalFolder} 
                                            disabled={!isEditing || localFolderStatus !== 'idle'} 
                                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-2.5 text-sm font-medium text-indigo-300 transition hover:bg-indigo-500/20 disabled:opacity-50 min-w-[180px]"
                                        >
                                            {localFolderStatus === 'creating' ? <Loader2 size={16} className="animate-spin" /> : <FolderOpen size={16} />}
                                            Criar Diretório no PC
                                        </button>
                                    ) : (
                                        <button 
                                            type="button" 
                                            onClick={handleOpenLocalFolder} 
                                            disabled={!isEditing || localFolderStatus !== 'idle'} 
                                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/20 px-4 py-2.5 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/30 hover:scale-105 disabled:opacity-50 min-w-[180px] shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                                        >
                                            {localFolderStatus === 'opening' ? <Loader2 size={16} className="animate-spin" /> : <FolderOpen size={16} />}
                                            Abrir no Explorer
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className={labelClass}>Descricao / Objeto</label>
                                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={`${inputClass} min-h-[120px]`} placeholder="Descreva o objeto da acao ou do caso..." />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pb-6 border-t border-slate-800 pt-6">
                            <button type="button" onClick={() => navigate('/processes')} className="px-6 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition">Cancelar (ESC)</button>
                            <button type="button" onClick={() => void handleSubmit(true)} disabled={loading} className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center gap-2 transition disabled:opacity-50 shadow-lg shadow-indigo-500/20">
                                {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                Salvar Tudo
                            </button>
                        </div>
                    </form>
                </div>

                <div className={activeTab === 'TJ' ? 'block' : 'hidden'}>
                    <div className="space-y-6">
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Identificacao Judicial</h3>
                            <div className="max-w-md">
                                <div className="space-y-1.5">
                                    <label className={labelClass}>Numero CNJ</label>
                                    <div className="flex gap-2">
                                        <input value={form.cnj} onChange={e => setForm({ ...form, cnj: masks.cnj(e.target.value) })} className={`${inputClass} font-mono text-lg`} placeholder="0000000-00.0000.0.00.0000" />
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
                            </div>

                            {lastConsultSummary && (
                                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                                    {lastConsultSummary}
                                </div>
                            )}

                            {shouldShowCnjTimelineCard && (
                                <div className="grid gap-4 xl:grid-cols-2">
                                    <div className={`rounded-xl border px-4 py-4 ${cnjTimelineCardClass}`}>
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="space-y-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-sm font-semibold text-white">CNJ / Andamentos Oficiais</span>
                                                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cnjTimelineBadgeClass}`}>
                                                        {checkingCnjTimelineStatus
                                                            ? 'Verificando'
                                                            : cnjTimelineCardState?.canImport
                                                            ? 'Pronto para sincronizar'
                                                            : 'Bloqueado'}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-200">
                                                    {checkingCnjTimelineStatus
                                                        ? 'Validando a comunicacao com o CNJ/DataJud para este processo...'
                                                        : cnjTimelineCardState?.message || 'Sem informacoes sobre a sincronizacao oficial.'}
                                                </p>
                                                <div className="flex flex-wrap gap-3 text-xs text-slate-300">
                                                    <span className="rounded-md border border-white/10 bg-black/10 px-2 py-1">
                                                        Andamentos oficiais: {cnjTimelineCardState?.totalAvailableCount || 0}
                                                    </span>
                                                    <span className="rounded-md border border-white/10 bg-black/10 px-2 py-1">
                                                        Ja importados: {cnjTimelineCardState?.importedTimelineCount || 0}
                                                    </span>
                                                    <span className="rounded-md border border-white/10 bg-black/10 px-2 py-1">
                                                        Novos agora: {cnjTimelineCardState?.newMovementCount || 0}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex min-w-[240px] flex-col gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => void handleImportCnjTimelines()}
                                                    disabled={
                                                        !cnjTimelineCardState?.canImport ||
                                                        importingCnjTimelines ||
                                                        checkingCnjTimelineStatus
                                                    }
                                                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-sky-400/30 bg-sky-500/15 px-4 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    {importingCnjTimelines ? (
                                                        <Loader2 size={17} className="animate-spin" />
                                                    ) : (
                                                        <ArrowDownToLine size={17} />
                                                    )}
                                                    {cnjTimelineCardState?.actionLabel || 'Buscar andamentos do CNJ'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void fetchCnjTimelineStatus(id)}
                                                    disabled={!isEditing || checkingCnjTimelineStatus || importingCnjTimelines}
                                                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
                                                >
                                                    {checkingCnjTimelineStatus ? (
                                                        <Loader2 size={16} className="animate-spin" />
                                                    ) : (
                                                        <RefreshCcw size={16} />
                                                    )}
                                                    Atualizar status do CNJ
                                                </button>
                                                <p className="text-xs text-slate-400">
                                                    Fluxo pensado para o advogado: consulta a disponibilidade oficial, importa somente novidades e preserva os andamentos ja tratados.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-4">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="space-y-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-sm font-semibold text-white">PDF Integral do Processo</span>
                                                </div>
                                                <p className="text-sm text-slate-200">
                                                    Detecta `PJe` ou `Eproc`, cadastra ou atualiza o processo pelo CNJ e importa andamentos.
                                                </p>
                                                {lastPdfImportSummary && (
                                                    <p className="text-xs text-violet-100/90 font-medium">
                                                        {lastPdfImportSummary}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex min-w-[240px] flex-col gap-2">
                                                <label
                                                    htmlFor={pdfDossierInputControlId}
                                                    className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-violet-400/30 bg-violet-500/15 px-4 py-3 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/25 ${importingPdfDossier ? 'pointer-events-none opacity-60' : ''}`}
                                                >
                                                    {importingPdfDossier ? (
                                                        <Loader2 size={17} className="animate-spin" />
                                                    ) : (
                                                        <FileText size={17} />
                                                    )}
                                                    {importingPdfDossier ? 'Importando...' : 'Importar PDF do processo'}
                                                </label>
                                            </div>
                                        </div>
                                    </div>
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

                        <div className="flex justify-end gap-3 pb-6 border-t border-slate-800 pt-6">
                            <button type="button" onClick={() => void handleSubmit(true)} disabled={loading} className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-2 transition disabled:opacity-50">
                                {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                Salvar Tudo
                            </button>
                        </div>
                    </div>
                </div>

                        {activeTab === 'PARTIES' && (
                    <div className="animate-in fade-in">
                        {isEditing ? (
                            <ProcessParties 
                                processId={id!} 
                                onPartiesChange={(newParties) => {
                                    const mapped = newParties.map(p => ({
                                        name: p.contact?.name || '',
                                        type: p.role?.name || '',
                                        isClient: !!p.isClient,
                                        isOpposing: !!p.isOpposing,
                                        document: p.contact?.document || ''
                                    }));
                                    setImportedParties(mapped);
                                }}
                            />
                        ) : (
                            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                                <div className="p-4 border-b border-slate-800 bg-slate-800/50">
                                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Visualizacao Previa: Partes Importadas</h3>
                                    <p className="text-xs text-slate-400 mt-1">Estas partes serao salvas e vinculadas ao processo assim que voce clicar em Salvar.</p>
                                </div>
                                <div className="divide-y divide-slate-800">
                                    {importedParties.map((party, idx) => {
                                        const partyType = String(party?.type || '').toUpperCase();
                                        const isLawyer = LAWYER_TERMS.some(term => partyType.includes(term));
                                        return (
                                            <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition">
                                                <div className="flex items-center gap-3">
                                                    {!isLawyer && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleImportedPartyStatus(idx)}
                                                            className={clsx(
                                                                'w-6 h-6 flex items-center justify-center rounded-lg border transition-all active:scale-90 shrink-0',
                                                                party.isClient
                                                                    ? 'bg-emerald-500 text-white border-emerald-400'
                                                                    : party.isOpposing
                                                                      ? 'bg-red-500 text-white border-red-400'
                                                                      : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500',
                                                            )}
                                                            title="Alternar Status (Cliente / Contrario / Neutro)"
                                                        >
                                                            {party.isClient ? <Check size={12} /> : party.isOpposing ? <X size={12} /> : <Plus size={12} />}
                                                        </button>
                                                    )}
                                                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 border border-slate-700">
                                                        <Users size={20} />
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-white">{party.name}</div>
                                                        <div className="text-xs text-slate-500">{party.type} {party.document && `| ${party.document}`}</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {party.isClient && <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">CLIENTE</span>}
                                                    {party.isOpposing && <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">CONTRARIO</span>}
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                                        isLawyer ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 
                                                        String(party.type || '').includes('AUTOR') ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                                        'bg-slate-700/50 text-slate-400 border border-slate-600'
                                                    }`}>
                                                        {party.type}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'TIMELINE' && (
                    <div className="animate-in fade-in">
                        {isEditing ? (
                            <ProcessoAndamentos key={`${id}-${timelineRefreshToken}`} processId={id!} />
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

                {isEditing && activeTab === 'DOCUMENTS' && (
                    <div className="animate-in fade-in">
                        <ProcessDocumentsTab processId={id!} />
                    </div>
                )}
                
                {isEditing && activeTab === 'AGENDA' && <div className="animate-in fade-in"><ProcessAgenda processId={id!} /></div>}

                {isEditing && activeTab === 'FINANCIAL' && (
                    <div className="animate-in fade-in">
                        <Financial processContext={{ id: id!, title: form.title, cnj: form.cnj, code: form.code }} />
                    </div>
                )}
            </div>
        </div>
    );
}
