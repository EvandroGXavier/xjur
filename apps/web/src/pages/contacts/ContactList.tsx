import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Plus, Users, Mail, Phone, FileText, Search, Filter, MessageSquare, Settings, Target, Building2, User, Clock, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { DataGrid } from '../../components/ui/DataGrid';
import { InlineTags } from '../../components/ui/InlineTags';
import { AdvancedTagFilter } from '../../components/ui/AdvancedTagFilter';
import { HelpModal, useHelpModal } from '../../components/HelpModal';
import { helpContacts } from '../../data/helpManuals';

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
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCardFilter, setActiveCardFilter] = useState<CardFilter>('ALL');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Contact | null, direction: 'asc' | 'desc' | null }>({ key: null, direction: null });
  const { isHelpOpen, setIsHelpOpen } = useHelpModal();
  
  const [includedTags, setIncludedTags] = useState<string[]>([]);
  const [excludedTags, setExcludedTags] = useState<string[]>([]);
  
  useEffect(() => {
    const controller = new AbortController();
    fetchContacts(controller.signal);
    return () => controller.abort();
  }, [includedTags, excludedTags]);

  const fetchContacts = async (signal?: AbortSignal) => {
    try {
        setLoading(true);
        const params: any = {};
        if (includedTags.length > 0) params.includedTags = includedTags.join(',');
        if (excludedTags.length > 0) params.excludedTags = excludedTags.join(',');

        const response = await api.get('/contacts', { signal, params });
        console.log('Contatos carregados:', response.data);
        setContacts(Array.isArray(response.data) ? response.data : []);
    } catch (err: any) {
        if (axios.isCancel(err)) return;
        console.error(err);
        toast.error('Erro ao carregar contatos');
    } finally {
        setLoading(false);
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

      // Aplica o termo de busca via texto
      if (searchTerm) {
          const lowerTerm = searchTerm.toLowerCase();
          sortableItems = sortableItems.filter(c => 
              (c.name && c.name.toLowerCase().includes(lowerTerm)) ||
              (c.email && c.email.toLowerCase().includes(lowerTerm)) ||
              (c.document && c.document.toLowerCase().includes(lowerTerm)) ||
              (c.phone && c.phone.toLowerCase().includes(lowerTerm)) ||
              (c.whatsapp && c.whatsapp.toLowerCase().includes(lowerTerm))
          );
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

        <div className="flex items-center gap-3">
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
                    placeholder="Buscar contatos no filtro atual..." 
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-indigo-500 placeholder-slate-500 transition-all font-medium" 
                />
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
                <button className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 flex items-center gap-2 hover:bg-slate-700 hover:text-white transition text-sm font-medium whitespace-nowrap">
                    <Filter size={16} /> Filtros Adicionais
                </button>
                <button onClick={() => navigate('/contacts/config')} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition" title="Configurações de Contatos">
                    <Settings size={20} />
                </button>
            </div>
        </div>
        
        <div className="pt-2 border-t border-slate-800/50">
            {/* Tag Filter Component */}
            <AdvancedTagFilter 
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
            emptyMessage={activeCardFilter !== 'ALL' ? `Nenhum contato encontrado no filtro "${statCards.find(c => c.id === activeCardFilter)?.label}".` : "Nenhum contato encontrado."}
            columns={[
                {
                    key: 'name',
                    label: 'Nome / Razão Social',
                    sortable: true,
                    render: (c) => (
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/contacts/${c.id}`)}>
                            {c.profilePicUrl ? (
                                <img src={c.profilePicUrl} alt={c.name} className="w-10 h-10 rounded-full object-cover border border-slate-700" />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-slate-800 flex flex-col items-center justify-center border border-slate-700 font-bold text-slate-400">
                                    {c.name.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div className="flex flex-col">
                                <span className="font-medium text-white hover:text-indigo-400 transition-colors">{c.name}</span>
                                <div className="flex items-center gap-2 mt-0.5">
                                    {(c.type === 'PJ' || getCleanDoc(c).length > 11) ? (
                                        <span className={`text-[10px] font-bold px-1 rounded bg-blue-500/20 text-blue-400`}>PJ</span>
                                    ) : (c.type === 'PF' || getCleanDoc(c).length > 0) ? (
                                        <span className={`text-[10px] font-bold px-1 rounded bg-amber-500/20 text-amber-400`}>PF</span>
                                    ) : (
                                        <span className={`text-[10px] font-bold px-1 rounded bg-emerald-500/20 text-emerald-400`}>LEAD</span>
                                    )}
                                    <span className="text-slate-500 text-xs flex items-center gap-1">
                                        <FileText size={10} />
                                        {formatDocument(c.document || c.cpf || c.cnpj)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )
                },
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
                }
            ]}
          />
      </div>
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} title="Contatos" sections={helpContacts} />
    </div>
  );
}
