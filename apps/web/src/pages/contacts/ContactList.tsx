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
    ShieldCheck,
    Briefcase,
    Globe,
    MapPin,
    FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { toast } from 'sonner';

import { DataGrid } from '../../components/ui/DataGrid';
import { AdvancedTagFilter } from '../../components/ui/AdvancedTagFilter';
import { InlineTags } from '../../components/ui/InlineTags';
import { HelpModal, useHelpModal } from '../../components/HelpModal';
import { helpContacts } from '../../data/helpManuals';
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
  
  const [viewMode, setViewMode] = useState<'CARD' | 'LIST'>('LIST'); // New state for view mode
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  
  useHotkeys({
      onNew: () => navigate('/contacts/new'),
      onPrint: () => window.print()
  });

  useEffect(() => {
     fetchContacts();
  }, [includedTags, excludedTags, statusFilter, searchTerm, birthDateStart, birthDateEnd, pfFilters, pjFilters, addressFilters, contractFilters, birthMonth]); // Added all filter dependencies

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

      // Aplica o termo de busca via texto (já feito na API, mas mantido para consistência se a API não for usada)
      // if (searchTerm) {
      //     const lowerTerm = searchTerm.toLowerCase();
      //     sortableItems = sortableItems.filter(c => 
      //         (c.name && c.name.toLowerCase().includes(lowerTerm)) ||
      //         (c.email && c.email.toLowerCase().includes(lowerTerm)) ||
      //         (c.document && c.document.toLowerCase().includes(lowerTerm)) ||
      //         (c.phone && c.phone.toLowerCase().includes(lowerTerm)) ||
      //         (c.whatsapp && c.whatsapp.toLowerCase().includes(lowerTerm))
      //     );
      // }

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
    // Se clicar no mesmo filtro ativo, não muda para todos, mantém ativo.
    // Se preferir modo toggle, seria:
    // setActiveCardFilter(prev => prev === cardId ? 'ALL' : cardId)
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

  const statCards = [
    { id: 'ALL', label: 'Todos os Contatos', value: stats.total, icon: Users, colorClass: 'text-indigo-400', bgClass: 'bg-indigo-500/10', borderClass: 'border-indigo-500/50' },
    { id: 'LEADS', label: 'Leads (S/ Doc)', value: stats.leads, icon: Target, colorClass: 'text-emerald-400', bgClass: 'bg-emerald-500/10', borderClass: 'border-emerald-500/50' },
    { id: 'PJ', label: 'Pessoa Jurídica', value: stats.pj, icon: Building2, colorClass: 'text-blue-400', bgClass: 'bg-blue-500/10', borderClass: 'border-blue-500/50' },
    { id: 'PF', label: 'Pessoa Física', value: stats.pf, icon: User, colorClass: 'text-amber-400', bgClass: 'bg-amber-500/10', borderClass: 'border-amber-500/50' },
    { id: 'RECENT', label: 'Recentes', value: stats.recent, icon: Clock, colorClass: 'text-purple-400', bgClass: 'bg-purple-500/10', borderClass: 'border-purple-500/50' },
  ];

  return (
    <div className="space-y-6 h-full flex flex-col animate-in fade-in duration-500 p-6 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
             <Users className="text-indigo-500" size={32} />
             Contatos
          </h1>
          <p className="text-slate-400 mt-1">Gerencie e analise sua base de clientes, leads e parceiros.</p>
        </div>

        <div className="flex items-center gap-4">
            {selectedIds.length > 0 && (
                <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-4 py-1.5 rounded-full text-sm font-semibold animate-in fade-in zoom-in-95 flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    {selectedIds.length} selecionado{selectedIds.length > 1 ? 's' : ''}
                </div>
            )}
            <button 
                onClick={() => setIsHelpOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition border border-slate-700"
                title="Ajuda (F1)"
            >
                <HelpCircle size={20} /> Ajuda
            </button>
            <button 
                onClick={() => navigate('/contacts/new')} 
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition shadow-lg shadow-indigo-500/20 whitespace-nowrap"
            >
                <Plus size={20} /> Novo Contato
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

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full md:max-w-xl">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input 
                        type="text" 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        placeholder="Buscar por nome, documento, email ou telefone..." 
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-slate-500 transition-all font-medium" 
                    />
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <select 
                        value={statusFilter} 
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="bg-slate-800 border border-slate-700 rounded-lg text-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition font-medium"
                    >
                        <option value="ALL">Todos os Contatos</option>
                        <option value="true">Somente Ativos</option>
                        <option value="false">Somente Inativos</option>
                    </select>
                    
                    <button 
                        onClick={() => setShowFilters(!showFilters)}
                        className={clsx(
                            "px-4 py-2 rounded-lg flex items-center gap-2 transition text-sm font-bold shadow-lg border",
                            showFilters ? "bg-indigo-600 text-white border-indigo-500" : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white"
                        )}
                    >
                        <Filter size={16} /> Filtros
                    </button>
                    
                    <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                        <button 
                            onClick={() => setViewMode('CARD')} 
                            className={clsx("p-1.5 rounded-md transition", viewMode === 'CARD' ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300")}
                        >
                            <LayoutGrid size={18} />
                        </button>
                        <button 
                            onClick={() => setViewMode('LIST')} 
                            className={clsx("p-1.5 rounded-md transition", viewMode === 'LIST' ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300")}
                        >
                            <List size={18} />
                        </button>
                    </div>
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
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-sm min-h-[400px]">
          <DataGrid<Contact>
            data={sortedContacts}
            onSort={(key, direction) => setSortConfig({ key: key as keyof Contact, direction })}
            totalItems={sortedContacts.length}
            isLoading={loading}
            onSelect={setSelectedIds}
            onRowClick={(c) => navigate(`/contacts/${c.id}`)}
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
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} title="Contatos" sections={helpContacts} />
    </div>
  );
}
