import { useState, useEffect } from 'react';
import { ArrowLeft, Phone, Calendar, MessageSquare, Briefcase, FileText, Settings, Users, DollarSign, Paperclip, Home, Lock, Plus, Edit, Trash2, MapPin, Search } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { api } from '../../services/api';

// Interface matching Backend DTO
interface ContactData {
  id?: string;
  name: string;
  personType: string;
  
  // Pessoa Física
  cpf?: string;
  rg?: string;
  birthDate?: string;
  
  // Pessoa Jurídica
  cnpj?: string;
  companyName?: string;
  stateRegistration?: string;
  
  // Campos Gerais
  document?: string;
  email?: string;
  phone: string;
  whatsapp?: string;
  notes?: string;
  category?: string;
  addresses?: Address[];
  additionalContacts?: AdditionalContact[];
}

interface Address {
  id?: string;
  street: string;
  number: string;
  city: string;
  state: string;
  zipCode: string;
}

interface AdditionalContact {
  id?: string;
  type: string;
  value: string;
}

const TABS = [
  { id: 'contact', label: 'Contato', icon: Users },
  { id: 'addresses', label: 'Endereços', icon: Home },
  { id: 'relations', label: 'Vínculos', icon: Lock },
  { id: 'contacts', label: 'Contatos', icon: Users },
  { id: 'financial', label: 'Financeiro', icon: DollarSign },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { id: 'assets', label: 'Patrimônio', icon: Briefcase },
  { id: 'agenda', label: 'Agenda', icon: Calendar },
  { id: 'processes', label: 'Processos', icon: Settings },
  { id: 'attachments', label: 'Anexos', icon: Paperclip },
  { id: 'contracts', label: 'Contratos', icon: FileText },
  { id: 'adm', label: 'ADM', icon: Settings }
];

const CATEGORIES = [
  'Cliente',
  'Fornecedor',
  'Parte Contrária',
  'Perito',
  'Funcionário',
  'Advogado',
  'Juiz',
  'Testemunha',
  'Outro'
];

export function ContactForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('contact');
  const [formData, setFormData] = useState<ContactData>({
    name: '',
    personType: 'PF',
    phone: '',
    addresses: []
  });
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  
  // Address form states
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [addressForm, setAddressForm] = useState<Address>({
    street: '',
    number: '',
    city: '',
    state: '',
    zipCode: ''
  });

  useEffect(() => {
    if (id && id !== 'new') {
      fetchContact();
    }
  }, [id]);

  const fetchContact = async () => {
    try {
        setLoading(true);
        const response = await api.get(`/contacts/${id}`);
        setFormData(response.data);
    } catch(err) {
        console.error("Failed to fetch contact", err);
    } finally {
        setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
        const payload = Object.fromEntries(
          Object.entries(formData).map(([key, value]) => [
            key,
            value === '' ? null : value
          ])
        );

        if (id && id !== 'new') {
            await api.patch(`/contacts/${id}`, payload);
            toast.success('Contato atualizado com sucesso!');
        } else {
            await api.post('/contacts', payload);
            toast.success('Contato criado com sucesso!');
        }

        setTimeout(() => {
          navigate('/contacts');
        }, 1000);
    } catch (err: any) {
        console.error(err);
        const message = err.response?.data?.message || err.message || 'Erro ao conectar com servidor';
        toast.error(`Erro ao salvar contato: ${message}`);
    } finally {
        setLoading(false);
    }
  };

  // Enriquecimento de CNPJ
  const handleEnrichCNPJ = async () => {
    if (!formData.cnpj) {
      toast.warning('Digite um CNPJ para consultar');
      return;
    }

    setEnriching(true);
    try {
      const response = await api.get(`/contacts/enrich/cnpj?cnpj=${formData.cnpj}`);
      const data = response.data;
      
        setFormData({
          ...formData,
          companyName: data.razao_social || formData.companyName,
          name: data.nome_fantasia || data.razao_social || formData.name,
          email: data.email || formData.email,
          phone: data.ddd_telefone_1 || formData.phone,
        });
        toast.success('Dados do CNPJ carregados com sucesso!');
    } catch (err: any) {
      console.error(err);
      const message = err.response?.data?.message || 'CNPJ não encontrado';
      toast.error(`Erro: ${message}`);
    } finally {
      setEnriching(false);
    }
  };

  // Enriquecimento de CEP
  const handleEnrichCEP = async () => {
    if (!addressForm.zipCode) {
      toast.warning('Digite um CEP para consultar');
      return;
    }

    setEnriching(true);
    try {
      const response = await api.get(`/contacts/enrich/cep?cep=${addressForm.zipCode}`);
      const data = response.data;

        setAddressForm({
          ...addressForm,
          street: data.logradouro || addressForm.street,
          city: data.localidade || addressForm.city,
          state: data.uf || addressForm.state,
        });
        toast.success('Endereço carregado com sucesso!');
    } catch (err: any) {
      console.error(err);
      const message = err.response?.data?.message || 'CEP não encontrado';
      toast.error(`Erro: ${message}`);
    } finally {
      setEnriching(false);
    }
  };

  // Address management functions
  const handleAddAddress = async () => {
    if (!id || id === 'new') {
      toast.warning('Salve o contato antes de adicionar endereços');
      return;
    }

    try {
      setLoading(true);
      await api.post(`/contacts/${id}/addresses`, addressForm);

      await fetchContact();
      setAddressForm({ street: '', number: '', city: '', state: '', zipCode: '' });
      setShowAddressForm(false);
      toast.success('Endereço adicionado!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao adicionar endereço');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAddress = async () => {
    if (!id || id === 'new' || !editingAddress?.id) return;

    try {
      setLoading(true);
      await api.patch(`/contacts/${id}/addresses/${editingAddress.id}`, addressForm);

      await fetchContact();
      setAddressForm({ street: '', number: '', city: '', state: '', zipCode: '' });
      setEditingAddress(null);
      setShowAddressForm(false);
      toast.success('Endereço atualizado!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar endereço');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!id || id === 'new') return;
    if (!confirm('Deseja realmente excluir este endereço?')) return;

    try {
      setLoading(true);
      await api.delete(`/contacts/${id}/addresses/${addressId}`);

      await fetchContact();
      toast.success('Endereço removido!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir endereço');
    } finally {
      setLoading(false);
    }
  };

  const startEditAddress = (address: Address) => {
    setEditingAddress(address);
    setAddressForm(address);
    setShowAddressForm(true);
  };

  const cancelAddressForm = () => {
    setShowAddressForm(false);
    setEditingAddress(null);
    setAddressForm({ street: '', number: '', city: '', state: '', zipCode: '' });
  };

  // Additional Contact form states
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState<AdditionalContact | null>(null);
  const [contactForm, setContactForm] = useState<AdditionalContact>({
    type: 'EMAIL',
    value: ''
  });

  const handleAddContact = async () => {
    if (!id || id === 'new') {
        toast.warning('Salve o contato antes de adicionar contatos extras');
        return;
    }
    try {
        setLoading(true);
        await api.post(`/contacts/${id}/additional-contacts`, contactForm);
        await fetchContact();
        setContactForm({ type: 'EMAIL', value: '' });
        setShowContactForm(false);
        toast.success('Contato adicionado!');
    } catch (err) {
        console.error(err);
        toast.error('Erro ao adicionar contato extra');
    } finally {
        setLoading(false);
    }
  };

  const handleUpdateContact = async () => {
      if (!id || id === 'new' || !editingContact?.id) return;
      try {
          setLoading(true);
          await api.patch(`/contacts/${id}/additional-contacts/${editingContact.id}`, contactForm);
          await fetchContact();
          setContactForm({ type: 'EMAIL', value: '' });
          setEditingContact(null);
          setShowContactForm(false);
          toast.success('Contato atualizado!');
      } catch (err) {
          console.error(err);
          toast.error('Erro ao atualizar contato extra');
      } finally {
          setLoading(false);
      }
  };

  const handleDeleteContact = async (contactId: string) => {
      try {
          setLoading(true);
          await api.delete(`/contacts/${id}/additional-contacts/${contactId}`);
          await fetchContact();
          toast.success('Contato removido!');
      } catch (err) {
          console.error(err);
          toast.error('Erro ao remover contato extra');
      } finally {
          setLoading(false);
      }
  };

  const startEditContact = (contact: AdditionalContact) => {
      setEditingContact(contact);
      setContactForm(contact);
      setShowContactForm(true);
  };

  const cancelContactForm = () => {
      setShowContactForm(false);
      setEditingContact(null);
      setContactForm({ type: 'EMAIL', value: '' });
  };

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate('/contacts')} className="flex items-center gap-1 text-slate-400 hover:text-white transition">
                <ArrowLeft size={16} /> Voltar
            </button>
            <h1 className="text-2xl font-bold text-white">
                {id === 'new' ? 'Novo Contato' : `Editar Contato: ${formData.name}`}
            </h1>
        </div>
        <div className="flex gap-2">
            <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 text-sm border border-slate-700">
                <Phone size={14} /> Ligar
            </button>
             <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 text-sm border border-slate-700">
                <MessageSquare size={14} /> WhatsApp
            </button>
             <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 text-sm border border-slate-700">
                <Calendar size={14} /> Agenda
            </button>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col min-h-[600px]">
        {/* Tabs */}
        <div className="flex overflow-x-auto border-b border-slate-800 bg-slate-900/50">
            {TABS.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={clsx(
                        "flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                         activeTab === tab.id 
                            ? "border-indigo-500 text-indigo-400 bg-slate-800/50" 
                            : "border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/30"
                    )}
                >
                    {tab.label}
                </button>
            ))}
        </div>

        {/* Tab Content */}
        <div className="p-8">
            {activeTab === 'contact' ? (
                <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
                     {/* Tipo de Pessoa */}
                     <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-800">
                         <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                             <Users size={20} className="text-indigo-400" /> Tipo de Pessoa
                         </h3>
                         
                         <div className="flex gap-4">
                             <label className="flex items-center gap-2 cursor-pointer">
                                 <input
                                     type="radio"
                                     name="personType"
                                     value="PF"
                                     checked={formData.personType === 'PF'}
                                     onChange={e => setFormData({...formData, personType: e.target.value})}
                                     className="w-4 h-4 text-indigo-600"
                                 />
                                 <span className="text-white">Pessoa Física (PF)</span>
                             </label>
                             <label className="flex items-center gap-2 cursor-pointer">
                                 <input
                                     type="radio"
                                     name="personType"
                                     value="PJ"
                                     checked={formData.personType === 'PJ'}
                                     onChange={e => setFormData({...formData, personType: e.target.value})}
                                     className="w-4 h-4 text-indigo-600"
                                 />
                                 <span className="text-white">Pessoa Jurídica (PJ)</span>
                             </label>
                         </div>
                     </div>

                     {/* Campos Condicionais - Pessoa Física */}
                     {formData.personType === 'PF' && (
                         <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-800">
                             <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                                 <Users size={20} className="text-indigo-400" /> Dados Pessoais
                             </h3>
                             
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                 <div className="space-y-2 md:col-span-2">
                                     <label className="text-sm font-medium text-slate-400">Nome Completo *</label>
                                     <input 
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                        placeholder="Ex: João da Silva"
                                     />
                                 </div>

                                 <div className="space-y-2">
                                     <label className="text-sm font-medium text-slate-400">CPF</label>
                                     <input 
                                        value={formData.cpf || ''}
                                        onChange={e => setFormData({...formData, cpf: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                        placeholder="000.000.000-00"
                                     />
                                 </div>

                                 <div className="space-y-2">
                                     <label className="text-sm font-medium text-slate-400">RG</label>
                                     <input 
                                        value={formData.rg || ''}
                                        onChange={e => setFormData({...formData, rg: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                        placeholder="00.000.000-0"
                                     />
                                 </div>

                                 <div className="space-y-2">
                                     <label className="text-sm font-medium text-slate-400">Data de Nascimento</label>
                                     <input 
                                        type="date"
                                        value={formData.birthDate || ''}
                                        onChange={e => setFormData({...formData, birthDate: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                     />
                                 </div>
                             </div>
                         </div>
                     )}

                     {/* Campos Condicionais - Pessoa Jurídica */}
                     {formData.personType === 'PJ' && (
                         <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-800">
                             <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                                 <Briefcase size={20} className="text-indigo-400" /> Dados da Empresa
                             </h3>
                             
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                 <div className="space-y-2 md:col-span-2">
                                     <label className="text-sm font-medium text-slate-400">Nome Fantasia *</label>
                                     <input 
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                        placeholder="Ex: Empresa XYZ"
                                     />
                                 </div>

                                 <div className="space-y-2 md:col-span-2">
                                     <label className="text-sm font-medium text-slate-400">Razão Social</label>
                                     <input 
                                        value={formData.companyName || ''}
                                        onChange={e => setFormData({...formData, companyName: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                        placeholder="Razão Social da Empresa"
                                     />
                                 </div>

                                 <div className="space-y-2">
                                     <label className="text-sm font-medium text-slate-400">CNPJ</label>
                                     <div className="flex gap-2">
                                         <input 
                                            value={formData.cnpj || ''}
                                            onChange={e => setFormData({...formData, cnpj: e.target.value})}
                                            className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                            placeholder="00.000.000/0000-00"
                                         />
                                         <button
                                             type="button"
                                             onClick={handleEnrichCNPJ}
                                             disabled={enriching || !formData.cnpj}
                                             className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium transition disabled:opacity-50 flex items-center gap-2"
                                         >
                                             <Search size={16} />
                                             {enriching ? 'Consultando...' : 'Consultar'}
                                         </button>
                                     </div>
                                 </div>

                                 <div className="space-y-2">
                                     <label className="text-sm font-medium text-slate-400">Inscrição Estadual</label>
                                     <input 
                                        value={formData.stateRegistration || ''}
                                        onChange={e => setFormData({...formData, stateRegistration: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                        placeholder="000.000.000.000"
                                     />
                                 </div>
                             </div>
                         </div>
                     )}

                     {/* Campos Gerais */}
                     <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-800">
                         <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                             <Phone size={20} className="text-indigo-400" /> Informações de Contato
                         </h3>
                         
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div className="space-y-2">
                                 <label className="text-sm font-medium text-slate-400">Celular *</label>
                                 <input 
                                    required
                                    value={formData.phone}
                                    onChange={e => setFormData({...formData, phone: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                    placeholder="(00) 00000-0000"
                                 />
                             </div>

                             <div className="space-y-2">
                                 <label className="text-sm font-medium text-slate-400">WhatsApp</label>
                                 <input 
                                    value={formData.whatsapp || ''}
                                    onChange={e => setFormData({...formData, whatsapp: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                    placeholder="(00) 00000-0000"
                                 />
                             </div>

                             <div className="space-y-2 md:col-span-2">
                                 <label className="text-sm font-medium text-slate-400">E-mail</label>
                                 <input 
                                    type="email"
                                    value={formData.email || ''}
                                    onChange={e => setFormData({...formData, email: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                    placeholder="email@exemplo.com"
                                 />
                             </div>

                             <div className="space-y-2">
                                 <label className="text-sm font-medium text-slate-400">Categoria</label>
                                 <select
                                    value={formData.category || ''}
                                    onChange={e => setFormData({...formData, category: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                 >
                                     <option value="">Selecione uma categoria</option>
                                     {CATEGORIES.map(cat => (
                                         <option key={cat} value={cat}>{cat}</option>
                                     ))}
                                 </select>
                             </div>

                             <div className="space-y-2 md:col-span-2">
                                 <label className="text-sm font-medium text-slate-400">Observações</label>
                                 <textarea 
                                    rows={4}
                                    value={formData.notes || ''}
                                    onChange={e => setFormData({...formData, notes: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                    placeholder="Observações sobre o contato..."
                                 />
                             </div>
                         </div>
                     </div>

                     <div className="flex justify-end pt-4">
                         <button 
                            disabled={loading}
                            type="submit"
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium transition disabled:opacity-50"
                         >
                            {loading ? 'Salvando...' : 'Salvar Contato (Ctrl+S)'}
                         </button>
                     </div>
                </form>
            ) : activeTab === 'addresses' ? (
                <div className="space-y-6 max-w-4xl">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <MapPin size={20} className="text-indigo-400" /> Endereços Cadastrados
                        </h3>
                        <button
                            onClick={() => setShowAddressForm(true)}
                            disabled={!id || id === 'new'}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus size={16} /> Adicionar Endereço
                        </button>
                    </div>

                    {!id || id === 'new' ? (
                        <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-8 text-center">
                            <p className="text-slate-400">Salve o contato antes de adicionar endereços</p>
                        </div>
                    ) : (
                        <>
                            {/* Address Form */}
                            {showAddressForm && (
                                <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-800">
                                    <h4 className="text-md font-semibold text-white mb-4">
                                        {editingAddress ? 'Editar Endereço' : 'Novo Endereço'}
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2 md:col-span-2">
                                            <label className="text-sm font-medium text-slate-400">CEP</label>
                                            <div className="flex gap-2">
                                                <input
                                                    value={addressForm.zipCode}
                                                    onChange={e => setAddressForm({...addressForm, zipCode: e.target.value})}
                                                    className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                                    placeholder="00000-000"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleEnrichCEP}
                                                    disabled={enriching || !addressForm.zipCode}
                                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium transition disabled:opacity-50 flex items-center gap-2"
                                                >
                                                    <Search size={16} />
                                                    {enriching ? 'Consultando...' : 'Consultar'}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="space-y-2 md:col-span-2">
                                            <label className="text-sm font-medium text-slate-400">Logradouro</label>
                                            <input
                                                value={addressForm.street}
                                                onChange={e => setAddressForm({...addressForm, street: e.target.value})}
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                                placeholder="Rua, Avenida, etc."
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-400">Número</label>
                                            <input
                                                value={addressForm.number}
                                                onChange={e => setAddressForm({...addressForm, number: e.target.value})}
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                                placeholder="123"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-400">Cidade</label>
                                            <input
                                                value={addressForm.city}
                                                onChange={e => setAddressForm({...addressForm, city: e.target.value})}
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                                placeholder="São Paulo"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-400">Estado</label>
                                            <input
                                                value={addressForm.state}
                                                onChange={e => setAddressForm({...addressForm, state: e.target.value})}
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                                placeholder="SP"
                                                maxLength={2}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-2 mt-6">
                                        <button
                                            onClick={editingAddress ? handleUpdateAddress : handleAddAddress}
                                            disabled={loading}
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium transition disabled:opacity-50"
                                        >
                                            {loading ? 'Salvando...' : editingAddress ? 'Atualizar' : 'Adicionar'}
                                        </button>
                                        <button
                                            onClick={cancelAddressForm}
                                            disabled={loading}
                                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium transition disabled:opacity-50"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Address List */}
                            <div className="space-y-3">
                                {formData.addresses && formData.addresses.length > 0 ? (
                                    formData.addresses.map((address) => (
                                        <div key={address.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Home size={16} className="text-indigo-400" />
                                                        <span className="font-medium text-white">{address.street}, {address.number}</span>
                                                    </div>
                                                    <p className="text-sm text-slate-400">{address.city} - {address.state}</p>
                                                    <p className="text-sm text-slate-400">CEP: {address.zipCode}</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => startEditAddress(address)}
                                                        className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-700 rounded transition"
                                                        title="Editar"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteAddress(address.id!)}
                                                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-8 text-center">
                                        <p className="text-slate-400">Nenhum endereço cadastrado</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            ) : activeTab === 'contacts' ? (
                <div className="space-y-6 max-w-4xl">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Users size={20} className="text-indigo-400" /> Contatos Adicionais
                        </h3>
                        <button
                            onClick={() => setShowContactForm(true)}
                            disabled={!id || id === 'new'}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus size={16} /> Adicionar Contato
                        </button>
                    </div>

                    {!id || id === 'new' ? (
                        <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-8 text-center">
                            <p className="text-slate-400">Salve o contato principal antes de adicionar extras</p>
                        </div>
                    ) : (
                        <>
                            {showContactForm && (
                                <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-800">
                                    <h4 className="text-md font-semibold text-white mb-4">
                                        {editingContact ? 'Editar Contato' : 'Novo Contato Extra'}
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-400">Tipo</label>
                                            <select
                                                value={contactForm.type}
                                                onChange={e => setContactForm({...contactForm, type: e.target.value})}
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                            >
                                                <option value="EMAIL">E-mail</option>
                                                <option value="PHONE">Telefone</option>
                                                <option value="WHATSAPP">WhatsApp</option>
                                                <option value="INSTAGRAM">Instagram</option>
                                                <option value="LINKEDIN">LinkedIn</option>
                                                <option value="WEBSITE">Site</option>
                                                <option value="OTHER">Outro</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-400">Valor / Link</label>
                                            <input
                                                value={contactForm.value}
                                                onChange={e => setContactForm({...contactForm, value: e.target.value})}
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                                placeholder="ex: comercial@empresa.com"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-2 mt-6">
                                        <button
                                            onClick={editingContact ? handleUpdateContact : handleAddContact}
                                            disabled={loading}
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium transition disabled:opacity-50"
                                        >
                                            {loading ? 'Salvando...' : editingContact ? 'Atualizar' : 'Adicionar'}
                                        </button>
                                        <button
                                            onClick={cancelContactForm}
                                            disabled={loading}
                                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium transition disabled:opacity-50"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3">
                                {formData.additionalContacts && formData.additionalContacts.length > 0 ? (
                                    formData.additionalContacts.map((contact: any) => (
                                        <div key={contact.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-slate-800 rounded text-indigo-400">
                                                        {contact.type === 'EMAIL' && <Users size={18} />}
                                                        {contact.type === 'PHONE' && <Phone size={18} />}
                                                        {contact.type === 'WHATSAPP' && <MessageSquare size={18} />}
                                                        {['INSTAGRAM', 'LINKEDIN', 'WEBSITE', 'OTHER'].includes(contact.type) && <Briefcase size={18} />}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-white">{contact.value}</p>
                                                        <p className="text-xs text-slate-400 font-mono">{contact.type}</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                     <button
                                                        onClick={() => startEditContact(contact)}
                                                        className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-700 rounded transition"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteContact(contact.id)}
                                                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-8 text-center">
                                        <p className="text-slate-400">Nenhum contato adicional cadastrado</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                    <p className="mb-2">Módulo em construção</p>
                    <span className="text-xs px-2 py-1 bg-slate-800 rounded text-slate-400">Tab: {activeTab}</span>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
