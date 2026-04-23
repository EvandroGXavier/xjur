import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
    Search, Plus, Filter, Users,
    Building2, Clock, HelpCircle, LayoutGrid, List,
    Target,
    Mail,
    Phone,
    MessageSquare,
    ChevronRight,
    User,
    Trash2,
    CheckCircle2,
    MoreHorizontal,
    Edit,
    ChevronDown,
    ChevronUp,
    Settings,
    MapPin,
    FileText,
    XCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { toast } from 'sonner';

import { DataGrid } from '../../components/ui/DataGrid';
import { AdvancedTagFilter } from '../../components/ui/AdvancedTagFilter';
import { InlineTags } from '../../components/ui/InlineTags';
import { HelpModal, useHelpModal } from '../../components/HelpModal';
import { helpContacts, helpSigilo } from '../../data/helpManuals';
import { getUser } from '../../auth/authStorage';
import { clsx } from 'clsx';
import { useHotkeys } from '../../hooks/useHotkeys';

interface Contact {
  id: string;
  name: string;
  document?: string;
  cpf?: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  type?: 'PF' | 'PJ';
  active?: boolean;
  profilePicUrl?: string;
  createdAt?: string;
}

type CardFilter = 'ALL' | 'LEADS' | 'PJ' | 'PF' | 'RECENT';

export function ContactList() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'true' | 'false'>('true');
  const [includedTags, setIncludedTags] = useState<string[]>([]);
  const [excludedTags, setExcludedTags] = useState<string[]>([]);
  const [birthDateStart, setBirthDateStart] = useState('');
  const [birthDateEnd, setBirthDateEnd] = useState('');
  const [pfFilters, setPfFilters] = useState({
    cpf: '',
    rg: '',
    motherName: '',
    fatherName: '',
    profession: '',
    nationality: '',
    naturality: '',
    gender: '',
    civilStatus: '',
    cnh: '',
    cnhCategory: '',
    nis: '',
    pis: '',
    ctps: '',
  });
  const [pjFilters, setPjFilters] = useState({
    cnpj: '',
    companyName: '',
    stateRegistration: '',
  });
  const [addressFilters, setAddressFilters] = useState({ city: '', state: '', district: '', zipCode: '', street: '' });
  const [contractFilters, setContractFilters] = useState({ description: '', counterparty: '' });
  const [birthMonth, setBirthMonth] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCardFilter, setActiveCardFilter] = useState<CardFilter>('ALL');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Contact | null, direction: 'asc' | 'desc' | null }>({ key: null, direction: null });
  const { isHelpOpen, setIsHelpOpen } = useHelpModal();
  const manualSections = useMemo(() => {
    const user = getUser();
    const isAdmin = user && ['ADMIN', 'OWNER'].includes(user.role);
    return isAdmin ? [...helpContacts, helpSigilo] : helpContacts;
  }, []);
  
  const [viewMode, setViewMode] = useState<'CARD' | 'LIST'>('LIST'); // New state for view mode
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  
  useHotkeys({
      onNew: () => navigate('/contacts/new'),
      onPrint: () => window.print()
  });

  // Initialize filters from sessionStorage if available
  useEffect(() => {
    const saved = sessionStorage.getItem('xjur_contact_filters');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.searchTerm) setSearchTerm(parsed.searchTerm);
        if (parsed.statusFilter) setStatusFilter(parsed.statusFilter);
        if (parsed.includedTags) setIncludedTags(parsed.includedTags);
        if (parsed.excludedTags) setExcludedTags(parsed.excludedTags);
        if (parsed.activeCardFilter) setActiveCardFilter(parsed.activeCardFilter);
        if (parsed.showFilters !== undefined) setShowFilters(parsed.showFilters);
      } catch (e) {
        console.error('Failed to load filters from session', e);
      }
    }
  }, []);

  // Save filters to sessionStorage whenever they change
  useEffect(() => {
    const filters = {
      searchTerm,
      statusFilter,
      includedTags,
      excludedTags,
      activeCardFilter,
      showFilters
    };
    sessionStorage.setItem('xjur_contact_filters', JSON.stringify(filters));
  }, [searchTerm, statusFilter, includedTags, excludedTags, activeCardFilter, showFilters]);

  useEffect(() => {
     fetchContacts();
  }, [includedTags, excludedTags, statusFilter, searchTerm, birthDateStart, birthDateEnd, pfFilters, pjFilters, addressFilters, contractFilters, birthMonth]);

  const fetchContacts = async () => {
    try {
        setLoading(true);
        const params: any = { search: searchTerm };
        if (includedTags.length > 0) params.includedTags = includedTags.join(',');
        if (excludedTags.length > 0) params.excludedTags = excludedTags.join(',');
        if (statusFilter !== 'ALL') params.active = statusFilter;
        if (birthDateStart) params.birthDateStart = birthDateStart;
        if (birthDateEnd) params.birthDateEnd = birthDateEnd;

        // PF Filters
        Object.entries(pfFilters).forEach(([key, value]) => {
            if (value) params[key] = value;
        });

        // PJ Filters
        Object.entries(pjFilters).forEach(([key, value]) => {
            if (value) params[key] = value;
        });

        // Address Filters
        Object.entries(addressFilters).forEach(([key, value]) => {
            if (value) params[key] = value;
        });

        // Contract Filters
        if (contractFilters.description) params.contractDescription = contractFilters.description;
        if (contractFilters.counterparty) params.contractCounterparty = contractFilters.counterparty;

        // Birth Month
        if (birthMonth) params.birthMonth = birthMonth;

        const response = await api.get('/contacts', { params });
        setContacts(Array.isArray(response.data) ? response.data : []);
    } catch (err: any) {
        if (axios.isCancel(err)) return;
        console.error(err);
        toast.error('Erro ao carregar contatos');
    } finally {
        setLoading(false);
    }
  };

  const handleDeleteContact = async (id: string, name: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o contato ${name}?`)) return;
    try {
       const response = await api.delete(`/contacts/${id}`);
       if ((response.data as any)?.active === false) {
         toast.success('Contato inativado com sucesso!');
       } else {
         toast.success('Contato excluído com sucesso!');
       }
       fetchContacts();
    } catch (err) {
       console.error(err);
       toast.error('Erro ao excluir contato');
    }
  };

  const getCleanDoc = (c: Contact) => {
      const doc = c.document || c.cpf || c.cnpj;
      return doc ? doc.replace(/\D/g, '') : '';
  };

  const stats = useMemo(() => {
    const defaultStats = { total: 0, leads: 0, pj: 0, pf: 0, recent: 0 };
    if (!contacts.length) return defaultStats;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    let leads = 0;
    let pj = 0;
    let pf = 0;
    let recent = 0;

    contacts.forEach(c => {
      const cleanDoc = getCleanDoc(c);
      
      if (!cleanDoc) leads++;
      else if (c.type === 'PJ' || cleanDoc.length > 11) pj++;
      else if (c.type === 'PF' || cleanDoc.length <= 11) pf++;

      if (c.createdAt && new Date(c.createdAt) >= sevenDaysAgo) {
        recent++;
      }
    });

    return { total: contacts.length, leads, pj, pf, recent };
  }, [contacts]);

  const sortedContacts = useMemo(() => {
      let sortableItems = [...contacts];

      // Aplica o filtro rápido do Card clicado
      if (activeCardFilter === 'LEADS') {
          sortableItems = sortableItems.filter(c => !getCleanDoc(c));
      } else if (activeCardFilter === 'PJ') {
          sortableItems = sortableItems.filter(c => c.type === 'PJ' || getCleanDoc(c).length > 11);
      } else if (activeCardFilter === 'PF') {
          sortableItems = sortableItems.filter(c => {
              const doc = getCleanDoc(c);
              return c.type === 'PF' || (doc.length > 0 && doc.length <= 11);
          });
      } else if (activeCardFilter === 'RECENT') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          sortableItems = sortableItems.filter(c => c.createdAt && new Date(c.createdAt) >= sevenDaysAgo);
      }

      // Aplica a ordenação
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
  }, [contacts, sortConfig, searchTerm, activeCardFilter]);

  const handleCardClick = (cardId: CardFilter) => {
    setActiveCardFilter(cardId);
  }

  const formatDocument = (doc?: string) => {
    if (!doc) return '-';
    const cleaned = doc.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    if (cleaned.length === 14) {
      return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return doc;
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setStatusFilter('true');
    setIncludedTags([]);
    setExcludedTags([]);
    setActiveCardFilter('ALL');
    setBirthDateStart('');
    setBirthDateEnd('');
    setBirthMonth('');
    setPfFilters({
      cpf: '', rg: '', motherName: '', fatherName: '', profession: '', nationality: '', naturality: '', gender: '', civilStatus: '', cnh: '', cnhCategory: '', nis: '', pis: '', ctps: '',
    });
    setPjFilters({ cnpj: '', companyName: '', stateRegistration: '' });
    setAddressFilters({ city: '', state: '', district: '', zipCode: '', street: '' });
    setContractFilters({ description: '', counterparty: '' });
    sessionStorage.removeItem('xjur_contact_filters');
    toast.info('Todos os filtros foram limpos');
  };

  const statCards = [
    { id: 'ALL', label: 'Todos os Contatos', value: stats.total, icon: Users, colorClass: 'text-indigo-400', bgClass: 'bg-indigo-500/10', borderClass: 'border-indigo-500/50' },
    { id: 'LEADS', label: 'Leads (S/ Doc)', value: stats.leads, icon: Target, colorClass: 'text-emerald-400', bgClass: 'bg-emerald-500/10', borderClass: 'border-emerald-500/50' },
    { id: 'PJ', label: 'Pessoa Jurídica', value: stats.pj, icon: Building2, colorClass: 'text-blue-400', bgClass: 'bg-blue-500/10', borderClass: 'border-blue-500/50' },
    { id: 'PF', label: 'Pessoa Física', value: stats.pf, icon: User, colorClass: 'text-amber-400', bgClass: 'bg-amber-500/10', borderClass: 'border-amber-500/50' },
    { id: 'RECENT', label: 'Recentes', value: stats.recent, icon: Clock, colorClass: 'text-purple-400', bgClass: 'bg-purple-500/10', borderClass: 'border-purple-500/50' },
  ];

  return (
    <div className="space-y-4 h-full flex flex-col overflow-hidden animate-in fade-in duration-700 p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
             <Users className="text-indigo-500" size={28} />
             Contatos
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">Gerencie sua base de clientes, leads e parceiros.</p>
        </div>

        <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
                <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1.5">
                    <CheckCircle2 size={12} />
                    {selectedIds.length} selecionado{selectedIds.length > 1 ? 's' : ''}
                </div>
            )}
            <button 
                onClick={() => setIsHelpOpen(true)}
                className="flex items-center gap-1 h-8 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium transition border border-slate-700 text-xs"
                title="Ajuda (F1)"
            >
                <HelpCircle size={14} /> Ajuda
            </button>
            <button 
                onClick={() => navigate('/contacts/new')} 
                className="flex items-center gap-1 h-8 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium transition shadow-lg shadow-indigo-500/20 whitespace-nowrap text-xs"
            >
                <Plus size={16} /> Novo Contato
            </button>
        </div>
      </div>

      {/* Estatísticas Rápidas e Filtros Pragmáticos */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map(card => {
          const Icon = card.icon;
          const isActive = activeCardFilter === card.id;
          return (
            <div 
               key={card.id} 
               onClick={() => handleCardClick(card.id as CardFilter)}
               className={`p-4 rounded-xl border cursor-pointer transition-all duration-300 relative overflow-hidden group hover:-translate-y-1 flex flex-col justify-between ${isActive ? `bg-slate-800 ${card.borderClass} shadow-lg shadow-black/20` : 'bg-slate-900 border-slate-800 hover:bg-slate-800/80 shadow-sm'}`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className={`p-2 rounded-lg ${card.bgClass} ${card.colorClass}`}>
                  <Icon size={20} />
                </div>
                {isActive && (
                    <div className={`w-2 h-2 rounded-full absolute top-6 right-6 ${card.bgClass.replace('/10', '/50')} shadow-[0_0_8px_rgba(255,255,255,0.8)]`} />
                )}
              </div>
              <div className="flex flex-col">
                 <span className="text-3xl font-bold text-white tracking-tight">{card.value}</span>
                 <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1 flex items-center gap-1 group-hover:text-slate-300 transition-colors">
                    {card.label} <ChevronRight size={12} className={`opacity-0 -translate-x-2 transition-all ${isActive ? 'opacity-100 translate-x-0' : 'group-hover:opacity-100 group-hover:translate-x-0'}`} />
                 </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4 shadow-sm">
            <div className="flex flex-col xl:flex-row gap-4 items-center">
                {/* 1. Busca */}
                <div className="relative flex-1 w-full md:max-w-md">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input 
                        type="text" 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        placeholder="Buscar contatos..." 
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-10 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-slate-500 transition-all font-medium" 
                    />
                    {searchTerm && (
                        <button 
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                        >
                            <XCircle size={16} />
                        </button>
                    )}
                </div>

                {/* 2. Grid/Cards Switcher (Conforme Imagem) */}
                <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700 w-full sm:w-auto shrink-0 shadow-inner">
                    <button 
                        onClick={() => setViewMode('LIST')} 
                        className={clsx(
                            "flex items-center gap-2 px-4 py-1.5 rounded-md transition-all duration-300 text-xs font-bold whitespace-nowrap",
                            viewMode === 'LIST' 
                                ? "bg-indigo-600 text-white shadow-lg scale-100" 
                                : "text-slate-400 hover:text-slate-200 bg-transparent"
                        )}
                    >
                        <List size={14} /> Grid
                    </button>
                    <button 
                        onClick={() => setViewMode('CARD')} 
                        className={clsx(
                            "flex items-center gap-2 px-4 py-1.5 rounded-md transition-all duration-300 text-xs font-bold whitespace-nowrap",
                            viewMode === 'CARD' 
                                ? "bg-indigo-600 text-white shadow-lg scale-100" 
                                : "text-slate-400 hover:text-slate-200 bg-transparent"
                        )}
                    >
                        <LayoutGrid size={14} /> Cards
                    </button>
                </div>

                {/* 3. Status e Ações */}
                <div className="flex items-center gap-2 w-full xl:w-auto ml-auto">
                    <select 
                        value={statusFilter} 
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="bg-slate-800 border border-slate-700 rounded-lg text-slate-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition font-bold"
                    >
                        <option value="ALL">TodosStatus</option>
                        <option value="true">Ativos</option>
                        <option value="false">Inativos</option>
                    </select>

                    <button 
                        onClick={() => setShowFilters(!showFilters)}
                        className={clsx(
                            "px-3 py-1.5 h-[34px] rounded-lg flex items-center gap-1.5 transition text-xs font-bold border",
                            showFilters ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-900/20" : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white shadow-sm"
                        )}
                    >
                        <Filter size={14} /> Filtros
                    </button>

                    <button 
                        onClick={() => navigate('/contacts/config')}
                        className="flex items-center gap-2 px-4 py-1.5 h-[34px] bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition font-black text-xs uppercase"
                    >
                        <Settings size={14} /> Configurar
                    </button>

                    {(searchTerm || statusFilter !== 'true' || includedTags.length > 0 || excludedTags.length > 0 || activeCardFilter !== 'ALL') && (
                        <button 
                            onClick={clearAllFilters}
                            className="flex items-center justify-center w-[34px] h-[34px] bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-lg transition-all"
                            title="Limpar Tudo"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            </div>

            {showFilters && (
                <div className="pt-4 border-t border-slate-800/50 flex flex-col gap-4 animate-in slide-in-from-top-4 duration-300">
                    <div className="flex flex-wrap gap-4">
                        <div className="flex flex-col gap-1.5 ">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Nascimento (Início)</label>
                            <input 
                                type="date" 
                                value={birthDateStart}
                                onChange={e => setBirthDateStart(e.target.value)}
                                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-all font-medium h-9"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Nascimento (Fim)</label>
                            <input 
                                type="date" 
                                value={birthDateEnd}
                                onChange={e => setBirthDateEnd(e.target.value)}
                                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-all font-medium h-9"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Mês de Aniv.</label>
                            <select 
                                value={birthMonth}
                                onChange={e => setBirthMonth(e.target.value)}
                                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-all font-medium h-9"
                            >
                                <option value="">Todos</option>
                                <option value="1">Janeiro</option>
                                <option value="2">Fevereiro</option>
                                <option value="3">Março</option>
                                <option value="4">Abril</option>
                                <option value="5">Maio</option>
                                <option value="6">Junho</option>
                                <option value="7">Julho</option>
                                <option value="8">Agosto</option>
                                <option value="9">Setembro</option>
                                <option value="10">Outubro</option>
                                <option value="11">Novembro</option>
                                <option value="12">Dezembro</option>
                            </select>
                         </div>
                        {(birthDateStart || birthDateEnd || birthMonth || Object.values(pfFilters).some(v => v) || Object.values(pjFilters).some(v => v) || Object.values(addressFilters).some(v => v) || Object.values(contractFilters).some(v => v)) && (
                            <button 
                                onClick={() => { 
                                    setBirthDateStart(''); 
                                    setBirthDateEnd(''); 
                                    setBirthMonth('');
                                    setPfFilters({
                                        cpf: '', rg: '', motherName: '', fatherName: '', profession: '', nationality: '', naturality: '', gender: '', civilStatus: '', cnh: '', cnhCategory: '', nis: '', pis: '', ctps: '',
                                    });
                                    setPjFilters({ cnpj: '', companyName: '', stateRegistration: '' });
                                    setAddressFilters({ city: '', state: '', district: '', zipCode: '', street: '' });
                                    setContractFilters({ description: '', counterparty: '' });
                                }}
                                className="self-end px-3 py-1.5 text-xs font-bold text-red-400 hover:text-red-300 transition h-9 flex items-center"
                            >
                                <Trash2 size={12} className="mr-1" /> Limpar Filtros
                            </button>
                        )}
                    </div>

                    {/* PF SECTION */}
                    <div className="border border-slate-800 rounded-lg overflow-hidden">
                        <button 
                            onClick={() => setExpandedSections(prev => prev.includes('PF') ? prev.filter(s => s !== 'PF') : [...prev, 'PF'])}
                            className="w-full flex items-center justify-between p-3 bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
                        >
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                <User size={14} className="text-amber-500" /> Pessoa Física (PF)
                            </div>
                            {expandedSections.includes('PF') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {expandedSections.includes('PF') && (
                            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 bg-slate-900/40 border-t border-slate-800">
                                {[
                                    { label: 'CPF', key: 'cpf' },
                                    { label: 'RG', key: 'rg' },
                                    { label: 'Nome da Mãe', key: 'motherName' },
                                    { label: 'Nome do Pai', key: 'fatherName' },
                                    { label: 'Profissão', key: 'profession' },
                                    { label: 'Nacionalidade', key: 'nationality' },
                                    { label: 'Naturalidade', key: 'naturality' },
                                    { label: 'Sexo', key: 'gender' },
                                    { label: 'Estado Civil', key: 'civilStatus' },
                                    { label: 'CNH', key: 'cnh' },
                                    { label: 'Cat. CNH', key: 'cnhCategory' },
                                    { label: 'NIS', key: 'nis' },
                                    { label: 'PIS', key: 'pis' },
                                    { label: 'CTPS', key: 'ctps' },
                                ].map(f => (
                                    <div key={f.key} className="flex flex-col gap-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter ml-0.5">{f.label}</label>
                                        <input 
                                            type="text" 
                                            value={(pfFilters as any)[f.key]}
                                            onChange={e => setPfFilters(prev => ({ ...prev, [f.key]: e.target.value }))}
                                            placeholder={`Filtrar por ${f.label.toLowerCase()}...`}
                                            className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/50 transition-all"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* PJ SECTION */}
                    <div className="border border-slate-800 rounded-lg overflow-hidden">
                        <button 
                            onClick={() => setExpandedSections(prev => prev.includes('PJ') ? prev.filter(s => s !== 'PJ') : [...prev, 'PJ'])}
                            className="w-full flex items-center justify-between p-3 bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
                        >
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                <Building2 size={14} className="text-blue-500" /> Pessoa Jurídica (PJ)
                            </div>
                            {expandedSections.includes('PJ') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {expandedSections.includes('PJ') && (
                            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 bg-slate-900/40 border-t border-slate-800">
                                {[
                                    { label: 'CNPJ', key: 'cnpj' },
                                    { label: 'Razão Social', key: 'companyName' },
                                    { label: 'Insc. Estadual', key: 'stateRegistration' },
                                ].map(f => (
                                    <div key={f.key} className="flex flex-col gap-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter ml-0.5">{f.label}</label>
                                        <input 
                                            type="text" 
                                            value={(pjFilters as any)[f.key]}
                                            onChange={e => setPjFilters(prev => ({ ...prev, [f.key]: e.target.value }))}
                                            placeholder={`Filtrar por ${f.label.toLowerCase()}...`}
                                            className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/50 transition-all"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ADDRESS SECTION */}
                    <div className="border border-slate-800 rounded-lg overflow-hidden">
                        <button 
                            onClick={() => setExpandedSections(prev => prev.includes('ADDR') ? prev.filter(s => s !== 'ADDR') : [...prev, 'ADDR'])}
                            className="w-full flex items-center justify-between p-3 bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
                        >
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                <MapPin size={14} className="text-emerald-500" /> Endereços
                            </div>
                            {expandedSections.includes('ADDR') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {expandedSections.includes('ADDR') && (
                            <div className="p-4 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4 bg-slate-900/40 border-t border-slate-800">
                                {[
                                    { label: 'Logradouro', key: 'street' },
                                    { label: 'Bairro', key: 'district' },
                                    { label: 'Cidade', key: 'city' },
                                    { label: 'Estado', key: 'state' },
                                    { label: 'CEP', key: 'zipCode' },
                                ].map(f => (
                                    <div key={f.key} className="flex flex-col gap-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter ml-0.5">{f.label}</label>
                                        <input 
                                            type="text" 
                                            value={(addressFilters as any)[f.key]}
                                            onChange={e => setAddressFilters(prev => ({ ...prev, [f.key]: e.target.value }))}
                                            placeholder={`Filtrar por ${f.label.toLowerCase()}...`}
                                            className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/50 transition-all"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* CONTRACTS SECTION */}
                    <div className="border border-slate-800 rounded-lg overflow-hidden">
                        <button 
                            onClick={() => setExpandedSections(prev => prev.includes('CTRT') ? prev.filter(s => s !== 'CTRT') : [...prev, 'CTRT'])}
                            className="w-full flex items-center justify-between p-3 bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
                        >
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                <FileText size={14} className="text-blue-500" /> Contratos
                            </div>
                            {expandedSections.includes('CTRT') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {expandedSections.includes('CTRT') && (
                            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900/40 border-t border-slate-800">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter ml-0.5">Descrição do Contrato</label>
                                    <input 
                                        type="text" 
                                        value={contractFilters.description}
                                        onChange={e => setContractFilters(prev => ({ ...prev, description: e.target.value }))}
                                        placeholder="Filtrar por descrição..."
                                        className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/50 transition-all"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter ml-0.5">Outra Parte (Contratante/Contratado)</label>
                                    <input 
                                        type="text" 
                                        value={contractFilters.counterparty}
                                        onChange={e => setContractFilters(prev => ({ ...prev, counterparty: e.target.value }))}
                                        placeholder="Filtrar por nome da outra parte..."
                                        className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/50 transition-all"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="pt-2 border-t border-slate-800/50">
                <AdvancedTagFilter 
                    scope="CONTACT"
                    onFilterChange={(inc, exc) => { 
                        setIncludedTags(inc); 
                        setExcludedTags(exc); 
                    }} 
                />
            </div>
        </div>
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-sm min-h-0">
          <DataGrid<Contact>
            data={sortedContacts}
            onSort={(key, direction) => setSortConfig({ key: key as keyof Contact, direction })}
            totalItems={sortedContacts.length}
            isLoading={loading}
            onSelect={setSelectedIds}
            onRowClick={(c) => {
                const isSelected = selectedIds.includes(c.id);
                if (isSelected) {
                    setSelectedIds(prev => prev.filter(id => id !== c.id));
                } else {
                    setSelectedIds(prev => [...prev, c.id]);
                }
            }}
            onRowDoubleClick={(c) => navigate(`/contacts/${c.id}`)}
            columns={[
                { key: 'name', label: 'Nome / Razão Social', sortable: true, render: (c) => (
                          <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-white hover:text-indigo-400 transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/contacts/${c.id}`); }}>{c.name}</span>
                              <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-slate-500 uppercase font-mono">{formatDocument(c.document)}</span>
                                  {!c.active && <span className="bg-red-500/10 text-red-400 text-[8px] px-1 rounded border border-red-500/20 font-bold">INATIVO</span>}
                              </div>
                          </div>
                      ) },
                {
                    key: 'tags' as any,
                    label: 'Etiquetas',
                    render: (c: any) => (
                        <InlineTags 
                            tags={c.tags || []} 
                            entityId={c.id} 
                            entityType="contact" 
                            onRefresh={() => fetchContacts()} 
                        />
                    )
                },
                {
                    key: 'email',
                    label: 'Email',
                    sortable: true,
                    render: (c) => c.email ? (
                        <div className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors">
                            <Mail size={14} className="text-slate-500" />
                            <a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a>
                        </div>
                    ) : <span className="text-slate-600">-</span>
                },
                {
                    key: 'phone',
                    label: 'Telefone / WhatsApp',
                    sortable: true,
                    render: (c) => (
                        <div className="flex flex-col gap-1">
                            {c.phone && (
                                <div className="flex items-center gap-2 text-slate-300">
                                    <Phone size={14} className="text-slate-500" />
                                    {c.phone}
                                </div>
                            )}
                            {c.whatsapp && c.whatsapp !== c.phone && (
                                <div className="flex items-center gap-2 text-emerald-400">
                                    <MessageSquare size={14} />
                                    {c.whatsapp}
                                </div>
                            )}
                            {!c.phone && !c.whatsapp && <span className="text-slate-600">-</span>}
                        </div>
                    )
                },
                {
                    key: 'actions' as any,
                    label: '',
                    render: (c) => (
                        <div className="relative flex justify-end">
                            <button 
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setOpenActionId(openActionId === c.id ? null : c.id); 
                                }}
                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <MoreHorizontal size={18} />
                            </button>
                            {openActionId === c.id && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpenActionId(null); }}></div>
                                    <div className="absolute right-0 top-full mt-1 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); navigate(`/contacts/${c.id}`); setOpenActionId(null); }}
                                            className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 font-medium flex items-center gap-2"
                                        >
                                            <Edit size={14} /> Editar
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDeleteContact(c.id, c.name); setOpenActionId(null); }}
                                            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 font-bold flex items-center gap-2 transition-colors border-t border-slate-700/50"
                                        >
                                            <Trash2 size={14} /> Excluir
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )
                }
            ]}
          />
      </div>
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} title="Contatos" sections={manualSections} />
    </div>
  );
}
