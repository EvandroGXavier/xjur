
import { useState, useRef, useEffect } from "react";
import { User, X, Search, Plus, Check, CreditCard, Mail, Phone, Instagram } from "lucide-react";
import { clsx } from "clsx";
import { api } from "../../../services/api";
import { toast } from "sonner";

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
  const [step, setStep] = useState<"SEARCH" | "CREATE_CONTACT" | "TICKET_DETAILS">("SEARCH");
  
  // Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Contact[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // New Contact State
  const [newContact, setNewContact] = useState({
    name: "",
    phone: "",
    email: "",
    whatsapp: "", // Auto-filled from phone usually
    instagram: ""
  });

  // Ticket Details
  const [ticketDetails, setTicketDetails] = useState({
    title: "",
    channel: "WHATSAPP",
    queue: "COMERCIAL",
    initialMessage: ""
  });

  const [loading, setLoading] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (open) {
      setStep("SEARCH");
      setSearchTerm("");
      setSearchResults([]);
      setSelectedContact(null);
      setNewContact({ name: "", phone: "", email: "", whatsapp: "", instagram: "" });
      setTicketDetails({ title: "", channel: "WHATSAPP", queue: "COMERCIAL", initialMessage: "" });
    }
  }, [open]);

  // Debounced Search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    
    if (searchTerm.length > 2 && step === "SEARCH") {
      setSearching(true);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await api.get('/contacts', { params: { search: searchTerm } });
          setSearchResults(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
          console.error(err);
        } finally {
          setSearching(false);
        }
      }, 500);
    } else {
      setSearchResults([]);
    }
  }, [searchTerm, step]);

  const handleSelectContact = (contact: Contact) => {
    setSelectedContact(contact);
    setSearchTerm(contact.name);
    setStep("TICKET_DETAILS");
  };

  const handleCreateContact = async () => {
    try {
        setLoading(true);
        // Ensure whatsapp is filled if phone provided
        const data = {
            ...newContact,
            whatsapp: newContact.whatsapp || newContact.phone?.replace(/\D/g, '') || undefined,
            phone: newContact.phone?.replace(/\D/g, '')
        };

        const res = await api.post('/contacts', data);
        setSelectedContact(res.data);
        toast.success("Contato criado com sucesso!");
        setStep("TICKET_DETAILS");
    } catch (error: any) {
        toast.error("Erro ao criar contato: " + (error.response?.data?.message || error.message));
    } finally {
        setLoading(false);
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
          
          {/* STEP 1: SEARCH CONTACT */}
          {step === "SEARCH" && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 text-slate-500" size={18} />
                <input
                  type="text"
                  placeholder="Buscar contato por nome, telefone ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
                {searching && (
                    <div className="absolute right-3 top-3">
                        <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {searchResults.map(contact => (
                  <div 
                    key={contact.id} 
                    onClick={() => handleSelectContact(contact)}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 cursor-pointer border border-transparent hover:border-slate-700 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-bold group-hover:bg-indigo-900/30 group-hover:text-indigo-300 transition-colors">
                      {contact.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-slate-200">{contact.name}</p>
                      <p className="text-xs text-slate-500">{contact.phone || contact.email || "Sem contato"}</p>
                    </div>
                  </div>
                ))}
                
                {searchTerm.length > 2 && !searching && searchResults.length === 0 && (
                    <div className="text-center py-6 text-slate-500">
                        <p>Nenhum contato encontrado.</p>
                        <button 
                            onClick={() => { setNewContact(prev => ({ ...prev, name: searchTerm })); setStep("CREATE_CONTACT"); }}
                            className="mt-2 text-indigo-400 hover:text-indigo-300 text-sm font-medium hover:underline"
                        >
                            + Cadastrar "{searchTerm}"
                        </button>
                    </div>
                )}

                {!searchTerm && (
                    <button 
                        onClick={() => setStep("CREATE_CONTACT")}
                        className="w-full py-3 border border-dashed border-slate-700 rounded-lg text-slate-400 hover:bg-slate-800/50 hover:text-indigo-400 hover:border-indigo-500/50 transition-all flex items-center justify-center gap-2"
                    >
                        <Plus size={16} /> Cadastrar Novo Contato Manualmente
                    </button>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: CREATE CONTACT */}
          {step === "CREATE_CONTACT" && (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-400">Nome Completo</label>
                    <input 
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500"
                        value={newContact.name}
                        onChange={e => setNewContact({...newContact, name: e.target.value})}
                        placeholder="Ex: João Silva"
                    />

                    <label className="text-sm font-medium text-slate-400">Telefone / WhatsApp</label>
                    <input 
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500"
                        value={newContact.phone}
                        onChange={e => setNewContact({...newContact, phone: e.target.value})}
                        placeholder="Ex: 11999999999"
                    />

                    <label className="text-sm font-medium text-slate-400">E-mail (Opcional)</label>
                    <input 
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500"
                        value={newContact.email}
                        onChange={e => setNewContact({...newContact, email: e.target.value})}
                        placeholder="email@exemplo.com"
                    />

                    <label className="text-sm font-medium text-slate-400">Instagram (Opcional)</label>
                    <input 
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500"
                        value={newContact.instagram}
                        onChange={e => setNewContact({...newContact, instagram: e.target.value})}
                        placeholder="@usuario"
                    />
                </div>
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
                        <button onClick={() => setStep("SEARCH")} className="text-xs text-indigo-400 hover:underline">Trocar contato</button>
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
            {step === "SEARCH" ? (
                <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white transition">Cancelar</button>
            ) : (
                <button 
                    onClick={() => setStep(step === "TICKET_DETAILS" ? "SEARCH" : "SEARCH")}
                    className="px-4 py-2 text-slate-400 hover:text-white transition"
                    disabled={loading}
                >
                    Voltar
                </button>
            )}

            {step === "CREATE_CONTACT" && (
                <button 
                    onClick={handleCreateContact}
                    disabled={loading || !newContact.name}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition flex items-center gap-2"
                >
                    {loading ? "Salvando..." : "Salvar Contato"}
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
