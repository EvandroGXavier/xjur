
import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { Plus, Trash2, UserPlus, Search, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import { masks } from '../../utils/masks';

interface ProcessPartiesProps {
    processId: string;
}

interface PartyRole {
    id: string;
    name: string;
    category: string;
}

interface ProcessParty {
    id: string;
    contactId: string;
    isClient: boolean;
    isOpposing: boolean;
    notes?: string;
    role: PartyRole;
    contact: {
        id: string;
        name: string;
        document?: string;
        personType: string;
        phone?: string;
        email?: string;
    };
}

interface ContactOption {
    id: string;
    name: string;
    document?: string;
}

export function ProcessParties({ processId }: ProcessPartiesProps) {
    const [loading, setLoading] = useState(false);
    const [roles, setRoles] = useState<PartyRole[]>([]);
    const [parties, setParties] = useState<ProcessParty[]>([]);
    
    // Form state
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<ContactOption[]>([]);
    const [selectedContact, setSelectedContact] = useState<ContactOption | null>(null);
    
    const [newParty, setNewParty] = useState({
        roleId: '',
        isClient: false,
        isOpposing: false,
        notes: ''
    });

    const [quickContact, setQuickContact] = useState({
        name: '',
        document: '',
        phone: '',
        email: '',
        personType: 'PF'
    });

    useEffect(() => {
        fetchRoles();
        fetchParties();
    }, [processId]);

    // Search contacts debounced
    useEffect(() => {
        if (searchTerm.length < 3) {
            setSearchResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            try {
                // TODO: Implementar endpoint de busca de contatos se não houver um genérico
                // Por enquanto simulando com o endpoint geral de automação ou lista de contatos
                // Assumindo que podemos buscar contatos via query param na rota /contacts
                const res = await api.get(`/contacts?search=${searchTerm}`);
                setSearchResults(res.data?.data || res.data || []);
            } catch (err) {
                console.error(err);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const fetchRoles = async () => {
        try {
            const res = await api.get('/processes/party-roles');
            setRoles(res.data);
        } catch (err) {
            console.error('Erro ao buscar roles:', err);
            toast.error('Erro ao carregar tipos de parte');
        }
    };

    const fetchParties = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/processes/${processId}/parties`);
            setParties(res.data);
        } catch (err) {
            toast.error('Erro ao buscar partes do processo');
        } finally {
            setLoading(false);
        }
    };

    const handleAddParty = async () => {
        if (!selectedContact || !newParty.roleId) {
            toast.warning('Selecione um contato e um tipo de vínculo');
            return;
        }

        try {
            setLoading(true);
            await api.post(`/processes/${processId}/parties`, {
                contactId: selectedContact.id,
                ...newParty
            });
            toast.success('Parte adicionada com sucesso!');
            fetchParties();
            // Reset form
            setSelectedContact(null);
            setSearchTerm('');
            setNewParty({ ...newParty, notes: '' });
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Erro ao adicionar parte');
        } finally {
            setLoading(false);
        }
    };

    const handleQuickAdd = async () => {
        if (!quickContact.name || !newParty.roleId) {
            toast.warning('Nome e Tipo de Vínculo são obrigatórios');
            return;
        }

        try {
            setLoading(true);
            await api.post(`/processes/${processId}/parties/quick-contact`, {
                ...quickContact,
                roleId: newParty.roleId,
                isClient: newParty.isClient,
                isOpposing: newParty.isOpposing
            });
            toast.success('Contato criado e vinculado!');
            fetchParties();
            setShowQuickAdd(false);
            setQuickContact({ name: '', document: '', phone: '', email: '', personType: 'PF' });
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Erro ao criar contato rápido');
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveParty = async (partyId: string) => {
        if (!confirm('Tem certeza que deseja remover esta parte?')) return;
        try {
            await api.delete(`/processes/${processId}/parties/${partyId}`);
            toast.success('Parte removida');
            fetchParties();
        } catch (err) {
            toast.error('Erro ao remover parte');
        }
    };

    // Grouping
    const activePole = parties.filter(p => p.role.category === 'POLO_ATIVO');
    const passivePole = parties.filter(p => p.role.category === 'POLO_PASSIVO');
    const others = parties.filter(p => p.role.category !== 'POLO_ATIVO' && p.role.category !== 'POLO_PASSIVO');

    // Render helper for lists
    const renderList = (title: string, items: ProcessParty[], colorClass: string) => (
        <div className={`rounded-xl border ${colorClass} bg-slate-900/50 backdrop-blur-sm overflow-hidden`}>
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
                <h3 className="font-semibold text-slate-200 text-sm uppercase tracking-wider">{title}</h3>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                    {items.length}
                </span>
            </div>
            <div className="divide-y divide-slate-800">
                {items.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-sm italic">
                        Nenhuma parte neste grupo
                    </div>
                ) : (
                    items.map(party => (
                        <div key={party.id} className="p-3 hover:bg-slate-800/50 transition flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                    party.isClient ? 'bg-emerald-500/20 text-emerald-400' : 
                                    party.isOpposing ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-300'
                                }`}>
                                    {party.contact.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="font-medium text-slate-200 flex items-center gap-2">
                                        {party.contact.name}
                                        {party.isClient && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">CLIENTE</span>}
                                        {party.isOpposing && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">CONTRÁRIO</span>}
                                    </div>
                                    <div className="text-xs text-slate-500 flex items-center gap-2">
                                        <span className="text-indigo-400 font-medium">{party.role.name}</span>
                                        {party.contact.document && <span>• {party.contact.document}</span>}
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={() => handleRemoveParty(party.id)}
                                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition"
                                title="Remover parte"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    const inputClass = "w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition placeholder-slate-600";
    const labelClass = "block text-xs font-medium text-slate-400 mb-1";

    return (
        <div className="animate-in fade-in space-y-6">
            
            {/* ADD BAR */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex flex-col md:flex-row gap-4 items-end">
                    
                    {/* SEARCH CONTACT */}
                    <div className="flex-1 w-full relative">
                        <label className={labelClass}>Buscar Contato</label>
                        {!showQuickAdd ? (
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                                <input 
                                    className={`${inputClass} pl-9`}
                                    placeholder="Nome, CPF ou CNPJ..."
                                    value={selectedContact ? selectedContact.name : searchTerm}
                                    onChange={e => {
                                        setSearchTerm(e.target.value);
                                        setSelectedContact(null);
                                    }}
                                    disabled={loading}
                                />
                                {searchTerm.length > 2 && !selectedContact && searchResults.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                        {searchResults.map(c => (
                                            <button 
                                                key={c.id}
                                                className="w-full text-left px-4 py-2 hover:bg-slate-700 text-sm text-slate-200 border-b border-slate-700/50 last:border-0"
                                                onClick={() => {
                                                    setSelectedContact(c);
                                                    setSearchTerm('');
                                                    setSearchResults([]);
                                                }}
                                            >
                                                <div className="font-medium">{c.name}</div>
                                                <div className="text-xs text-slate-500">{c.document}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {selectedContact && (
                                    <button 
                                        onClick={() => { setSelectedContact(null); setSearchTerm(''); }}
                                        className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg relative">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs font-bold text-indigo-400 uppercase">Novo Contato Rápido</span>
                                    <button onClick={() => setShowQuickAdd(false)} className="text-slate-500 hover:text-white"><X size={14}/></button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <input 
                                        className={inputClass} 
                                        placeholder="Nome Completo *" 
                                        value={quickContact.name}
                                        onChange={e => setQuickContact({...quickContact, name: e.target.value})}
                                    />
                                    <input 
                                        className={inputClass} 
                                        placeholder="CPF/CNPJ" 
                                        value={quickContact.document}
                                        onChange={e => setQuickContact({...quickContact, document: masks.document(e.target.value)})}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ROLE SELECT */}
                    <div className="w-full md:w-48">
                        <label className={labelClass}>Tipo de Vínculo</label>
                        <select 
                            className={inputClass}
                            value={newParty.roleId}
                            onChange={e => {
                                const role = roles.find(r => r.id === e.target.value);
                                setNewParty({
                                    ...newParty, 
                                    roleId: e.target.value,
                                    // Auto-set flags based on category logic? Optional.
                                    isClient: role?.category === 'POLO_ATIVO' && !newParty.isClient
                                });
                            }}
                        >
                            <option value="">Selecione...</option>
                            <optgroup label="Polo Ativo">
                                {roles.filter(r => r.category === 'POLO_ATIVO').map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </optgroup>
                            <optgroup label="Polo Passivo">
                                {roles.filter(r => r.category === 'POLO_PASSIVO').map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </optgroup>
                            <optgroup label="Outros">
                                {roles.filter(r => r.category === 'OUTROS').map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </optgroup>
                        </select>
                    </div>

                    {/* FLAGS */}
                    <div className="flex gap-2 pb-2">
                        <button 
                            type="button"
                            onClick={() => setNewParty({...newParty, isClient: !newParty.isClient})}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition flex items-center gap-1.5 ${
                                newParty.isClient 
                                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                                : 'bg-slate-950 border-slate-700 text-slate-500 hover:border-slate-500'
                            }`}
                        >
                            <CheckCircle size={14} /> Cliente
                        </button>
                        <button 
                            type="button"
                            onClick={() => setNewParty({...newParty, isOpposing: !newParty.isOpposing})}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition flex items-center gap-1.5 ${
                                newParty.isOpposing 
                                ? 'bg-red-500/20 border-red-500/50 text-red-400' 
                                : 'bg-slate-950 border-slate-700 text-slate-500 hover:border-slate-500'
                            }`}
                        >
                            <AlertCircle size={14} /> Contrário
                        </button>
                    </div>

                    {/* ADD ACTION */}
                    <div className="flex gap-2">
                        {!showQuickAdd && (
                            <button 
                                onClick={() => setShowQuickAdd(true)}
                                className="p-2.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                title="Criar novo contato rápido"
                            >
                                <UserPlus size={20} />
                            </button>
                        )}
                        
                        <button 
                            onClick={showQuickAdd ? handleQuickAdd : handleAddParty}
                            disabled={loading || (!selectedContact && !showQuickAdd)}
                            className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
                        >
                            {loading ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                            {showQuickAdd ? 'Criar & Vincular' : 'Adicionar'}
                        </button>
                    </div>

                </div>
            </div>

            {/* LISTS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {renderList('Polo Ativo (Autores)', activePole, 'border-emerald-900/30')}
                {renderList('Polo Passivo (Réus)', passivePole, 'border-red-900/30')}
                {renderList('Outros Envolvidos', others, 'border-slate-800')}
            </div>

        </div>
    );
}
