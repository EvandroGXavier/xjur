import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
    Plus, 
    List, 
    Search, 
    Filter, 
    Kanban,
    FileText,
    Gavel,
    Trash2,
    MoreHorizontal,
    Pencil,
    Trash,
    ExternalLink,
    Settings,
    MessageCircle,
    Phone as PhoneIcon,
    Mail,
    ChevronDown,
    ChevronRight,
    Activity,
    Calendar,
    Users,
    CornerDownRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { masks } from '../../utils/masks';
import { DataGrid } from '../../components/ui/DataGrid';
import { InlineTags } from '../../components/ui/InlineTags';
import { AdvancedTagFilter } from '../../components/ui/AdvancedTagFilter';
import { DateRangePicker } from '../../components/ui/DateRangePicker';
import {
    AdvancedProcessFilterModal,
    countActiveProcessAdvancedFilters,
    EMPTY_PROCESS_ADVANCED_FILTER,
    pruneProcessAdvancedFilter,
    stripProcessAdvancedFilterIds,
    type ProcessAdvancedFilterGroup,
    type ProcessAdvancedFilterOptions,
} from '../../components/processos/AdvancedProcessFilterModal';
import { HelpModal, useHelpModal } from '../../components/HelpModal';
import { helpProcesses } from '../../data/helpManuals';
import { useHotkeys } from '../../hooks/useHotkeys';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { differenceInYears, differenceInMonths, differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getOfficeFolderDisplayPath } from '../../utils/officePath';

interface Process {
    id: string;
    cnj?: string;
    title: string;
    client?: string;
    court?: string;
    courtSystem?: string;
    vars?: string;
    district?: string;
    judge?: string;
    area?: string;
    subject?: string;
    status: string;
    category?: 'JUDICIAL' | 'EXTRAJUDICIAL';
    value?: number;
    distributionDate?: string;
    folder?: string;
    localFolder?: string;
    code?: string;
    responsibleLawyer?: string;
    createdAt: string;
    updatedAt: string;
    timeline?: { date: string; title?: string; description?: string }[];
    processParties?: {
        id: string;
        isClient: boolean;
        isOpposing: boolean;
        contact: {
            id: string;
            name: string;
            email?: string;
            phone?: string;
            whatsapp?: string;
        }
        role?: { name: string; category?: string };
        qualification?: { name: string };
        representativeLinks?: {
            id: string;
            representativeParty: {
                id: string;
                contact: {
                    id: string;
                    name: string;
                    email?: string;
                    phone?: string;
                    whatsapp?: string;
                }
                role?: { name: string };
            }
        }[];
    }[];
}

export function ProcessList() {
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState<'KANBAN' | 'LIST'>('LIST');
    const [processes, setProcesses] = useState<Process[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebouncedValue(searchTerm, 250);
    const [statusFilter, setStatusFilter] = useState<'ATIVO' | 'INATIVO' | 'ALL'>('ATIVO');
    const [updatedRange, setUpdatedRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
    const [includedTags, setIncludedTags] = useState<string[]>([]);
    const [excludedTags, setExcludedTags] = useState<string[]>([]);
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null); // For dropdown
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [advancedFilter, setAdvancedFilter] = useState<ProcessAdvancedFilterGroup>(EMPTY_PROCESS_ADVANCED_FILTER);
    const [draftAdvancedFilter, setDraftAdvancedFilter] = useState<ProcessAdvancedFilterGroup>(EMPTY_PROCESS_ADVANCED_FILTER);
    const [advancedFilterOptions, setAdvancedFilterOptions] = useState<ProcessAdvancedFilterOptions>({});

    // Click outside to close menu
    useEffect(() => {
        const handleClickOutside = () => setActiveMenuId(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);
    
    // GID: Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: keyof Process | null, direction: 'asc' | 'desc' | null }>({ key: null, direction: null });
    // GID: Selection State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const { isHelpOpen, setIsHelpOpen } = useHelpModal();

    const activeAdvancedFilterCount = useMemo(
        () => countActiveProcessAdvancedFilters(advancedFilter),
        [advancedFilter],
    );

    const advancedFilterPayload = useMemo(() => {
        if (activeAdvancedFilterCount === 0) return '';
        return JSON.stringify(stripProcessAdvancedFilterIds(advancedFilter));
    }, [advancedFilter, activeAdvancedFilterCount]);

    useEffect(() => {
        const controller = new AbortController();
        fetchProcesses(controller.signal);
        const handleFocus = () => fetchProcesses();
        window.addEventListener('focus', handleFocus);
        return () => {
            controller.abort();
            window.removeEventListener('focus', handleFocus);
        };
    }, [includedTags, excludedTags, statusFilter, debouncedSearchTerm, advancedFilterPayload, updatedRange.from, updatedRange.to]);

    useEffect(() => {
        if (!showAdvancedFilters) return;
        setDraftAdvancedFilter(advancedFilter);

        (async () => {
            try {
                const res = await api.get('/processes/filters/options');
                const data = res.data && typeof res.data === 'object' ? res.data : {};
                setAdvancedFilterOptions({
                    statuses: Array.isArray((data as any).statuses) ? (data as any).statuses : [],
                    categories: Array.isArray((data as any).categories) ? (data as any).categories : [],
                    areas: Array.isArray((data as any).areas) ? (data as any).areas : [],
                });
            } catch (e) {
                console.warn('Falha ao carregar opções de filtro:', e);
            }
        })();
    }, [showAdvancedFilters, advancedFilter]);

    const fetchProcesses = async (signal?: AbortSignal) => {
        try {
            setLoading(true);
            const params: any = {};
            if (includedTags.length > 0) params.includedTags = includedTags.join(',');
            if (excludedTags.length > 0) params.excludedTags = excludedTags.join(',');
            if (statusFilter !== 'ALL') params.status = statusFilter;
            if (debouncedSearchTerm?.trim()) params.search = debouncedSearchTerm.trim();
            if (advancedFilterPayload) params.advancedFilter = advancedFilterPayload;
            if (updatedRange.from && updatedRange.to) {
                params.updatedFrom = updatedRange.from;
                params.updatedTo = updatedRange.to;
            }
            
            const response = await api.get('/processes', { signal, params });
            console.log('Processos carregados:', response.data);
            setProcesses(Array.isArray(response.data) ? response.data : []);
        } catch (err: any) {
            if (axios.isCancel(err)) return;
            console.error(err);
            toast.error('Erro ao carregar processos');
        } finally {
            setLoading(false);
        }
    };

    useHotkeys({
        onNew: () => navigate('/processes/new'),
        onPrint: () => window.print()
    });

    const sortedProcesses = useMemo(() => {
        let sortableItems = [...processes];
        if (sortConfig.key && sortConfig.direction) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key!] ?? '';
                const bValue = b[sortConfig.key!] ?? '';
                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [processes, sortConfig]);

    const formatCurrency = (val?: number) => val ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val) : '-';
    
    const formatDate = (date?: string) => {
        if (!date) return '-';
        try {
            return new Date(date).toLocaleDateString('pt-BR');
        } catch (e) {
            return date;
        }
    };

    const getTimeElapsed = (date?: string) => {
        if (!date) return null;
        const now = new Date();
        const past = new Date(date);
        
        const years = differenceInYears(now, past);
        const months = differenceInMonths(now, past) % 12;
        const days = differenceInDays(now, past) % 30;
        const hours = differenceInHours(now, past) % 24;
        const minutes = differenceInMinutes(now, past) % 60;

        if (years > 0) return `Há ${years} ${years === 1 ? 'ano' : 'anos'}${months > 0 ? ` e ${months} meses` : ''}`;
        if (months > 0) return `Há ${months} ${months === 1 ? 'mês' : 'meses'}${days > 0 ? ` e ${days} d` : ''}`;
        if (days > 0) return `Há ${days} ${days === 1 ? 'dia' : 'dias'}${hours > 0 ? ` e ${hours}h` : ''}`;
        if (hours > 0) return `Há ${hours} ${hours === 1 ? 'h' : 'hs'}${minutes > 0 ? ` e ${minutes}m` : ''}`;
        if (minutes > 0) return `Há ${minutes} min`;
        return 'Agora mesmo';
    };

    return (
        <div className="space-y-6 h-full flex flex-col animate-in fade-in duration-700 p-6 md:p-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        <Gavel className="text-indigo-500" size={32} />
                        Processos & Casos
                    </h1>
                    <p className="text-slate-400 mt-1">Gerencie a esteira jurídica, prazos e andamentos do escritório.</p>
                </div>
                <div className="flex gap-3">
                    <div className="flex bg-slate-900 border border-slate-700 rounded-lg p-1">
                        <button onClick={() => setViewMode('KANBAN')} className={clsx("p-2 rounded-md transition-all", viewMode === 'KANBAN' ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-white")} title="Visualização Kanban"><Kanban size={18} /></button>
                        <button onClick={() => setViewMode('LIST')} className={clsx("p-2 rounded-md transition-all", viewMode === 'LIST' ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-white")} title="Visualização em Lista"><List size={18} /></button>
                    </div>
                    <button onClick={() => navigate('/processes/new')} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 whitespace-nowrap"><Plus size={20} /> Novo Processo</button>
                    <button 
                        onClick={() => navigate('/processes/config', { 
                            state: { 
                                filters: { 
                                    search: searchTerm 
                                } 
                            } 
                        })} 
                        className="p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition" 
                        title="Configurações de Processos"
                    >
                        <Settings size={20} />
                    </button>
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
                <div className="flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex-1 w-full md:max-w-xl">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar por CNJ, Parte, Cliente ou Pasta..." className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-slate-500 transition-all" />
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <select 
                            value={statusFilter} 
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="bg-slate-800 border border-slate-700 rounded-lg text-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                        >
                            <option value="ATIVO">Somente Ativos</option>
                            <option value="INATIVO">Somente Inativos</option>
                            <option value="ALL">Mostrar Todos</option>
                        </select>
                        <DateRangePicker
                            value={updatedRange}
                            onChange={(next) =>
                                setUpdatedRange({
                                    from: String(next.from || ''),
                                    to: String(next.to || ''),
                                })
                            }
                            placeholder="Atualizados (período)"
                            className="w-full md:w-[280px]"
                        />
                        <div className="hidden md:block h-6 w-px bg-slate-800"></div>
                        <button
                            onClick={() => setShowAdvancedFilters(true)}
                            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 flex items-center gap-2 hover:bg-slate-700 hover:text-white transition text-sm font-medium whitespace-nowrap"
                        >
                            <Filter size={16} /> Filtros
                            {activeAdvancedFilterCount > 0 && (
                                <span className="ml-1 px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/25 text-indigo-200 text-[11px] font-bold">
                                    {activeAdvancedFilterCount}
                                </span>
                            )}
                        </button>
                        {selectedIds.length > 0 && (
                            <div className="flex items-center gap-2 ml-auto animate-in slide-in-from-right-5 fade-in">
                                <span className="text-sm text-slate-400 hidden sm:inline">{selectedIds.length} selecionados</span>
                                <button className="text-red-400 hover:text-red-300 p-2 hover:bg-red-500/10 rounded-lg transition" title="Excluir Selecionados"><Trash2 size={18} /></button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="pt-2 border-t border-slate-800/50">
                    <AdvancedTagFilter 
                        scope="PROCESS"
                        onFilterChange={(inc, exc) => { 
                            setIncludedTags(inc); 
                            setExcludedTags(exc); 
                        }} 
                    />
                </div>
            </div>

            {showAdvancedFilters && (
                <AdvancedProcessFilterModal
                    open={showAdvancedFilters}
                    value={draftAdvancedFilter}
                    onChange={setDraftAdvancedFilter}
                    onClose={() => setShowAdvancedFilters(false)}
                    onClear={() => setDraftAdvancedFilter(EMPTY_PROCESS_ADVANCED_FILTER)}
                    onApply={() => {
                        setAdvancedFilter(pruneProcessAdvancedFilter(draftAdvancedFilter));
                        setShowAdvancedFilters(false);
                    }}
                    options={advancedFilterOptions}
                />
            )}

            <div className="flex-1 flex flex-col min-h-[400px]">
                {viewMode === 'LIST' ? (
                    <DataGrid<Process>
                        data={sortedProcesses}
                        totalItems={sortedProcesses.length}
                        isLoading={loading}
                        onSort={(key, direction) => setSortConfig({ key: key as keyof Process, direction })}
                        onSelect={setSelectedIds}
                        onRowDoubleClick={(process) => navigate(`/processes/${process.id}`)}
                        columns={[
                            {
                                key: 'title',
                                label: 'Processo / Partes',
                                sortable: true,
                                render: (process) => {
                                    const parties = process.processParties || [];
                                    
                                    const normalizeText = (val?: string) => (val || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
                                    
                                    const LAWYER_TERMS = ['ADVOGADO', 'PROCURADOR', 'DEFENSOR'];
                                    const ACTIVE_POLE_TERMS = ['AUTOR', 'AUTORA', 'REQUERENTE', 'EXEQUENTE', 'RECLAMANTE', 'IMPETRANTE', 'APELANTE', 'AGRAVANTE', 'EMBARGANTE'];
                                    const PASSIVE_POLE_TERMS = ['REU', 'REQUERIDO', 'REQUERIDA', 'EXECUTADO', 'EXECUTADA', 'RECLAMADO', 'RECLAMADA', 'IMPETRADO', 'APELADO', 'AGRAVADO', 'EMBARGADO'];

                                    const isLawyerParty = (p: any) => {
                                        const rName = normalizeText(p.role?.name);
                                        const qName = normalizeText(p.qualification?.name);
                                        return LAWYER_TERMS.some(t => rName.includes(t) || qName.includes(t));
                                    };

                                    const getPole = (p: any) => {
                                        const rCat = normalizeText(p.role?.category);
                                        const rName = normalizeText(p.role?.name);
                                        if (rCat === 'POLO_ATIVO' || ACTIVE_POLE_TERMS.some(t => rName.includes(t)) || p.isClient) return 'active';
                                        if (rCat === 'POLO_PASSIVO' || PASSIVE_POLE_TERMS.some(t => rName.includes(t)) || p.isOpposing) return 'passive';
                                        return null;
                                    };

                                    const linkedRepresentativeIds = new Set<string>();
                                    parties.forEach(p => {
                                        p.representativeLinks?.forEach(link => linkedRepresentativeIds.add(link.representativeParty.id));
                                    });

                                    // Top level só mostra quem não é exclusivamente um procurador de outra pessoa
                                    const topLevelParties = parties.filter(p => !(linkedRepresentativeIds.has(p.id) && isLawyerParty(p)));

                                    const filterAndRender = (label: string, labelColor: string, pole: 'active' | 'passive') => {
                                        // Filtra partes que pertencem a este polo e evita duplicidade (prioridade para o polo definido)
                                        const filtered = topLevelParties.filter(p => getPole(p) === pole);
                                        
                                        if (filtered.length === 0) return null;
                                        
                                        return (
                                            <div className="flex flex-col gap-1.5">
                                                {filtered.map((p, idx) => (
                                                    <div key={p.id} className="flex flex-col gap-0.5">
                                                        <div className="flex items-center gap-1.5">
                                                            {idx === 0 && <span className={clsx("text-[8px] font-bold uppercase shrink-0 w-12", labelColor)}>{label}:</span>}
                                                            <div className={clsx("flex items-center gap-2", idx > 0 && "ml-[54px]")}>
                                                                <span 
                                                                    className="text-white hover:text-indigo-400 cursor-pointer transition-colors font-bold text-[10px] truncate max-w-[200px]"
                                                                    onClick={(e) => { e.stopPropagation(); navigate(`/contacts/${p.contact.id}`); }}
                                                                >
                                                                    {p.contact.name}
                                                                </span>
                                                                <div className="flex items-center gap-1.5 text-[9px]">
                                                                    {p.contact.whatsapp && (
                                                                        <a href={`https://wa.me/55${p.contact.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="p-0.5 text-emerald-500 hover:text-emerald-400"><MessageCircle size={10} /></a>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Procuradores vinculados a ESTA parte */}
                                                        {p.representativeLinks?.map(link => (
                                                            <div key={link.id} className="flex items-center gap-1.5 ml-[54px] opacity-70">
                                                                <CornerDownRight size={10} className="text-slate-500 shrink-0" />
                                                                <span 
                                                                    className="text-slate-300 hover:text-indigo-400 cursor-pointer transition-colors font-medium text-[9px] truncate max-w-[180px]"
                                                                    onClick={(e) => { e.stopPropagation(); navigate(`/contacts/${link.representativeParty.contact.id}`); }}
                                                                >
                                                                    {link.representativeParty.contact.name}
                                                                </span>
                                                                <span className="text-[8px] text-slate-500 uppercase">({link.representativeParty.role?.name || 'Procurador'})</span>
                                                                <div className="flex items-center gap-1 text-[8px]">
                                                                    {link.representativeParty.contact.whatsapp && (
                                                                        <a href={`https://wa.me/55${link.representativeParty.contact.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-emerald-500/70 hover:text-emerald-400"><MessageCircle size={9} /></a>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    };

                                    const respParty = parties.find(p => {
                                        const qName = normalizeText(p.qualification?.name);
                                        const rName = normalizeText(p.role?.name);
                                        return qName === 'RESPONSAVEL' || rName.includes('RESPONSAVEL');
                                    })?.contact.name;
                                    
                                    const responsible = process.responsibleLawyer || respParty || '-';
                                    
                                    return (
                                        <div className="flex flex-col gap-2 min-w-[280px] py-1">
                                            <div className="flex flex-col gap-1 group/title">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-indigo-400 group-hover/title:text-indigo-300 transition-colors text-sm">
                                                        {process.cnj ? masks.cnj(process.cnj) : 'S/ NÚMERO'}
                                                    </span>
                                                    {process.category && (
                                                        <span className={clsx("px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border border-transparent", process.category === 'JUDICIAL' ? 'text-indigo-400 bg-indigo-500/10' : 'text-amber-400 bg-amber-500/10')}>
                                                            {process.category === 'JUDICIAL' ? 'JUD' : 'ADV'}
                                                        </span>
                                                    )}
                                                </div>
                                                {process.code && (
                                                    <span className="font-mono font-bold text-[9px] text-indigo-300 opacity-60">
                                                        {process.code}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="space-y-1.5">
                                                <div 
                                                    className="flex items-start gap-1.5 text-slate-300 text-[11px] p-0.5 -m-0.5 rounded transition"
                                                >
                                                    <span className="text-slate-500 font-bold uppercase w-14 shrink-0">Título:</span>
                                                    <span className="font-medium text-white">{process.title}</span>
                                                </div>
                                                
                                                {filterAndRender('Cliente', 'text-emerald-500', 'active')}
                                                {filterAndRender('Adverso', 'text-red-500', 'passive')}

                                                <div className="flex items-start gap-1.5 text-slate-400 text-[11px]">
                                                    <span className="text-indigo-500/80 font-bold uppercase w-14 shrink-0">Resp.:</span>
                                                    <span className="text-slate-200">{responsible}</span>
                                                </div>

                                                <div className="flex items-center gap-1.5 mt-2 text-slate-500 text-[9px] font-mono group/cnj">
                                                    <span className="truncate max-w-[180px]">{process.cnj || 'ID: ' + process.id.substring(0,8)}</span>
                                                    {process.cnj && (
                                                        <button 
                                                            onClick={(e) => { 
                                                                e.stopPropagation(); 
                                                                navigator.clipboard.writeText(process.cnj!); 
                                                                toast.success('CNJ copiado!'); 
                                                            }} 
                                                            className="opacity-0 group-hover/cnj:opacity-100 hover:text-indigo-400 transition-all p-1 -m-1" 
                                                            title="Copiar CNJ"
                                                        >
                                                            <FileText size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                            },
                            {
                                key: 'tags' as any,
                                label: 'Etiquetas',
                                render: (p: any) => (
                                    <InlineTags 
                                        tags={p.tags || []} 
                                        entityId={p.id} 
                                        entityType="process" 
                                        onRefresh={() => fetchProcesses()} 
                                    />
                                )
                            },
                            {
                                key: 'info' as any,
                                label: 'Informações',
                                render: (process) => (
                                    <div className="flex flex-col gap-1 min-w-[200px] py-1">
                                        <div className="flex items-center gap-1.5 text-[11px]">
                                            <span className="text-slate-500 font-bold uppercase w-12 shrink-0">Pasta:</span>
                                            <span className="text-indigo-400 font-mono font-bold bg-indigo-500/5 px-1 rounded" title={process.folder || '-'}>
                                                {process.folder ? getOfficeFolderDisplayPath(process.folder) : '-'}
                                            </span>
                                        </div>
                                        <div className="flex items-start gap-1.5 text-[10px]">
                                            <span className="text-slate-500 font-bold uppercase w-12 shrink-0">Vara/Juiz:</span>
                                            <span className="text-slate-300 italic">{process.vars || '-'} {process.judge ? `(${process.judge})` : ''}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px]">
                                            <span className="text-slate-500 font-bold uppercase w-12 shrink-0">Área:</span>
                                            <span className="text-slate-400">{process.area || '-'} / {process.subject || '-'}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px] mt-1">
                                            <span className="text-emerald-400/80 font-bold uppercase w-12 shrink-0">Valor:</span>
                                            <span className="text-emerald-400 font-mono font-bold">{formatCurrency(Number(process.value))}</span>
                                        </div>
                                    </div>
                                )
                            },
                            { 
                                key: 'createdAt', 
                                label: 'Histórico & Datas', 
                                sortable: true, 
                                render: (process) => {
                                    const lastMov = process.timeline?.[0];
                                    const elapsed = getTimeElapsed(lastMov?.date);
                                    
                                    return (
                                        <div className="flex flex-col gap-2 min-w-[250px] py-1">
                                            <div className="flex gap-3 font-mono text-[10px] border-b border-slate-800 pb-1">
                                                <div className="flex items-center gap-1 text-slate-400"><span className="text-emerald-500 font-bold">C:</span>{formatDate(process.createdAt)}</div>
                                                <div className="flex items-center gap-1 text-slate-400"><span className="text-blue-500 font-bold">D:</span>{formatDate(process.distributionDate)}</div>
                                                <div className="flex items-center gap-1 text-slate-400"><span className="text-amber-500 font-bold">A:</span>{formatDate(lastMov?.date)}</div>
                                            </div>
                                            {lastMov && (
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] font-bold text-slate-500 uppercase bg-slate-800 px-1 rounded">Último Andamento:</span>
                                                        <span className="text-[9px] text-amber-400 font-bold">{elapsed}</span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-300 line-clamp-2 leading-tight" title={lastMov.description}>
                                                        {lastMov.title || lastMov.description || 'Sem descrição'}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                }
                            },
                            {
                                key: 'actions' as any,
                                label: 'Ações',
                                sortable: false,
                                render: (process) => (
                                    <div className="relative">
                                        <button 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setActiveMenuId(activeMenuId === process.id ? null : process.id); 
                                            }} 
                                            className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"
                                        >
                                            <MoreHorizontal size={18} />
                                        </button>
                                        
                                        {activeMenuId === process.id && (
                                            <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); navigate(`/processes/${process.id}`); }} 
                                                    className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2 transition-colors"
                                                >
                                                    <Pencil size={14} /> Editar
                                                </button>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); navigate(`/processes/${process.id}`); }} 
                                                    className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2 transition-colors"
                                                >
                                                    <ExternalLink size={14} /> Abrir Detalhes
                                                </button>
                                                <div className="h-px bg-slate-700 my-1"></div>
                                                <button 
                                                    onClick={async (e) => { 
                                                        e.stopPropagation(); 
                                                        if(confirm('Excluir este processo permanentemente?')) {
                                                            try {
                                                                await api.delete(`/processes/${process.id}`);
                                                                fetchProcesses();
                                                                toast.success('Processo excluído');
                                                            } catch(err) {
                                                                toast.error('Erro ao excluir');
                                                            }
                                                        }
                                                    }} 
                                                    className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2 transition-colors"
                                                >
                                                    <Trash size={14} /> Excluir
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )
                            }
                        ]}
                    />
                ) : (
                    <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-12 text-center flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4"><Kanban size={32} className="text-slate-500" /></div>
                        <h3 className="text-lg font-medium text-white mb-2">Modo Kanban em construção</h3>
                        <p className="text-slate-400 mb-6 max-w-sm">Estamos migrando o quadro para o novo padrão GID. Utilize a lista por enquanto.</p>
                        <button onClick={() => setViewMode('LIST')} className="text-indigo-400 hover:text-indigo-300 text-sm font-medium flex items-center gap-2"><List size={16} /> Voltar para Lista</button>
                    </div>
                )}
            </div>
            <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} title="Processos" sections={helpProcesses} />
        </div>
    );
}
