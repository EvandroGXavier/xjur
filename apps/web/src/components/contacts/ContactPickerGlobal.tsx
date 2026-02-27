
import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Search, Loader2, UserPlus, Plus, X } from 'lucide-react';
import { CreatableSelect } from '../ui/CreatableSelect';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface ContactOption {
    id: string;
    name: string;
    document?: string;
}

interface Option {
    label: string;
    value: string;
}

interface ContactPickerGlobalProps {
    onAdd: (data: { 
        contactId: string; 
        roleId: string; 
        qualificationId?: string;
        notes?: string;
        isQuickAdd: boolean;
        quickContact?: any;
        amount?: string;
    }) => Promise<void>;
    loading?: boolean;
    defaultRoleId?: string;
    defaultQualificationId?: string;
    context?: string;
    hideRole?: boolean;
    hideQualification?: boolean;
    customRoles?: Option[];
    roleLabel?: string;
    qualificationLabel?: string;
    onAmountChange?: (val: string) => void;
    hideQuickAdd?: boolean;
    contactLabel?: string;
    hideContactLabel?: boolean;
    showAction?: boolean;
    className?: string;
    onSelectContact?: (id: string) => void;
    showAmount?: boolean;
    amount?: string;
    rolePlaceholder?: string;
}

export function ContactPickerGlobal({ 
    onAdd, 
    loading: parentLoading, 
    defaultRoleId, 
    defaultQualificationId,
    context = 'processes',
    hideRole = false,
    hideQualification = false,
    customRoles,
    roleLabel = "Tipo de Vínculo",
    qualificationLabel = "Qualificação",
    rolePlaceholder = "Tipo...",
    showAction = true,
    className = "",
    onSelectContact,
    showAmount = false,
    amount = '',
    onAmountChange,
    hideQuickAdd = false,
    contactLabel = 'Contato',
    hideContactLabel = false
}: ContactPickerGlobalProps) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    
    // Search state
    const [searchTerm, setSearchTerm] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<ContactOption[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [selectedContact, setSelectedContact] = useState<ContactOption | null>(null);

    // Form state
    const [roleId, setRoleId] = useState(defaultRoleId || '');
    const [qualificationId, setQualificationId] = useState(defaultQualificationId || '');
    
    // Options
    const [roles, setRoles] = useState<Option[]>([]);
    const [qualifications, setQualifications] = useState<Option[]>([]);

    const [quickContact, setQuickContact] = useState({
        name: '',
        document: '',
        phone: '',
        email: '',
        personType: 'PF'
    });

    useEffect(() => {
        if (customRoles) {
            setRoles(customRoles);
        } else if (context === 'processes') {
            fetchOptions();
        }
    }, [customRoles, context]);

    useEffect(() => {
        if (defaultRoleId) setRoleId(defaultRoleId);
        if (defaultQualificationId) setQualificationId(defaultQualificationId);
    }, [defaultRoleId, defaultQualificationId]);

    const fetchOptions = async () => {
        try {
            const [rolesRes, qualsRes] = await Promise.all([
                api.get('/processes/party-roles'),
                api.get('/processes/party-qualifications')
            ]);
            setRoles(rolesRes.data.map((r: any) => ({ label: r.name, value: r.id })));
            setQualifications(qualsRes.data.map((q: any) => ({ label: q.name, value: q.id })));
        } catch (err) {
            console.error('Erro ao buscar opções:', err);
        }
    };

    // Search contacts debounced
    useEffect(() => {
        if (searchTerm.length < 3) {
            setSearchResults([]);
            setHasSearched(false);
            return;
        }
        const timer = setTimeout(async () => {
            try {
                setIsSearching(true);
                const res = await api.get(`/contacts?search=${encodeURIComponent(searchTerm)}`);
                setSearchResults(res.data?.data || res.data || []);
                setHasSearched(true);
            } catch (err) {
                console.error('Erro na busca de contatos:', err);
            } finally {
                setIsSearching(false);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const handleCreateRole = async (name: string) => {
        try {
            const res = await api.post('/processes/party-roles', { name, category: 'OUTROS' });
            const newRole = { label: res.data.name, value: res.data.id };
            setRoles(prev => [...prev, newRole]);
            setRoleId(res.data.id);
            toast.success(`Papel "${name}" criado`);
        } catch (err) {
            toast.error('Erro ao criar tipo de vínculo');
        }
    };

    const handleCreateQualification = async (name: string) => {
        try {
            const res = await api.post('/processes/party-qualifications', { name });
            const newQual = { label: res.data.name, value: res.data.id };
            setQualifications(prev => [...prev, newQual]);
            setQualificationId(res.data.id);
            toast.success(`Qualificação "${name}" criada`);
        } catch (err) {
            toast.error('Erro ao criar qualificação');
        }
    };

    const handleAction = async () => {
        if (!showQuickAdd && !selectedContact) {
            toast.warning('Selecione um contato');
            return;
        }
        if (showQuickAdd && !quickContact.name) {
            toast.warning('O nome é obrigatório para criação rápida');
            return;
        }
        if (!hideRole && !roleId) {
            toast.warning(`Selecione o ${roleLabel}`);
            return;
        }
        if (showAmount && !amount) {
            toast.warning('Informe o valor');
            return;
        }

        setLoading(true);
        try {
            await onAdd({
                contactId: selectedContact?.id || '',
                roleId,
                qualificationId: qualificationId || undefined,
                isQuickAdd: showQuickAdd,
                quickContact: showQuickAdd ? quickContact : undefined,
                amount: showAmount ? amount : undefined
            });
            
            // Reset
            setSelectedContact(null);
            setSearchTerm('');
            setQuickContact({ name: '', document: '', phone: '', email: '', personType: 'PF' });
            setShowQuickAdd(false);
        } finally {
            setLoading(false);
        }
    };

    const handleFullAdd = () => {
        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
        navigate(`/contacts/new?returnTo=${returnUrl}`);
    };

    const inputClass = "w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition placeholder-slate-600";
    const labelClass = "block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1";

    return (
        <div className={`bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-2x ${className}`}>
            <div className="flex flex-col gap-2">
                
                {/* LINE 1: CONTACT (INLINE) */}
                <div className="w-full flex items-center gap-3">
                    {!hideContactLabel && (
                        <label className={`${labelClass} mb-0 shrink-0 min-w-[45px]`}>
                            {contactLabel}
                        </label>
                    )}
                    <div className="flex-1 flex gap-1.5">
                        {!showQuickAdd ? (
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-2.5 text-slate-500" size={14} />
                                <input 
                                    className={`${inputClass} pl-9 !h-[34px] !text-sm`}
                                    placeholder="Nome, CPF/CPNJ, E-mail..."
                                    value={selectedContact ? selectedContact.name : searchTerm}
                                    onChange={e => {
                                        setSearchTerm(e.target.value);
                                        setSelectedContact(null);
                                    }}
                                    disabled={loading || parentLoading}
                                />
                                {searchTerm.length > 2 && !selectedContact && (
                                    <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl max-h-60 overflow-y-auto ring-1 ring-black/50">
                                        {isSearching ? (
                                            <div className="p-4 flex items-center justify-center text-slate-400 gap-2 text-xs">
                                                <Loader2 size={14} className="animate-spin" /> Buscando...
                                            </div>
                                        ) : searchResults.length > 0 ? (
                                            searchResults.map(c => (
                                                <button 
                                                    key={c.id}
                                                    className="w-full text-left px-3 py-2 hover:bg-slate-700 text-xs text-slate-200 border-b border-slate-700/50 last:border-0 transition"
                                                    onClick={() => {
                                                        setSelectedContact(c);
                                                        setSearchTerm('');
                                                        setSearchResults([]);
                                                        setHasSearched(false);
                                                        if (onSelectContact) onSelectContact(c.id);
                                                    }}
                                                >
                                                    <div className="font-medium flex justify-between items-center">
                                                        <span>{c.name}</span>
                                                        {c.document && <span className="text-[9px] bg-slate-900/50 px-1.5 py-0.5 rounded text-slate-400 border border-slate-700">{c.document}</span>}
                                                    </div>
                                                </button>
                                            ))
                                        ) : hasSearched && (
                                            <div className="p-4 text-center text-slate-400 text-xs">
                                                Nenhum contato encontrado.
                                                <button 
                                                    onClick={() => setShowQuickAdd(true)}
                                                    className="text-indigo-400 hover:underline block w-full mt-2 font-medium"
                                                >
                                                    + Criar Novo Contato
                                                </button>
                                            </div>
                                        )}
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
                            <div className="flex-1 p-2 bg-slate-950 border border-slate-700 rounded-lg relative animate-in slide-in-from-top-1 duration-200">
                                <div className="flex justify-between items-center mb-1.5">
                                    <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest">Novo Contato</span>
                                    <button onClick={() => setShowQuickAdd(false)} className="text-slate-500 hover:text-white transition"><X size={10}/></button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    <input 
                                        className={`${inputClass} !bg-slate-900 !h-[30px]`} 
                                        placeholder="Nome *" 
                                        value={quickContact.name}
                                        onChange={e => setQuickContact({...quickContact, name: e.target.value})}
                                    />
                                    <input 
                                        className={`${inputClass} !bg-slate-900 !h-[30px]`} 
                                        placeholder="Doc" 
                                        value={quickContact.document}
                                        onChange={e => setQuickContact({...quickContact, document: e.target.value})}
                                    />
                                </div>
                            </div>
                        )}
                        {!showQuickAdd && (
                            <button 
                                onClick={handleFullAdd}
                                className="shrink-0 p-2.5 rounded-lg border border-indigo-500/30 text-indigo-400 hover:text-white hover:bg-indigo-600 transition flex items-center justify-center w-[44px] h-[34px]"
                                title="Cadastro Completo de Contato"
                            >
                                <UserPlus size={18} />
                            </button>
                        )}
                    </div>
                </div>

                {/* LINE 2: QUALIFICAÇÃO, AMOUNT & ACTION */}
                <div className="flex flex-col md:flex-row gap-2 items-end">
                    
                    <div className="flex-1 flex gap-2 w-full justify-between items-end">
                        {!hideRole && (
                            <div className="w-[160px]">
                                <CreatableSelect 
                                    label="Qualificação"
                                    placeholder={rolePlaceholder}
                                    value={roleId}
                                    onChange={setRoleId}
                                    options={roles}
                                    onCreate={customRoles ? undefined : handleCreateRole}
                                    className="!text-[10px]"
                                />
                            </div>
                        )}
                        {showAmount && (
                            <div className="flex-1">
                                <label className={labelClass}>Valor</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-slate-500 text-[10px] font-bold">R$</span>
                                    <input 
                                        type="number"
                                        step="0.01"
                                        className={`${inputClass} pl-10 !h-[34px] !text-sm`}
                                        placeholder="0,00"
                                        value={amount}
                                        onChange={e => onAmountChange && onAmountChange(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {showAction && (
                        <div className="shrink-0">
                            <button 
                                onClick={handleAction}
                                disabled={loading || parentLoading || (!selectedContact && !showQuickAdd)}
                                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-600/10 active:scale-95 whitespace-nowrap text-[10px] uppercase tracking-wider h-[34px]"
                            >
                                {loading || parentLoading ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
                                {showQuickAdd ? 'Salvar' : 'Adicionar'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
