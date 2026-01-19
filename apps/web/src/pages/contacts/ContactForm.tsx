import { useState, useEffect } from 'react';
import { ArrowLeft, Phone, Calendar, MessageSquare, Briefcase, FileText, Settings, Users, DollarSign, Paperclip, Home, Lock, Plus, Edit, Trash2, MapPin } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { clsx } from 'clsx';
import { getApiUrl } from '../../services/api';

// Interface matching Backend DTO
interface ContactData {
  id?: string;
  name: string;
  document: string;
  email: string;
  phone: string;
  whatsapp: string;
  notes: string;
  addresses?: Address[];
}

interface Address {
  id?: string;
  street: string;
  number: string;
  city: string;
  state: string;
  zipCode: string;
}

const TABS = [
  { id: 'contact', label: 'Contato', icon: Users },
  { id: 'addresses', label: 'Endereços', icon: Home },
  { id: 'relations', label: 'Vínculos', icon: Lock },
  { id: 'contacts', label: 'Contatos', icon: Users },
  { id: 'financial', label: 'Financeiro', icon: DollarSign },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { id: 'assets', label: 'Patrimônio', icon: Briefcase },
  { id: 'agenda', label: 'Agenda', icon: Calendar },XJUR
  { id: 'processes', label: 'Processos', icon: Settings },
  { id: 'attachments', label: 'Anexos', icon: Paperclip },
  { id: 'contracts', label: 'Contratos', icon: FileText },
  { id: 'adm', label: 'ADM', icon: Settings }
];

export function ContactForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('contact');
  const [formData, setFormData] = useState<ContactData>({
    name: '',
    document: '',
    email: '',
    phone: '',
    whatsapp: '',
    notes: '',
    addresses: []
  });
  const [loading, setLoading] = useState(false);
  
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
        const response = await fetch(`${getApiUrl()}/contacts/${id}`);
        if(response.ok) {
            const data = await response.json();
            setFormData(data);
        }
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
        const url = id && id !== 'new' 
            ? `${getApiUrl()}/contacts/${id}`
            : `${getApiUrl()}/contacts`;
            
        const method = id && id !== 'new' ? 'PATCH' : 'POST';

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            navigate('/contacts');
        } else {
            alert('Erro ao salvar contato');
        }
    } catch (err) {
        console.error(err);
        alert('Erro ao conectar com servidor');
    } finally {
        setLoading(false);
    }
  };

  // Address management functions
  const handleAddAddress = async () => {
    if (!id || id === 'new') {
      alert('Salve o contato antes de adicionar endereços');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${getApiUrl()}/contacts/${id}/addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addressForm)
      });

      if (response.ok) {
        await fetchContact();
        setAddressForm({ street: '', number: '', city: '', state: '', zipCode: '' });
        setShowAddressForm(false);
      } else {
        alert('Erro ao adicionar endereço');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao conectar com servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAddress = async () => {
    if (!id || id === 'new' || !editingAddress?.id) return;

    try {
      setLoading(true);
      const response = await fetch(`${getApiUrl()}/contacts/${id}/addresses/${editingAddress.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addressForm)
      });

      if (response.ok) {
        await fetchContact();
        setAddressForm({ street: '', number: '', city: '', state: '', zipCode: '' });
        setEditingAddress(null);
        setShowAddressForm(false);
      } else {
        alert('Erro ao atualizar endereço');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao conectar com servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!id || id === 'new') return;
    if (!confirm('Deseja realmente excluir este endereço?')) return;

    try {
      setLoading(true);
      const response = await fetch(`${getApiUrl()}/contacts/${id}/addresses/${addressId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchContact();
      } else {
        alert('Erro ao excluir endereço');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao conectar com servidor');
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
                     <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-800">
                         <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                             <Users size={20} className="text-indigo-400" /> Informações do Contato
                         </h3>
                         
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div className="space-y-2">
                                 <label className="text-sm font-medium text-slate-400">Nome Fantasia *</label>
                                 <input 
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                    placeholder="Ex: João da Silva"
                                 />
                             </div>

                             <div className="space-y-2">
                                 <label className="text-sm font-medium text-slate-400">CPF/CNPJ</label>
                                 <input 
                                    value={formData.document}
                                    onChange={e => setFormData({...formData, document: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                    placeholder="000.000.000-00"
                                 />
                             </div>

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
                                    value={formData.whatsapp}
                                    onChange={e => setFormData({...formData, whatsapp: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                    placeholder="(00) 00000-0000"
                                 />
                             </div>

                             <div className="space-y-2 md:col-span-2">
                                 <label className="text-sm font-medium text-slate-400">E-mail</label>
                                 <input 
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({...formData, email: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                    placeholder="email@exemplo.com"
                                 />
                             </div>

                             <div className="space-y-2 md:col-span-2">
                                 <label className="text-sm font-medium text-slate-400">Observações</label>
                                 <textarea 
                                    rows={4}
                                    value={formData.notes}
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
                                            <input
                                                value={addressForm.zipCode}
                                                onChange={e => setAddressForm({...addressForm, zipCode: e.target.value})}
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                                placeholder="00000-000"
                                            />
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
