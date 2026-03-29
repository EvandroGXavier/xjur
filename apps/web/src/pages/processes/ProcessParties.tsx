import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../services/api';
import { toast } from 'sonner';
import {
    ChevronDown,
    ChevronRight,
    CornerDownRight,
    Mail,
    MessageCircle,
    Phone,
    Plus,
    Check,
    Search,
    Trash2,
    UserPlus,
    X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from '../../hooks/useHotkeys';

interface ProcessPartiesProps {
    processId: string;
    onPartiesChange?: (parties: ProcessParty[]) => void;
}

type PoleKey = 'active' | 'passive';

interface PartyRole {
    id: string;
    name: string;
    category: string;
}

interface PartyQualification {
    id: string;
    name: string;
}

interface ContactData {
    id: string;
    name: string;
    document?: string;
    personType: string;
    phone?: string;
    email?: string;
    whatsapp?: string;
    category?: string;
    additionalContacts?: { type: string; value: string }[];
}

export interface ProcessParty {
    id: string;
    contactId: string;
    isClient: boolean;
    isOpposing: boolean;
    notes?: string;
    role: PartyRole;
    qualification?: PartyQualification;
    contact: ContactData;
    representativeLinks?: RepresentativeLink[];
    representedPartyLinks?: { id: string; partyId: string; representativePartyId: string }[];
}

interface RepresentativeLink {
    id: string;
    partyId: string;
    representativePartyId: string;
    createdAt: string;
    representativeParty: ProcessParty;
}

interface ContactOption {
    id: string;
    name: string;
    document?: string;
}

interface QuickContactInput {
    name: string;
    document: string;
    phone: string;
    email: string;
    personType: string;
}

type ComposerState =
    | { mode: 'principal'; pole: PoleKey }
    | { mode: 'representative'; pole: PoleKey; partyId: string }
    | null;

const LAWYER_TERMS = ['ADVOGADO', 'PROCURADOR', 'DEFENSOR'];
const ACTIVE_POLE_TERMS = ['AUTOR', 'AUTORA', 'REQUERENTE', 'EXEQUENTE', 'RECLAMANTE', 'IMPETRANTE', 'APELANTE', 'AGRAVANTE', 'EMBARGANTE'];
const PASSIVE_POLE_TERMS = ['REU', 'REQUERIDO', 'REQUERIDA', 'EXECUTADO', 'EXECUTADA', 'RECLAMADO', 'RECLAMADA', 'IMPETRADO', 'APELADO', 'AGRAVADO', 'EMBARGADO'];
const COURT_TERMS = ['JUIZ', 'MAGISTRADO', 'JUIZO', 'TRIBUNAL', 'MINISTERIO PUBLICO', 'PROMOTOR'];

const normalizeText = (value?: string) =>
    (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();

const containsAnyTerm = (value: string | undefined, terms: string[]) => {
    const normalized = normalizeText(value);
    return terms.some(term => normalized.includes(term));
};

function InlinePartyComposer({
    title,
    actionLabel,
    onConfirm,
    onCancel,
}: {
    title: string;
    actionLabel: string;
    onConfirm: (payload: { contactId?: string; quickContact?: QuickContactInput }) => Promise<void>;
    onCancel: () => void;
}) {
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<ContactOption[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [selectedContact, setSelectedContact] = useState<ContactOption | null>(null);
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [quickContact, setQuickContact] = useState<QuickContactInput>({
        name: '',
        document: '',
        phone: '',
        email: '',
        personType: 'PF',
    });

    useEffect(() => {
        searchInputRef.current?.focus();
    }, []);

    useEffect(() => {
        if (showQuickAdd) return;
        if (searchTerm.trim().length < 3) {
            setSearchResults([]);
            setHasSearched(false);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                setIsSearching(true);
                const res = await api.get(`/contacts?search=${encodeURIComponent(searchTerm.trim())}`);
                const data = res.data?.data || res.data || [];
                setSearchResults(data);
                setHasSearched(true);
            } catch (error) {
                console.error('Erro ao buscar contatos', error);
                setSearchResults([]);
                setHasSearched(true);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchTerm, showQuickAdd]);

    const handleSubmit = async () => {
        if (!selectedContact && !showQuickAdd) {
            toast.warning('Selecione um contato ou use o cadastro rapido');
            return;
        }
        if (showQuickAdd && !quickContact.name.trim()) {
            toast.warning('Informe o nome do contato');
            return;
        }

        setSubmitting(true);
        try {
            await onConfirm({
                contactId: selectedContact?.id,
                quickContact: showQuickAdd ? quickContact : undefined,
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{title}</div>
                <button type="button" onClick={onCancel} className="p-1 text-slate-500 hover:text-white rounded transition-colors">
                    <X size={14} />
                </button>
            </div>

            {!showQuickAdd && (
                <div className="space-y-2">
                    {selectedContact ? (
                        <div className="flex items-center justify-between rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-sm text-indigo-200">
                            <div className="min-w-0">
                                <div className="truncate font-medium">{selectedContact.name}</div>
                                {selectedContact.document && <div className="text-[11px] font-mono text-indigo-300/80">{selectedContact.document}</div>}
                            </div>
                            <button type="button" onClick={() => setSelectedContact(null)} className="p-1 text-indigo-300 hover:text-white rounded transition-colors">
                                <X size={14} />
                            </button>
                        </div>
                    ) : (
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchTerm}
                                onChange={event => setSearchTerm(event.target.value)}
                                placeholder="Buscar por nome, CPF, CNPJ ou e-mail..."
                                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-9 py-2 text-sm text-white outline-none transition-colors focus:border-indigo-500"
                            />
                        </div>
                    )}

                    {!selectedContact && hasSearched && (
                        <div className="rounded-lg border border-slate-800 bg-slate-950/80 overflow-hidden">
                            {isSearching ? (
                                <div className="px-3 py-3 text-sm text-slate-500">Buscando...</div>
                            ) : searchResults.length > 0 ? (
                                <div className="max-h-56 overflow-y-auto divide-y divide-slate-800">
                                    {searchResults.map(contact => (
                                        <button
                                            key={contact.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedContact(contact);
                                                setSearchResults([]);
                                                setSearchTerm('');
                                            }}
                                            className="w-full px-3 py-2 text-left hover:bg-slate-900 transition-colors"
                                        >
                                            <div className="text-sm font-medium text-slate-200">{contact.name}</div>
                                            {contact.document && <div className="text-[11px] font-mono text-slate-500">{contact.document}</div>}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="px-3 py-3 text-sm text-slate-500">Nenhum contato encontrado.</div>
                            )}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={() => setShowQuickAdd(true)}
                        className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                        <UserPlus size={13} />
                        Cadastro rapido
                    </button>
                </div>
            )}

            {showQuickAdd && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input
                        ref={searchInputRef}
                        type="text"
                        value={quickContact.name}
                        onChange={event => setQuickContact(prev => ({ ...prev, name: event.target.value }))}
                        placeholder="Nome"
                        className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-indigo-500"
                    />
                    <input
                        type="text"
                        value={quickContact.document}
                        onChange={event => setQuickContact(prev => ({ ...prev, document: event.target.value }))}
                        placeholder="Documento"
                        className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-indigo-500"
                    />
                    <input
                        type="text"
                        value={quickContact.phone}
                        onChange={event => setQuickContact(prev => ({ ...prev, phone: event.target.value }))}
                        placeholder="Telefone"
                        className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-indigo-500"
                    />
                    <input
                        type="email"
                        value={quickContact.email}
                        onChange={event => setQuickContact(prev => ({ ...prev, email: event.target.value }))}
                        placeholder="E-mail"
                        className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-indigo-500"
                    />
                    <select
                        value={quickContact.personType}
                        onChange={event => setQuickContact(prev => ({ ...prev, personType: event.target.value }))}
                        className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-indigo-500"
                    >
                        <option value="PF">Pessoa Fisica</option>
                        <option value="PJ">Pessoa Juridica</option>
                    </select>
                    <button type="button" onClick={() => setShowQuickAdd(false)} className="rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-900 transition-colors">
                        Voltar para busca
                    </button>
                </div>
            )}

            <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={onCancel} className="rounded-lg border border-slate-800 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-300 hover:bg-slate-900 transition-colors">
                    Cancelar
                </button>
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-indigo-500 transition-colors disabled:opacity-50"
                >
                    {submitting ? 'Salvando...' : actionLabel}
                </button>
            </div>
        </div>
    );
}

export function ProcessParties({ processId, onPartiesChange }: ProcessPartiesProps) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [parties, setParties] = useState<ProcessParty[]>([]);
    const [selectedSection, setSelectedSection] = useState<PoleKey>('active');
    const [composer, setComposer] = useState<ComposerState>(null);
    const [roles, setRoles] = useState<PartyRole[]>([]);
    const [showCourt, setShowCourt] = useState(false);
    const [showOthers, setShowOthers] = useState(false);
    const [draggingPartyId, setDraggingPartyId] = useState<string | null>(null);

    useEffect(() => {
        fetchParties();
        fetchRoles();
    }, [processId]);

    const fetchRoles = async () => {
        try {
            const res = await api.get('/processes/party-roles');
            setRoles(res.data);
        } catch (error) {
            console.error('Erro ao buscar papéis:', error);
        }
    };

    useHotkeys({
        onNew: () => {
            if (composer) return;
            setComposer({ mode: 'principal', pole: selectedSection });
        },
        onCancel: () => {
            if (composer) setComposer(null);
        },
        enablePrint: false,
    });

    const fetchParties = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/processes/${processId}/parties`);
            setParties(res.data);
            if (onPartiesChange) onPartiesChange(res.data);
        } catch (error) {
            toast.error('Erro ao buscar partes do processo');
        } finally {
            setLoading(false);
        }
    };

    const isLawyerParty = (party: ProcessParty) =>
        containsAnyTerm(party.role.name, LAWYER_TERMS) || containsAnyTerm(party.contact.category, LAWYER_TERMS);

    const isCourtParty = (party: ProcessParty) =>
        containsAnyTerm(party.contact.category, ['MAGISTRADO']) || containsAnyTerm(party.role.name, COURT_TERMS);

    const getPole = (party: ProcessParty): PoleKey | null => {
        if (normalizeText(party.role.category) === 'POLO_ATIVO') return 'active';
        if (normalizeText(party.role.category) === 'POLO_PASSIVO') return 'passive';
        if (containsAnyTerm(party.role.name, ACTIVE_POLE_TERMS)) return 'active';
        if (containsAnyTerm(party.role.name, PASSIVE_POLE_TERMS)) return 'passive';
        return null;
    };

    const linkedRepresentativeIds = useMemo(() => {
        const ids = new Set<string>();
        parties.forEach(party => {
            party.representativeLinks?.forEach(link => ids.add(link.representativePartyId));
        });
        return ids;
    }, [parties]);

    const topLevelParties = useMemo(
        () => parties.filter(party => !(linkedRepresentativeIds.has(party.id) && isLawyerParty(party))),
        [linkedRepresentativeIds, parties],
    );

    const activeParties = useMemo(
        () => topLevelParties.filter(party => getPole(party) === 'active' && !isCourtParty(party)),
        [topLevelParties],
    );

    const passiveParties = useMemo(
        () => topLevelParties.filter(party => getPole(party) === 'passive' && !isCourtParty(party)),
        [topLevelParties],
    );

    const courtParties = useMemo(() => topLevelParties.filter(party => isCourtParty(party)), [topLevelParties]);
    const otherParties = useMemo(
        () => topLevelParties.filter(party => getPole(party) === null && !isCourtParty(party)),
        [topLevelParties],
    );

    const handleAddPrincipal = async (
        pole: PoleKey,
        payload: { contactId?: string; quickContact?: QuickContactInput },
    ) => {
        try {
            await api.post(`/processes/${processId}/parties/principal`, {
                pole,
                contactId: payload.contactId,
                quickContact: payload.quickContact,
            });
            toast.success(pole === 'active' ? 'Autor incluido' : 'Reu incluido');
            setComposer(null);
            fetchParties();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Erro ao incluir parte');
            throw error;
        }
    };

    const handleAddRepresentative = async (
        partyId: string,
        payload: { contactId?: string; quickContact?: QuickContactInput },
    ) => {
        try {
            await api.post(`/processes/${processId}/parties/${partyId}/representatives`, {
                contactId: payload.contactId,
                quickContact: payload.quickContact,
            });
            toast.success('Procurador vinculado');
            setComposer(null);
            fetchParties();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Erro ao incluir procurador');
            throw error;
        }
    };

    const handleRemovePrincipal = async (partyId: string) => {
        if (!confirm('Tem certeza que deseja remover esta parte?')) return;
        try {
            await api.delete(`/processes/${processId}/parties/${partyId}`);
            toast.success('Parte removida');
            fetchParties();
        } catch (error) {
            toast.error('Erro ao remover parte');
        }
    };

    const handleUnlinkRepresentative = async (partyId: string, representativePartyId: string) => {
        if (!confirm('Tem certeza que deseja desvincular este procurador?')) return;
        try {
            await api.delete(`/processes/${processId}/parties/${partyId}/representatives/${representativePartyId}`);
            toast.success('Procurador desvinculado');
            fetchParties();
        } catch (error) {
            toast.error('Erro ao desvincular procurador');
        }
    };

    const handleTogglePartyStatus = async (party: ProcessParty) => {
        if (isLawyerParty(party)) return;

        let nextState = { isClient: false, isOpposing: false };
        if (!party.isClient && !party.isOpposing) {
            nextState = { isClient: true, isOpposing: false };
        } else if (party.isClient) {
            nextState = { isClient: false, isOpposing: true };
        } else {
            nextState = { isClient: false, isOpposing: false };
        }

        try {
            await api.patch(`/processes/${processId}/parties/${party.id}`, nextState);
            // Atualizar localmente para feedback imediato
            setParties(prev => {
                const updated = prev.map(p => (p.id === party.id ? { ...p, ...nextState } : p));
                if (onPartiesChange) onPartiesChange(updated);
                return updated;
            });
        } catch (error) {
            toast.error('Erro ao atualizar status da parte');
        }
    };

    const handleDrop = async (e: React.DragEvent, targetPole: 'active' | 'passive') => {
        e.preventDefault();
        if (!draggingPartyId) return;

        const party = parties.find(p => p.id === draggingPartyId);
        if (!party) return;

        const currentPole = getPole(party);
        if (currentPole === targetPole) return;

        // Tentar encontrar um papel equivalente no polo de destino
        const targetRoleName = targetPole === 'active' ? 'AUTOR' : 'REU';
        const targetRole = roles.find(r => normalizeText(r.name) === targetRoleName);

        if (!targetRole) {
            toast.error(`Tipo de parte "${targetRoleName}" não encontrado no sistema.`);
            return;
        }

        try {
            await api.patch(`/processes/${processId}/parties/${draggingPartyId}`, {
                roleId: targetRole.id
            });
            toast.success(`Parte movida para o Polo ${targetPole === 'active' ? 'Ativo' : 'Passivo'}`);
            fetchParties();
        } catch (error) {
            toast.error('Erro ao mover parte');
        } finally {
            setDraggingPartyId(null);
        }
    };

    const renderQualificationBadge = (party: ProcessParty) => {
        // Advogados não levam marca de cliente/contrário segundo a regra do usuário
        if (isLawyerParty(party)) return null;

        if (!party.isClient && !party.isOpposing) return null;

        const badgeClass = party.isClient
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : 'bg-red-500/10 text-red-400 border-red-500/20';

        return (
            <span
                className={clsx(
                    'text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide border transition-all duration-300',
                    badgeClass,
                )}
            >
                {party.isClient ? 'CLIENTE' : 'CONTRARIO'}
            </span>
        );
    };

    const renderContactActions = (contact: ContactData, compact = false) => (
        <div className="flex items-center gap-1 shrink-0">
            {contact.whatsapp && (
                <a href={`https://wa.me/55${contact.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors" title="WhatsApp">
                    <MessageCircle size={compact ? 12 : 13} />
                </a>
            )}
            {contact.phone && (
                <a href={`tel:${contact.phone}`} className="p-1 text-blue-400 hover:bg-blue-500/10 rounded transition-colors" title="Telefone">
                    <Phone size={compact ? 12 : 13} />
                </a>
            )}
            {contact.email && (
                <a href={`mailto:${contact.email}`} className="p-1 text-slate-300 hover:bg-slate-700/70 rounded transition-colors" title="Email">
                    <Mail size={compact ? 12 : 13} />
                </a>
            )}
        </div>
    );

    const renderPartyRow = (party: ProcessParty, pole: PoleKey) => {
        const representatives = party.representativeLinks || [];
        const isComposerOpen = composer?.mode === 'representative' && composer.partyId === party.id;

        return (
            <div 
                key={party.id} 
                className={clsx(
                    "group px-4 py-3 hover:bg-white/5 transition-colors cursor-grab active:cursor-grabbing",
                    draggingPartyId === party.id && "opacity-40"
                )}
                draggable={!isLawyerParty(party)}
                onDragStart={() => setDraggingPartyId(party.id)}
                onDragEnd={() => setDraggingPartyId(null)}
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                        {!isLawyerParty(party) && (
                            <button
                                type="button"
                                onClick={() => handleTogglePartyStatus(party)}
                                className={clsx(
                                    'w-6 h-6 mt-0.5 flex items-center justify-center rounded-lg border transition-all active:scale-90 shrink-0',
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

                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-5">
                                <button
                                    type="button"
                                    className="min-w-0 truncate text-left font-semibold text-slate-100 hover:text-indigo-300 transition-colors"
                                    onClick={() => navigate(`/contacts/${party.contact.id}`)}
                                >
                                    {party.contact.name}
                                </button>
                                {party.contact.document && (
                                    <span className="font-mono text-[11px] text-slate-400">
                                        {party.contact.document}
                                    </span>
                                )}
                                <span className="text-[11px] uppercase tracking-wide text-slate-500">
                                    ({party.role.name})
                                </span>
                                {renderQualificationBadge(party)}
                            </div>

                        {party.notes && <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{party.notes}</p>}

                        <div className="mt-2 pl-1">
                            {representatives.length > 0 ? (
                                <div className="space-y-1">
                                    {representatives.map(link => (
                                        <div key={link.id} className="group/rep flex items-start justify-between gap-3 text-[11px] leading-5 text-slate-400">
                                            <div className="min-w-0 flex items-start gap-2">
                                                <CornerDownRight size={13} className="mt-0.5 shrink-0 text-slate-500" />
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                        <button type="button" className="min-w-0 truncate text-left font-medium text-slate-300 hover:text-indigo-300 transition-colors" onClick={() => navigate(`/contacts/${link.representativeParty.contact.id}`)}>
                                                            {link.representativeParty.contact.name}
                                                        </button>
                                                        {link.representativeParty.contact.document && <span className="font-mono text-[10px] text-slate-500">{link.representativeParty.contact.document}</span>}
                                                        <span className="text-[10px] uppercase tracking-wide text-slate-500">({link.representativeParty.role.name})</span>
                                                        {renderQualificationBadge(link.representativeParty)}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0">
                                                {renderContactActions(link.representativeParty.contact, true)}
                                                <button type="button" onClick={() => handleUnlinkRepresentative(party.id, link.representativePartyId)} className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded opacity-0 group-hover/rep:opacity-100 transition" title="Desvincular procurador">
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 pl-5 text-[11px] text-slate-600">
                                    <CornerDownRight size={13} className="shrink-0 text-slate-600" />
                                    <span>Sem procurador vinculado</span>
                                </div>
                            )}
                        </div>

                        <div className="mt-3 pl-5">
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedSection(pole);
                                    setComposer({ mode: 'representative', pole, partyId: party.id });
                                }}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-800 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300 hover:border-indigo-500/40 hover:text-indigo-300 hover:bg-indigo-500/5 transition-colors"
                            >
                                <Plus size={12} />
                                Procurador
                            </button>
                        </div>

                            {isComposerOpen && (
                                <div className="mt-3 pl-5">
                                    <InlinePartyComposer title="Vincular Procurador" actionLabel="Vincular" onCancel={() => setComposer(null)} onConfirm={payload => handleAddRepresentative(party.id, payload)} />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                        {renderContactActions(party.contact)}
                        <button type="button" onClick={() => handleRemovePrincipal(party.id)} className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded opacity-0 group-hover:opacity-100 transition" title="Remover parte">
                            <Trash2 size={13} />
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderPrincipalSection = (
        pole: PoleKey,
        title: string,
        items: ProcessParty[],
        colorClass: string,
        dotClass: string,
    ) => {
        const isSelected = selectedSection === pole;
        const isPrincipalComposerOpen = composer?.mode === 'principal' && composer.pole === pole;

        return (
            <div 
                className={clsx(
                    'rounded-xl border bg-slate-900/45 backdrop-blur-sm overflow-hidden shadow-lg shadow-black/20 transition-all duration-300', 
                    colorClass, 
                    isSelected && 'ring-1 ring-indigo-500/40',
                    draggingPartyId && "ring-2 ring-dashed ring-indigo-500/50 bg-indigo-500/5"
                )} 
                onClick={() => setSelectedSection(pole)}
                onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(e) => handleDrop(e, pole)}
            >
                <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/85 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className={clsx('w-2.5 h-2.5 rounded-full shrink-0', dotClass)} />
                            <h3 className="font-bold text-slate-200 text-xs uppercase tracking-widest truncate">{title}</h3>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">
                            {items.length} parte(s)
                            {isSelected && <span className="ml-2 text-indigo-400">F2 para incluir</span>}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={event => {
                            event.stopPropagation();
                            setSelectedSection(pole);
                            setComposer({ mode: 'principal', pole });
                        }}
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white hover:bg-indigo-500 transition-colors shrink-0"
                    >
                        <Plus size={12} />
                        {pole === 'active' ? 'Autor' : 'Reu'}
                    </button>
                </div>

                {isPrincipalComposerOpen && (
                    <div className="p-4 border-b border-slate-800 bg-slate-950/50">
                        <InlinePartyComposer title={pole === 'active' ? 'Incluir Autor' : 'Incluir Reu'} actionLabel="Incluir" onCancel={() => setComposer(null)} onConfirm={payload => handleAddPrincipal(pole, payload)} />
                    </div>
                )}

                <div className="max-h-[70vh] overflow-y-auto">
                    {items.length === 0 ? (
                        <div className="p-8 text-center text-slate-600 text-sm italic">Nenhuma parte vinculada</div>
                    ) : (
                        <div className="divide-y divide-slate-800/70">{items.map(item => renderPartyRow(item, pole))}</div>
                    )}
                </div>
            </div>
        );
    };

    const renderFlatContent = (items: ProcessParty[]) =>
        items.length === 0 ? (
            <div className="p-8 text-center text-slate-600 text-sm italic">Nenhum registro</div>
        ) : (
            <div className="divide-y divide-slate-800/70">
                {items.map(item => (
                    <div key={item.id} className="group px-4 py-3 hover:bg-white/5 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                                {!isLawyerParty(item) && (
                                    <button
                                        type="button"
                                        onClick={() => handleTogglePartyStatus(item)}
                                        className={clsx(
                                            'w-6 h-6 mt-0.5 flex items-center justify-center rounded-lg border transition-all active:scale-90 shrink-0',
                                            item.isClient
                                                ? 'bg-emerald-500 text-white border-emerald-400'
                                                : item.isOpposing
                                                  ? 'bg-red-500 text-white border-red-400'
                                                  : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500',
                                        )}
                                        title="Alternar Status"
                                    >
                                        {item.isClient ? <Check size={12} /> : item.isOpposing ? <X size={12} /> : <Plus size={12} />}
                                    </button>
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-5">
                                        <button
                                            type="button"
                                            className="min-w-0 truncate text-left font-medium text-slate-200 hover:text-indigo-300 transition-colors"
                                            onClick={() => navigate(`/contacts/${item.contact.id}`)}
                                        >
                                            {item.contact.name}
                                        </button>
                                        {item.contact.document && <span className="font-mono text-[11px] text-slate-400">{item.contact.document}</span>}
                                        <span className="text-[11px] uppercase tracking-wide text-slate-500">({item.role.name})</span>
                                        {renderQualificationBadge(item)}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                                {renderContactActions(item.contact, true)}
                                <button type="button" onClick={() => handleRemovePrincipal(item.id)} className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded opacity-0 group-hover:opacity-100 transition" title="Remover">
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );

    const renderCollapsibleSection = (
        title: string,
        count: number,
        colorClass: string,
        dotClass: string,
        isOpen: boolean,
        onToggle: () => void,
        content: JSX.Element,
    ) => (
        <div className={clsx('rounded-xl border bg-slate-900/40 overflow-hidden shadow-lg shadow-black/10', colorClass)}>
            <button type="button" onClick={onToggle} className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-900/60 transition">
                <div className="flex items-center gap-3 min-w-0">
                    <span className={clsx('w-2.5 h-2.5 rounded-full shrink-0', dotClass)} />
                    <div className="min-w-0">
                        <div className="text-xs font-bold uppercase tracking-widest text-slate-200">{title}</div>
                        <div className="text-[11px] text-slate-500">{count} registro(s)</div>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">{count}</span>
                    {isOpen ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                </div>
            </button>
            {isOpen && <div className="border-t border-slate-800/60">{content}</div>}
        </div>
    );

    return (
        <div className="animate-in fade-in space-y-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 flex items-center justify-between gap-4">
                <div>
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-300">Partes e Procuradores</div>
                    <div className="mt-1 text-[11px] text-slate-500">Clique em Autor ou Reu para selecionar a coluna. Use F2 para incluir mais rapido.</div>
                </div>
                <div className="text-[11px] text-slate-500 shrink-0">{loading ? 'Atualizando...' : `${parties.length} registro(s)`}</div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="min-w-0">{renderPrincipalSection('active', 'Polo Ativo', activeParties, 'border-emerald-500/20', 'bg-emerald-500')}</div>
                <div className="min-w-0">{renderPrincipalSection('passive', 'Polo Passivo', passiveParties, 'border-orange-400/20', 'bg-orange-400')}</div>
            </div>

            <div className="space-y-4">
                {renderCollapsibleSection('Juizo / Tribunal', courtParties.length, 'border-indigo-500/20', 'bg-indigo-400', showCourt, () => setShowCourt(prev => !prev), renderFlatContent(courtParties))}
                {renderCollapsibleSection('Outros Envolvidos', otherParties.length, 'border-slate-800', 'bg-slate-500', showOthers, () => setShowOthers(prev => !prev), renderFlatContent(otherParties))}
            </div>
        </div>
    );
}
