
import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { ContactPickerGlobal } from '../../components/contacts/ContactPickerGlobal';

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
    };
}

export function ProcessParties({ processId }: ProcessPartiesProps) {
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
                                    party.qualification?.name === 'CLIENTE' || party.isClient ? 'bg-emerald-500/20 text-emerald-400' : 
                                    party.qualification?.name === 'CONTRÁRIO' || party.isOpposing ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-300'
                                }`}>
                                    {party.contact.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="font-medium text-slate-200 flex items-center gap-2">
                                        {party.contact.name}
                                        {party.qualification && (
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                                party.qualification.name === 'CLIENTE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                party.qualification.name === 'CONTRÁRIO' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                            }`}>
                                                {party.qualification.name}
                                            </span>
                                        )}
                                        {/* Fallback for legacy data */}
                                        {!party.qualification && party.isClient && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">CLIENTE</span>}
                                        {!party.qualification && party.isOpposing && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">CONTRÁRIO</span>}
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

    return (
        <div className="animate-in fade-in space-y-6">
            
            <ContactPickerGlobal 
                onAdd={handleGlobalAdd}
                loading={loading}
                context="processes"
            />

            {/* LISTS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {renderList('Polo Ativo (Autores)', activePole, 'border-emerald-900/30')}
                {renderList('Polo Passivo (Réus)', passivePole, 'border-red-900/30')}
                {renderList('Outros Envolvidos', others, 'border-slate-800')}
            </div>

        </div>
    );
}
