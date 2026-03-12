import { useEffect, useMemo, useState } from "react";
import { X, Calendar, Clock, MapPin, AlignLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../services/api";
import { CreatableSelect } from "../ui/CreatableSelect";
import { ContactPickerGlobal } from "../contacts/ContactPickerGlobal";

interface Participant {
  id?: string;
  name: string;
  role: string;
  contactId?: string;
  confirmed?: boolean;
  contactName?: string;
}

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void | Promise<void>;
  appointment?: any;
  processId?: string;
  initialDate?: Date | null;
}

const TYPE_OPTIONS = [
  { label: "Audiencia", value: "AUDIENCIA" },
  { label: "Prazo", value: "PRAZO" },
  { label: "Reuniao", value: "REUNIAO" },
  { label: "Intimacao", value: "INTIMACAO" },
  { label: "Diligencia", value: "DILIGENCIA" },
  { label: "Pericia", value: "PERICIA" },
];

const STATUS_OPTIONS = [
  { label: "Agendado", value: "SCHEDULED" },
  { label: "Confirmado", value: "CONFIRMED" },
  { label: "Em andamento", value: "IN_PROGRESS" },
  { label: "Realizado", value: "DONE" },
  { label: "Cancelado", value: "CANCELED" },
  { label: "Reagendado", value: "RESCHEDULED" },
];

const ROLE_OPTIONS = [
  { label: "Responsavel", value: "RESPONSABLE" },
  { label: "Cliente", value: "CLIENT" },
  { label: "Advogado Adverso", value: "OPPOSING" },
  { label: "Testemunha", value: "WITNESS" },
  { label: "Perito", value: "EXPERT" },
  { label: "Estagiario", value: "INTERN" },
];

const toLocalInputValue = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export function AppointmentModal({
  isOpen,
  onClose,
  onSave,
  appointment,
  processId,
  initialDate,
}: AppointmentModalProps) {
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"DETAILS" | "PARTICIPANTS">("DETAILS");
  const [savedAppointment, setSavedAppointment] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "AUDIENCIA",
    startAt: "",
    endAt: "",
    location: "",
    status: "SCHEDULED",
  });
  const [participants, setParticipants] = useState<Participant[]>([]);

  const activeAppointment = useMemo(
    () => savedAppointment || (appointment?.id ? appointment : null),
    [appointment, savedAppointment],
  );

  useEffect(() => {
    if (!isOpen) return;

    setSavedAppointment(null);
    setTab("DETAILS");

    if (appointment?.id) {
      setFormData({
        title: appointment.title || "",
        description: appointment.description || "",
        type: appointment.type || "AUDIENCIA",
        startAt: appointment.startAt
          ? toLocalInputValue(new Date(appointment.startAt))
          : "",
        endAt: appointment.endAt
          ? toLocalInputValue(new Date(appointment.endAt))
          : "",
        location: appointment.location || "",
        status: appointment.status || "SCHEDULED",
      });
      setParticipants(
        Array.isArray(appointment.participants)
          ? appointment.participants.map((participant: any) => ({
              id: participant.id,
              name:
                participant.contact?.name ||
                participant.name ||
                "Sem nome",
              role: participant.role,
              contactId: participant.contactId,
              confirmed: participant.confirmed,
              contactName: participant.contact?.name,
            }))
          : [],
      );
      return;
    }

    const baseDate = initialDate ? new Date(initialDate) : new Date();
    if (initialDate) {
      baseDate.setHours(9, 0, 0, 0);
    } else {
      baseDate.setMinutes(0, 0, 0);
      baseDate.setHours(baseDate.getHours() + 1);
    }
    const endDate = new Date(baseDate.getTime() + 60 * 60 * 1000);

    setFormData({
      title: "",
      description: "",
      type: "AUDIENCIA",
      startAt: toLocalInputValue(baseDate),
      endAt: toLocalInputValue(endDate),
      location: "",
      status: "SCHEDULED",
    });
    setParticipants([]);
  }, [appointment, initialDate, isOpen]);

  const handleGlobalAdd = async (data: any) => {
    const nameToAdd = data.isQuickAdd ? data.quickContact?.name : data.name;
    const contactId = data.contactId;

    if (!nameToAdd && !contactId) {
      toast.warning("Informe um nome ou selecione um contato.");
      return;
    }

    if (
      contactId &&
      participants.some((participant) => participant.contactId === contactId)
    ) {
      toast.warning("Este contato ja foi adicionado ao compromisso.");
      return;
    }

    setParticipants((current) => [
      ...current,
      {
        name: nameToAdd || "Sem nome",
        role: data.roleId || "CLIENT",
        contactId,
      },
    ]);
  };

  const handleRemoveParticipant = (index: number) => {
    setParticipants((current) => current.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (
    event: React.FormEvent,
    shouldClose = true,
  ) => {
    event.preventDefault();

    if (!formData.title.trim()) {
      toast.warning("Informe o titulo do compromisso.");
      return;
    }

    if (!formData.startAt || !formData.endAt) {
      toast.warning("Informe inicio e fim do compromisso.");
      return;
    }

    const start = new Date(formData.startAt);
    const end = new Date(formData.endAt);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end.getTime() <= start.getTime()
    ) {
      toast.warning("O horario final precisa ser maior que o horario inicial.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        ...formData,
        processId: activeAppointment?.processId || processId,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        participants: participants.map((participant) => ({
          contactId: participant.contactId,
          name: participant.contactId ? undefined : participant.name,
          role: participant.role,
          confirmed: participant.confirmed,
        })),
      };

      if (activeAppointment?.id) {
        const { data } = await api.patch(
          `/appointments/${activeAppointment.id}`,
          payload,
        );
        setSavedAppointment(data);
        toast.success("Compromisso atualizado!");
      } else {
        const { data } = await api.post("/appointments", payload);
        setSavedAppointment(data);
        toast.success("Compromisso criado!");
      }

      await Promise.resolve(onSave());

      if (shouldClose) {
        onClose();
      } else {
        setTab("DETAILS");
        toast.info(
          activeAppointment?.id
            ? "Alteracoes salvas."
            : "Compromisso criado e mantido em edicao.",
        );
      }
    } catch (error: any) {
      console.error(error);
      toast.error(
        error.response?.data?.message || "Erro ao salvar compromisso.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            {activeAppointment?.id ? "Editar Compromisso" : "Novo Compromisso"}
          </h2>
          <div className="flex gap-2">
            <div className="flex bg-slate-800 p-1 rounded-lg">
              <button
                onClick={() => setTab("DETAILS")}
                className={`px-3 py-1 rounded text-xs font-medium transition ${tab === "DETAILS" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"}`}
              >
                Detalhes
              </button>
              <button
                onClick={() => setTab("PARTICIPANTS")}
                className={`px-3 py-1 rounded text-xs font-medium transition ${tab === "PARTICIPANTS" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"}`}
              >
                Participantes ({participants.length})
              </button>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition ml-2"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === "DETAILS" ? (
            <form id="appointment-form" onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Titulo
                </label>
                <input
                  autoFocus
                  type="text"
                  required
                  value={formData.title}
                  onChange={(event) =>
                    setFormData({ ...formData, title: event.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none transition"
                  placeholder="Ex: Audiencia de Instrucao"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <CreatableSelect
                  label="Tipo"
                  value={formData.type}
                  options={TYPE_OPTIONS}
                  onChange={(value) => setFormData({ ...formData, type: value })}
                  onCreate={(value) => {
                    toast.info(`Novo tipo "${value}" sera usado.`);
                  }}
                  placeholder="Selecione ou crie..."
                />
                <CreatableSelect
                  label="Status"
                  value={formData.status}
                  options={STATUS_OPTIONS}
                  onChange={(value) =>
                    setFormData({ ...formData, status: value })
                  }
                  placeholder="Selecione ou crie..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Inicio
                  </label>
                  <div className="relative">
                    <Calendar
                      className="absolute left-3 top-2.5 text-slate-500"
                      size={16}
                    />
                    <input
                      type="datetime-local"
                      required
                      value={formData.startAt}
                      onChange={(event) =>
                        setFormData({ ...formData, startAt: event.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-3 py-2 text-white focus:border-indigo-500 outline-none [color-scheme:dark]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Fim
                  </label>
                  <div className="relative">
                    <Clock
                      className="absolute left-3 top-2.5 text-slate-500"
                      size={16}
                    />
                    <input
                      type="datetime-local"
                      required
                      value={formData.endAt}
                      onChange={(event) =>
                        setFormData({ ...formData, endAt: event.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-3 py-2 text-white focus:border-indigo-500 outline-none [color-scheme:dark]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Local / Link
                </label>
                <div className="relative">
                  <MapPin
                    className="absolute left-3 top-2.5 text-slate-500"
                    size={16}
                  />
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(event) =>
                      setFormData({ ...formData, location: event.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-3 py-2 text-white focus:border-indigo-500 outline-none"
                    placeholder="Sala, endereco ou link Zoom/Meet"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Descricao / Pauta
                </label>
                <div className="relative">
                  <AlignLeft
                    className="absolute left-3 top-3 text-slate-500"
                    size={16}
                  />
                  <textarea
                    value={formData.description}
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        description: event.target.value,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-3 py-2 text-white focus:border-indigo-500 outline-none resize-none h-24"
                    placeholder="Detalhes do compromisso..."
                  />
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">
                  Adicionar Participante
                </h3>
                <ContactPickerGlobal
                  onAdd={handleGlobalAdd}
                  onSelectContact={() => {}}
                  contactLabel="Nome ou Contato"
                  rolePlaceholder="Papel / Funcao"
                  className="!bg-transparent !p-0 !border-0 !shadow-none"
                  actionIcon={<Plus size={18} />}
                  customRoles={ROLE_OPTIONS}
                />
                <p className="text-[10px] text-slate-500 mt-3">
                  Busque contatos existentes ou use o "+" para cadastrar um novo
                  participante rapidamente.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-300">
                  Lista de Participantes
                </h3>
                {participants.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 bg-slate-900/50 rounded-lg border border-slate-800 border-dashed">
                    Nenhum participante adicionado.
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {participants.map((participant, index) => (
                      <div
                        key={`${participant.contactId || participant.name}-${index}`}
                        className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700 transition group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400">
                            {participant.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-white text-sm flex items-center gap-2">
                              {participant.name}
                              {participant.contactId && (
                                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 rounded border border-emerald-500/20">
                                  CONTATO
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-indigo-400">
                              {participant.role}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveParticipant(index)}
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

        <div className="p-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/50 rounded-b-xl">
          <button
            onClick={onClose}
            type="button"
            className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            Cancelar (ESC)
          </button>
          {tab === "PARTICIPANTS" && (
            <button
              type="button"
              onClick={() => setTab("DETAILS")}
              className="px-4 py-2 text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition"
            >
              Voltar para Detalhes
            </button>
          )}
          <button
            type="button"
            onClick={(event) => handleSubmit(event, false)}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            {loading && (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            Salvar
          </button>
          <button
            type="button"
            onClick={(event) => handleSubmit(event, true)}
            disabled={loading}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg shadow-lg shadow-indigo-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            {loading && (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            Salvar e Sair
          </button>
        </div>
      </div>
    </div>
  );
}
