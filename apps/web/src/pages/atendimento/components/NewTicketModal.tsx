
import { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";
import { api } from "../../../services/api";
import { toast } from "sonner";
import { ContactPickerGlobal } from "../../../components/contacts/ContactPickerGlobal";

interface NewTicketModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (ticketId: string) => void;
}

interface Contact {
  id: string;
  name: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  instagram?: string;
}

export function NewTicketModal({ open, onClose, onSuccess }: NewTicketModalProps) {
  const [step, setStep] = useState<"CONTACT" | "TICKET_DETAILS">("CONTACT");
  
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // Ticket Details
  const [ticketDetails, setTicketDetails] = useState({
    title: "",
    channel: "WHATSAPP",
    queue: "COMERCIAL",
    initialMessage: ""
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setStep("CONTACT");
      setSelectedContact(null);
      setTicketDetails({ title: "", channel: "WHATSAPP", queue: "COMERCIAL", initialMessage: "" });
    }
  }, [open]);

  const handleContactSelected = async (data: any) => {
    if (data.contactId) {
        // Buscar detalhes do contato se necessário, ou apenas usar o ID
        try {
            const res = await api.get(`/contacts/${data.contactId}`);
            setSelectedContact(res.data);
            setStep("TICKET_DETAILS");
        } catch (err) {
            toast.error("Erro ao carregar contato");
        }
    } else if (data.isQuickAdd && data.quickContact) {
        // ContactPickerGlobal já salvou ou retornou os dados? 
        // Por padrão o onAdd é chamado após o salvamento se isQuickAdd for true e implementado no componente
        // Na verdade o ContactPickerGlobal no handleAction chama o onAdd com os dados.
        // Se for QuickAdd, precisamos garantir que o contato foi criado.
        // O ContactPickerGlobal atual NÃO cria o contato automaticamente no handleAction se for quickAdd,
        // ele apenas passa os dados para o pai decidir.
        
        try {
            setLoading(true);
            const res = await api.post('/contacts', {
                name: data.quickContact.name,
                document: data.quickContact.document,
                whatsapp: data.quickContact.phone?.replace(/\D/g, '') || undefined,
                personType: 'PF'
            });
            setSelectedContact(res.data);
            setStep("TICKET_DETAILS");
        } catch (err) {
            toast.error("Erro ao criar contato rápido");
        } finally {
            setLoading(false);
        }
    }
  };

  const handleCreateTicket = async () => {
    if (!selectedContact) return;
    if (!ticketDetails.title) {
        toast.error("Informe um assunto para o atendimento");
        return;
    }

    try {
      setLoading(true);
      const res = await api.post('/tickets', {
        contactId: selectedContact.id,
        title: ticketDetails.title,
        channel: ticketDetails.channel,
        queue: ticketDetails.queue,
        priority: "MEDIUM",
        description: ticketDetails.initialMessage 
      });

      // If initial message provided, send it immediately
      if (ticketDetails.initialMessage) {
        try {
            await api.post(`/tickets/${res.data.id}/messages`, {
                content: ticketDetails.initialMessage
            });
        } catch (e) {
            console.error("Failed to send initial message", e);
            toast.error("Atendimento criado, mas falha ao enviar mensagem inicial: erro de conexão");
        }
      }

      toast.success("Atendimento iniciado!");
      onSuccess(res.data.id);
      onClose();
    } catch (error: any) {
      toast.error("Erro ao criar atendimento: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Plus className="text-indigo-400" size={20} />
            Novo Atendimento
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition p-1 rounded-lg hover:bg-slate-800">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          
          {/* STEP 1: CONTACT PICKER */}
          {step === "CONTACT" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <ContactPickerGlobal 
                onAdd={handleContactSelected}
                hideRole={true}
                hideQualification={true}
                contactLabel="Cliente"
                hideQuickAdd={false}
                className="!bg-transparent !p-0 !border-0 !shadow-none"
              />
            </div>
          )}


          {/* STEP 3: TICKET DETAILS */}
          {step === "TICKET_DETAILS" && selectedContact && (
            <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">
                        {selectedContact.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <p className="font-medium text-slate-200">{selectedContact.name}</p>
                        <button onClick={() => setStep("CONTACT")} className="text-xs text-indigo-400 hover:underline">Trocar contato</button>
                    </div>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="text-sm font-medium text-slate-400 mb-1 block">Assunto do Atendimento</label>
                        <input 
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500"
                            value={ticketDetails.title}
                            onChange={e => setTicketDetails({...ticketDetails, title: e.target.value})}
                            placeholder="Ex: Dúvida sobre Processo"
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-slate-400 mb-1 block">Canal</label>
                            <select 
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500"
                                value={ticketDetails.channel}
                                onChange={e => setTicketDetails({...ticketDetails, channel: e.target.value as any})}
                            >
                                <option value="WHATSAPP">WhatsApp</option>
                                <option value="EMAIL">E-mail</option>
                                <option value="PHONE">Telefone</option>
                                <option value="INSTAGRAM">Instagram</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-400 mb-1 block">Fila / Setor</label>
                            <select 
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500"
                                value={ticketDetails.queue}
                                onChange={e => setTicketDetails({...ticketDetails, queue: e.target.value})}
                            >
                                <option value="COMERCIAL">Comercial</option>
                                <option value="JURIDICO">Jurídico</option>
                                <option value="FINANCEIRO">Financeiro</option>
                                <option value="SUPORTE">Suporte</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium text-slate-400 mb-1 block">Mensagem Inicial (Opcional)</label>
                        <textarea 
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 min-h-[80px]"
                            value={ticketDetails.initialMessage}
                            onChange={e => setTicketDetails({...ticketDetails, initialMessage: e.target.value})}
                            placeholder="Já envie uma mensagem de boas-vindas..."
                        />
                    </div>
                </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end gap-3">
            {step === "CONTACT" ? (
                <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white transition">Cancelar</button>
            ) : (
                <button 
                    onClick={() => setStep("CONTACT")}
                    className="px-4 py-2 text-slate-400 hover:text-white transition"
                    disabled={loading}
                >
                    Voltar
                </button>
            )}

            {step === "TICKET_DETAILS" && (
                <button 
                    onClick={handleCreateTicket}
                    disabled={loading || !ticketDetails.title}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-medium transition flex items-center gap-2"
                >
                    {loading ? "Criando..." : "Iniciar Atendimento"}
                </button>
            )}
        </div>

      </div>
    </div>
  );
}
