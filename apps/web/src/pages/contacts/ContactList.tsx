
import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Plus, Users, Mail, Phone, FileText, Search, Filter, MessageSquare, Settings } from 'lucide-react';
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
}

export function ContactList() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Contact | null, direction: 'asc' | 'desc' | null }>({ key: null, direction: null });
  const { isHelpOpen, setIsHelpOpen } = useHelpModal();
  
  const [includedTags, setIncludedTags] = useState<string[]>([]);
  const [excludedTags, setExcludedTags] = useState<string[]>([]);
  
  useEffect(() => {
    const controller = new AbortController();
    fetchContacts(controller.signal);
    return () => controller.abort();
  }, [includedTags, excludedTags]); // Refetch when tags change

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

  const sortedContacts = useMemo(() => {
      let sortableItems = [...contacts];
      if (searchTerm) {
          const lowerTerm = searchTerm.toLowerCase();
          sortableItems = sortableItems.filter(c => 
              (c.name && c.name.toLowerCase().includes(lowerTerm)) ||
              (c.email && c.email.toLowerCase().includes(lowerTerm)) ||
              (c.document && c.document.includes(lowerTerm))
          );
      }
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
  }, [contacts, sortConfig, searchTerm]);

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

  return (
    <div className="space-y-6 h-full flex flex-col animate-in fade-in duration-500 p-6 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
             <Users className="text-indigo-500" size={32} />
             Contatos
          </h1>
          <p className="text-slate-400 mt-1">Gerencie sua base de clientes, parceiros e fornecedores.</p>
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

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full md:max-w-xl">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                    type="text" 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nome, email ou documento..." 
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-indigo-500 placeholder-slate-500 transition-all" 
                />
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
                <button className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 flex items-center gap-2 hover:bg-slate-700 hover:text-white transition text-sm font-medium whitespace-nowrap">
                    <Filter size={16} /> Filtros
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
            totalItems={contacts.length}
            isLoading={loading}
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
                                    {c.type && (
                                        <span className={`text-[10px] font-bold px-1 rounded ${c.type === 'PJ' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                                            {c.type}
                                        </span>
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
