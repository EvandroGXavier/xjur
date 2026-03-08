
import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { Trash2, MessageCircle, Phone, Mail, ExternalLink, Scale, ShieldCheck } from 'lucide-react';
import { ContactPickerGlobal } from '../../components/contacts/ContactPickerGlobal';
import { clsx } from 'clsx';
import { useNavigate } from 'react-router-dom';

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
    qualification?: {
        id: string;
        name: string;
    };
    contact: {
        id: string;
        name: string;
        document?: string;
        personType: string;
        phone?: string;
        email?: string;
        whatsapp?: string;
        category?: string;
        additionalContacts?: { type: string; value: string }[];
    };
}

export function ProcessParties({ processId }: ProcessPartiesProps) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [parties, setParties] = useState<ProcessParty[]>([]);

    useEffect(() => {
        fetchParties();
    }, [processId]);

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

    const handleGlobalAdd = async (data: any) => {
        try {
            setLoading(true);
            if (data.isQuickAdd) {
                await api.post(`/processes/${processId}/parties/quick-contact`, {
                    ...data.quickContact,
                    roleId: data.roleId,
                    qualificationId: data.qualificationId
                });
            } else {
                await api.post(`/processes/${processId}/parties`, {
                    contactId: data.contactId,
                    roleId: data.roleId,
                    qualificationId: data.qualificationId
                });
            }
            toast.success(data.isQuickAdd ? 'Contato criado e vinculado!' : 'Parte adicionada com sucesso!');
            fetchParties();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Erro ao processar solicitação');
            throw err;
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
    const juizo = parties.filter(p => 
        p.contact.category === 'MAGISTRADO' || 
        ['JUIZ', 'MAGISTRADO', 'JUÍZO', 'TRIBUNAL', 'MINISTÉRIO PÚBLICO'].includes(p.role.name.toUpperCase())
    );
    const others = parties.filter(p => 
        p.role.category !== 'POLO_ATIVO' && 
        p.role.category !== 'POLO_PASSIVO' &&
        !juizo.find(j => j.id === p.id)
    );

    const renderContactActions = (party: ProcessParty) => {
        const { contact } = party;
        const balcao = contact.additionalContacts?.find(c => c.type.toLowerCase().includes('balcão virtual'));

        return (
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-800/50">
                {contact.whatsapp && (
                    <a 
                        href={`https://wa.me/55${contact.whatsapp.replace(/\D/g, '')}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-1.5 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-lg transition-all"
                        title="WhatsApp"
                    >
                        <MessageCircle size={14} />
                    </a>
                )}
                {contact.phone && (
                    <a 
                        href={`tel:${contact.phone}`} 
                        className="p-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-lg transition-all"
                        title="Telefone"
                    >
                        <Phone size={14} />
                    </a>
                )}
                {contact.email && (
                    <a 
                        href={`mailto:${contact.email}`} 
                        className="p-1.5 bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white rounded-lg transition-all"
                        title="Email"
                    >
                        <Mail size={14} />
                    </a>
                )}
                {balcao && (
                    <a 
                        href={balcao.value.startsWith('http') ? balcao.value : `https://${balcao.value}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-2 py-1 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white rounded-lg transition-all text-[10px] font-bold uppercase"
                        title="Balcão Virtual"
                    >
                        <ExternalLink size={12} />
                        Balcão Virtual
                    </a>
                )}
            </div>
        );
    };

    // Render helper for lists
    const renderList = (title: string, items: ProcessParty[], colorClass: string, icon: any) => (
        <div className={`rounded-xl border ${colorClass} bg-slate-900/50 backdrop-blur-sm overflow-hidden flex flex-col h-full shadow-lg shadow-black/20`}>
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {icon && <span className="text-slate-500">{icon}</span>}
                    <h3 className="font-bold text-slate-200 text-xs uppercase tracking-widest">{title}</h3>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                    {items.length}
                </span>
            </div>
            <div className="flex-1 divide-y divide-slate-800/50 max-h-[500px] overflow-y-auto">
                {items.length === 0 ? (
                    <div className="p-8 text-center text-slate-600 text-sm italic">
                        Nenhuma parte vinculada
                    </div>
                ) : (
                    items.map(party => (
                        <div key={party.id} className="p-4 hover:bg-white/5 transition flex flex-col group relative">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div 
                                        className={clsx(
                                            "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-inner cursor-pointer hover:scale-105 transition-transform",
                                            (party.qualification?.name === 'CLIENTE' || party.isClient) ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
                                            (party.qualification?.name === 'CONTRÁRIO' || party.isOpposing) ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
                                            party.role.name.includes('ADVOGADO') ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' :
                                            'bg-slate-800 text-slate-400 border border-slate-700'
                                        )}
                                        onClick={() => navigate(`/contacts/${party.contact.id}`)}
                                        title="Ver Contato"
                                    >
                                        {party.contact.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span 
                                                className="font-bold text-slate-100 text-sm truncate cursor-pointer hover:text-indigo-400 transition-colors"
                                                onClick={() => navigate(`/contacts/${party.contact.id}`)}
                                            >
                                                {party.contact.name}
                                            </span>
                                            {party.qualification && (
                                                <span className={clsx(
                                                    "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter border",
                                                    party.qualification.name === 'CLIENTE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                    party.qualification.name === 'CONTRÁRIO' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                    'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                                )}>
                                                    {party.qualification.name}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className={clsx(
                                                "text-[10px] font-bold px-1.5 py-0.5 rounded-md border",
                                                party.role.name.includes('ADVOGADO') ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" : "bg-slate-800 text-slate-300 border-slate-700"
                                            )}>
                                                {party.role.name}
                                            </span>
                                            {party.contact.document && <span className="text-[10px] text-slate-500 font-mono">| {party.contact.document}</span>}
                                        </div>
                                    </div>
                                </div>
                                
                                <button 
                                    onClick={() => handleRemoveParty(party.id)}
                                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition shrink-0"
                                    title="Desvincular do processo"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>

                            {renderContactActions(party)}
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    return (
        <div className="animate-in fade-in space-y-6">
            
            <ContactPickerGlobal 
                onAdd={handleGlobalAdd}
                loading={loading}
                context="processes"
            />

            {/* LISTS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {renderList('Polo Ativo (Autores)', activePole, 'border-emerald-500/20', <ShieldCheck size={16} className="text-emerald-500" />)}
                {renderList('Polo Passivo (Réus)', passivePole, 'border-red-500/20', <ShieldCheck size={16} className="text-red-500" />)}
                {renderList('Juízo / Tribunal', juizo, 'border-indigo-500/20', <Scale size={16} className="text-indigo-400" />)}
                {renderList('Outros Envolvidos', others, 'border-slate-800', null)}
            </div>

        </div>
    );
}
