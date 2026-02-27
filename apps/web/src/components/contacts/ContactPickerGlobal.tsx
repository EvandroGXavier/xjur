
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
        contactName?: string;
    }) => Promise<void>;
    loading?: boolean;
    actionIcon?: React.ReactNode;
    defaultRoleId?: string;
    defaultQualificationId?: string;
    context?: string;
    hideRole?: boolean;
    hideQualification?: boolean;
    customRoles?: Option[];
    roleLabel?: string;
    qualificationLabel?: string;
    onAmountChange?: (val: string) => void;
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
    contactLabel = 'Contato',
    hideContactLabel = false,
    actionIcon
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
        if (!selectedContact && !showQuickAdd) {
            toast.warning('Selecione ou cadastre um contato');
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
                amount: showAmount ? amount : undefined,
                contactName: showQuickAdd ? quickContact.name : (selectedContact?.name || '')
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

    const inputClass = "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500 transition-colors text-xs placeholder-slate-600 shadow-inner";
    const labelClass = "text-[10px] font-bold text-slate-500 uppercase mb-1 block tracking-wider";

    return (
        <div className={`bg-slate-900/50 border border-slate-800 rounded-xl p-3 shadow-lg ${className}`}>
            <div className="flex flex-col gap-3">
                {/* LINE 1: SEARCH & QUICK ADD */}
                <div className="flex flex-col md:flex-row gap-2 items-start">
                    {!hideContactLabel && (
                        <div className="shrink-0 pt-2 min-w-[60px]">
                            <label className={`${labelClass} text-indigo-400`}>{contactLabel}</label>
                        </div>
                    )}
                    
                    <div className="flex-1 flex gap-2 w-full">
                        <div className="flex-1 relative">
                            {selectedContact ? (
                                <div className="flex items-center justify-between bg-indigo-500/10 border border-indigo-500/30 rounded-lg px-3 py-1.5 text-xs text-indigo-300 animate-in zoom-in-95 h-[34px]">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-indigo-400 shrink-0 uppercase">
                                            {selectedContact.name.charAt(0)}
                                        </div>
                                        <span className="font-medium truncate">{selectedContact.name}</span>
                                        {selectedContact.document && <span className="text-[10px] opacity-50 font-mono">({selectedContact.document})</span>}
                                    </div>
                                    <button 
                                        onClick={() => {
                                            setSelectedContact(null);
                                            if (onSelectContact) onSelectContact('');
                                        }}
                                        className="p-1 hover:bg-indigo-500/20 rounded-full transition text-indigo-400"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <input 
                                        type="text"
                                        className={`${inputClass} !h-[34px] pl-8 !text-sm`}
                                        placeholder="Buscar por Nome, CPF, CNPJ, E-mail..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        autoComplete="off"
                                    />
                                    <Search className="absolute left-2.5 top-2.5 text-slate-600" size={14} />
                                    
                                    {/* SEARCH RESULTS DROPDOWN */}
                                    {isSearching && (
                                        <div className="absolute right-3 top-2.5">
                                            <Loader2 size={14} className="animate-spin text-slate-500" />
                                        </div>
                                    )}

                                    {hasSearched && !isSearching && (
                                        <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                                            {searchResults.length === 0 ? (
                                                <div className="p-4 text-center">
                                                    <p className="text-xs text-slate-500 mb-2">Nenhum contato encontrado.</p>
                                                    <button 
                                                        onClick={() => setShowQuickAdd(true)}
                                                        className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-widest flex items-center gap-2 mx-auto"
                                                    >
                                                        <Plus size={12} /> Cadastro Rápido
                                                    </button>
                                                </div>
                                            ) : (
                                                searchResults.map(contact => (
                                                    <button 
                                                        key={contact.id}
                                                        onClick={() => {
                                                            setSelectedContact(contact);
                                                            setSearchResults([]);
                                                            setSearchTerm('');
                                                            if (onSelectContact) onSelectContact(contact.id);
                                                        }}
                                                        className="w-full text-left px-4 py-3 hover:bg-slate-800 transition flex items-center justify-between group border-b border-slate-800 last:border-0"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition uppercase">
                                                                {contact.name.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <div className="text-sm font-medium text-slate-200 group-hover:text-white transition">{contact.name}</div>
                                                                {contact.document && <div className="text-[10px] text-slate-500 font-mono">{contact.document}</div>}
                                                            </div>
                                                        </div>
                                                        <Plus size={14} className="text-slate-600 opacity-0 group-hover:opacity-100 group-hover:text-indigo-500 transition" />
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {showQuickAdd ? (
                            <div className="flex-1 flex gap-2 animate-in slide-in-from-right-2">
                                <div className="flex-1 grid grid-cols-2 gap-2">
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
                        ) : (
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
                            <div className="w-[140px]">
                                <CreatableSelect 
                                    label={roleLabel}
                                    placeholder={rolePlaceholder}
                                    value={roleId}
                                    onChange={setRoleId}
                                    options={roles}
                                    onCreate={customRoles ? undefined : handleCreateRole}
                                    className="!text-[10px]"
                                />
                            </div>
                        )}
                        {!hideQualification && (
                            <div className="w-[140px]">
                                <CreatableSelect 
                                    label={qualificationLabel}
                                    placeholder="Sub-tipo..."
                                    value={qualificationId}
                                    onChange={setQualificationId}
                                    options={qualifications}
                                    onCreate={handleCreateQualification}
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
                                {loading || parentLoading ? <Loader2 className="animate-spin" size={14} /> : (actionIcon || <Plus size={14} />)}
                                {showQuickAdd ? 'Salvar' : 'Adicionar'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

