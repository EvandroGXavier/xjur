import { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, AlignLeft, Plus, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { CreatableSelect } from '../ui/CreatableSelect';
import { ContactPickerGlobal } from '../contacts/ContactPickerGlobal';

interface Participant {
    id?: string;
    name: string;
    role: string;
    contactId?: string;
    confirmed?: boolean;
    // Helper for display
    contactName?: string;
}

interface AppointmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    appointment?: any; 
    processId?: string;
}

// Predefined Options
const TYPE_OPTIONS = [
    { label: 'Audiência', value: 'AUDIENCIA' },
    { label: 'Prazo', value: 'PRAZO' },
    { label: 'Reunião', value: 'REUNIAO' },
    { label: 'Intimação', value: 'INTIMACAO' },
    { label: 'Diligência', value: 'DILIGENCIA' },
    { label: 'Perícia', value: 'PERICIA' }
];

const STATUS_OPTIONS = [
    { label: 'Agendado', value: 'SCHEDULED' },
    { label: 'Confirmado', value: 'CONFIRMED' },
    { label: 'Realizado', value: 'DONE' },
    { label: 'Cancelado', value: 'CANCELED' },
    { label: 'Reagendado', value: 'RESCHEDULED' }
];

const ROLE_OPTIONS = [
    { label: 'Responsável', value: 'RESPONSABLE' },
    { label: 'Cliente', value: 'CLIENT' },
    { label: 'Advogado Adverso', value: 'OPPOSING' },
    { label: 'Testemunha', value: 'WITNESS' },
    { label: 'Perito', value: 'EXPERT' },
    { label: 'Estagiário', value: 'INTERN' }
];

export function AppointmentModal({ isOpen, onClose, onSave, appointment, processId }: AppointmentModalProps) {
    const [loading, setLoading] = useState(false);
    const [tab, setTab] = useState<'DETAILS' | 'PARTICIPANTS'>('DETAILS');
    
    // Main Form Data
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        type: 'AUDIENCIA',
        startAt: '',
        endAt: '',
        location: '',
        status: 'SCHEDULED'
    });

    // Participants State
    const [participants, setParticipants] = useState<Participant[]>([]);
    
    // Search State for Participants (Now handled by ContactPickerGlobal)

    useEffect(() => {
        if (appointment) {
            setFormData({
                title: appointment.title,
                description: appointment.description || '',
                type: appointment.type,
                startAt: appointment.startAt ? new Date(appointment.startAt).toISOString().slice(0, 16) : '',
                endAt: appointment.endAt ? new Date(appointment.endAt).toISOString().slice(0, 16) : '',
                location: appointment.location || '',
                status: appointment.status
            });
            // Map existing participants
            if (appointment.participants) {
                setParticipants(appointment.participants.map((p: any) => ({
                    id: p.id,
                    name: p.contact?.name || p.name || 'Sem nome', // Fallback for ad-hoc names
                    role: p.role,
                    contactId: p.contactId,
                    confirmed: p.confirmed,
                    contactName: p.contact?.name
                })));
            }
        } else {
            // Default setup for new appointment
            const now = new Date();
            now.setMinutes(0, 0, 0);
            const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
            const nextHourEnd = new Date(nextHour.getTime() + 60 * 60 * 1000); // 1 hour duration
            
            const toLocalISO = (d: Date) => {
                const offset = d.getTimezoneOffset() * 60000;
                return new Date(d.getTime() - offset).toISOString().slice(0, 16);
            };

            setFormData({
                title: '',
                description: '',
                type: 'AUDIENCIA',
                startAt: toLocalISO(nextHour),
                endAt: toLocalISO(nextHourEnd),
                location: '',
                status: 'SCHEDULED'
            });
            setParticipants([]);
        }
    }, [appointment, isOpen]);


    const handleGlobalAdd = async (data: any) => {
        const nameToAdd = data.isQuickAdd ? data.quickContact?.name : data.name;
        const contactId = data.contactId;
        
        if (!nameToAdd && !contactId) {
            toast.warning('Informe um nome ou selecione um contato.');
            return;
        }

        setParticipants([...participants, {
            name: nameToAdd || 'Sem nome',
            role: data.roleId || 'CLIENT', // Use role from picker if available
            contactId: contactId
        }]);
    };

    const handleRemoveParticipant = (index: number) => {
        const newParts = [...participants];
        newParts.splice(index, 1);
        setParticipants(newParts);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = {
                ...formData,
                processId: appointment?.processId || processId,
                startAt: new Date(formData.startAt).toISOString(),
                endAt: new Date(formData.endAt).toISOString(),
                participants: participants.map(p => ({
                    contactId: p.contactId,
                    name: p.contactId ? undefined : p.name, // Send name only if no contactId
                    role: p.role,
                    confirmed: p.confirmed
                }))
            };

            if (appointment) {
                await api.patch(`/appointments/${appointment.id}`, payload);
                toast.success('Compromisso atualizado!');
            } else {
                await api.post('/appointments', payload);
                toast.success('Compromisso criado!');
            }
            onSave();
            onClose();
        } catch (error) {
            console.error(error);
            toast.error('Erro ao salvar compromisso.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                
                {/* HEAD */}
                <div className="flex items-center justify-between p-4 border-b border-slate-800">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        {appointment ? 'Editar Compromisso' : 'Novo Compromisso'}
                    </h2>
                    <div className="flex gap-2">
                         <div className="flex bg-slate-800 p-1 rounded-lg">
                             <button 
                                onClick={() => setTab('DETAILS')}
                                className={`px-3 py-1 rounded text-xs font-medium transition ${tab === 'DETAILS' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                             >
                                 Detalhes
                             </button>
                             <button 
                                onClick={() => setTab('PARTICIPANTS')}
                                className={`px-3 py-1 rounded text-xs font-medium transition ${tab === 'PARTICIPANTS' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                             >
                                 Participantes ({participants.length})
                             </button>
                         </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-white transition ml-2">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* BODY */}
                <div className="flex-1 overflow-y-auto p-6">
                    {tab === 'DETAILS' ? (
                        <form id="appointment-form" onSubmit={handleSubmit} className="space-y-4">
                            {/* Título */}
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Título</label>
                                <input 
                                    type="text" 
                                    required
                                    value={formData.title} 
                                    onChange={e => setFormData({...formData, title: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none transition"
                                    placeholder="Ex: Audiência de Instrução"
                                />
                            </div>

                            {/* Tipo e Status (Creatable Selects) */}
                            <div className="grid grid-cols-2 gap-4">
                                <CreatableSelect 
                                    label="Tipo"
                                    value={formData.type}
                                    options={TYPE_OPTIONS}
                                    onChange={(val) => setFormData({...formData, type: val})}
                                    onCreate={(val) => {
                                        // Optional: You could save this new type to backend
                                        toast.info(`Novo tipo "${val}" será usado.`);
                                    }}
                                    placeholder="Selecione ou crie..."
                                />
                                <CreatableSelect 
                                    label="Status"
                                    value={formData.status}
                                    options={STATUS_OPTIONS}
                                    onChange={(val) => setFormData({...formData, status: val})}
                                    placeholder="Selecione ou crie..."
                                />
                            </div>

                            {/* Datas */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Início</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-2.5 text-slate-500" size={16} />
                                        <input 
                                            type="datetime-local" 
                                            required
                                            value={formData.startAt}
                                            onChange={e => setFormData({...formData, startAt: e.target.value})}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-3 py-2 text-white focus:border-indigo-500 outline-none [color-scheme:dark]"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Fim</label>
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-2.5 text-slate-500" size={16} />
                                        <input 
                                            type="datetime-local" 
                                            required
                                            value={formData.endAt}
                                            onChange={e => setFormData({...formData, endAt: e.target.value})}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-3 py-2 text-white focus:border-indigo-500 outline-none [color-scheme:dark]"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Local */}
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Local / Link</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-2.5 text-slate-500" size={16} />
                                    <input 
                                        type="text" 
                                        value={formData.location}
                                        onChange={e => setFormData({...formData, location: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-3 py-2 text-white focus:border-indigo-500 outline-none"
                                        placeholder="Sala de Reuniões 1 ou Link Zoom"
                                    />
                                </div>
                            </div>

                            {/* Descrição */}
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Descrição / Pauta</label>
                                <div className="relative">
                                    <AlignLeft className="absolute left-3 top-3 text-slate-500" size={16} />
                                    <textarea 
                                        value={formData.description}
                                        onChange={e => setFormData({...formData, description: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-3 py-2 text-white focus:border-indigo-500 outline-none resize-none h-24"
                                        placeholder="Detalhes do compromisso..."
                                    />
                                </div>
                            </div>
                        </form>
                    ) : (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            {/* ADD PARTICIPANT FORM */}
                            {/* ADD PARTICIPANT VIA GLOBAL PICKER */}
                            <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4">
                                <h3 className="text-sm font-semibold text-slate-300 mb-3">Adicionar Participante</h3>
                                <ContactPickerGlobal 
                                    onAdd={handleGlobalAdd}
                                    onSelectContact={() => {}}
                                    contactLabel="Nome ou Contato"
                                    rolePlaceholder="Papel / Função"
                                    className="!bg-transparent !p-0 !border-0 !shadow-none"
                                    actionIcon={<Plus size={18} />}
                                    customRoles={ROLE_OPTIONS}
                                />
                                <p className="text-[10px] text-slate-500 mt-3">
                                    * Busque contatos existentes ou use o "+" para cadastrar um novo participante rapidamente.
                                </p>
                            </div>

                            {/* PARTICIPANTS LIST */}
                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold text-slate-300">Lista de Participantes</h3>
                                {participants.length === 0 ? (
                                    <div className="text-center py-8 text-slate-500 bg-slate-900/50 rounded-lg border border-slate-800 border-dashed">
                                        Nenhum participante adicionado.
                                    </div>
                                ) : (
                                    <div className="grid gap-2">
                                        {participants.map((p, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700 transition group">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400">
                                                        {p.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-white text-sm flex items-center gap-2">
                                                            {p.name}
                                                            {p.contactId && <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 rounded border border-emerald-500/20">CONTATO</span>}
                                                        </div>
                                                        <div className="text-xs text-indigo-400">{p.role}</div>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => handleRemoveParticipant(idx)}
                                                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* FOOTER */}
                <div className="p-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/50 rounded-b-xl">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                    >
                        Cancelar
                    </button>
                    {tab === 'PARTICIPANTS' && (
                        <button 
                            onClick={() => setTab('DETAILS')}
                            className="px-4 py-2 text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition"
                        >
                            Voltar para Detalhes
                        </button>
                    )}
                    <button 
                        onClick={handleSubmit}
                        disabled={loading}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg shadow-lg shadow-indigo-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                    >
                        {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        Salvar Compromisso
                    </button>
                </div>
            </div>
        </div>
    );
}

