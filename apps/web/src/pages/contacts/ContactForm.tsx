import { useState, useEffect } from 'react';
import { ArrowLeft, Phone, Calendar, MessageSquare, Briefcase, FileText, Settings, Users, DollarSign, Paperclip, Home, Lock, Plus, Edit, Trash2, MapPin, Search } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { api } from '../../services/api';
<<<<<<< HEAD
=======
import { masks } from '../../utils/masks';

import { PJTab } from './PJTab';
>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69

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
  
<<<<<<< HEAD
=======
  // Dados Expandidos PJ
  openingDate?: string;
  size?: string;
  legalNature?: string;
  mainActivity?: { code: string; text: string };
  sideActivities?: { code: string; text: string }[];
  shareCapital?: string; // or number, keeping basic for form
  status?: string;
  statusDate?: string;
  specialStatus?: string;
  specialStatusDate?: string;
  pjQsa?: any[];
  
>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69
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

<<<<<<< HEAD
=======
// ... (Address, AdditionalContact, RelationType interfaces remain same)

// ...


>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69
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

interface RelationType {
  id: string;
  name: string;
  reverseName?: string;
  isBilateral: boolean;
}

interface ContactRelation {
  id: string;
  relatedContact: {
    id: string;
    name: string;
    personType: string;
  };
  type: string;
  isInverse: boolean;
}

interface AssetType {
  id: string;
  name: string;
}

interface ContactAsset {
  id: string;
  assetType: AssetType;
  description: string;
  acquisitionDate: string;
  value: number;
  writeOffDate?: string;
  notes?: string;
}

const TABS = [
  { id: 'contact', label: 'Contato', icon: Users },
  { id: 'addresses', label: 'Endereços', icon: Home },
<<<<<<< HEAD
  { id: 'contacts', label: 'Contatos', icon: Users },
  { id: 'relations', label: 'Vínculos', icon: Lock },
  { id: 'attachments', label: 'Anexos', icon: Paperclip },
  { id: 'assets', label: 'Patrimônio', icon: Briefcase },
  { id: 'contracts', label: 'Contratos', icon: FileText },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { id: 'financial', label: 'Financeiro', icon: DollarSign },
  { id: 'processes', label: 'Processos', icon: Settings },
  { id: 'agenda', label: 'Agenda', icon: Calendar },
  { id: 'pj_create', label: 'PJ (CRIAR)', icon: Briefcase },
  { id: 'pf_create', label: 'PF (CRIAR)', icon: Users },
=======
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
>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69
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
<<<<<<< HEAD
    addresses: []
=======
    addresses: [],
    sideActivities: [],
    pjQsa: []
>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69
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

  // Relations state
  const [relations, setRelations] = useState<ContactRelation[]>([]);
  const [relationTypes, setRelationTypes] = useState<RelationType[]>([]);
  const [availableContacts, setAvailableContacts] = useState<ContactData[]>([]);
  const [showRelationForm, setShowRelationForm] = useState(false);
  const [relationForm, setRelationForm] = useState({
      toContactId: '',
      relationTypeId: '',
      newTypeName: '',
      isBilateral: false
  });
  const [creatingType, setCreatingType] = useState(false);

  // Assets state
  const [assets, setAssets] = useState<ContactAsset[]>([]);
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<ContactAsset | null>(null);
  const [assetForm, setAssetForm] = useState({
      assetTypeId: '',
      newTypeName: '',
      description: '',
      acquisitionDate: '',
      value: '',
      writeOffDate: '',
      notes: ''
  });
  const [creatingAssetType, setCreatingAssetType] = useState(false);

  const fetchRelations = async () => {
      try {
          const response = await api.get(`/contacts/${id}/relations`);
          setRelations(response.data);
      } catch (err) {
          console.error("Failed to fetch relations", err);
      }
  };

  const fetchAssets = async () => {
      try {
          const response = await api.get(`/contacts/${id}/assets`);
          setAssets(response.data);
      } catch (err) {
          console.error("Failed to fetch assets", err);
      }
  };

  const fetchAssetTypes = async () => {
      try {
          const response = await api.get('/contacts/assets/types');
          setAssetTypes(response.data);
      } catch (err) {
          console.error("Failed to fetch asset types", err);
      }
  };

  const fetchRelationTypes = async () => {
      try {
          const response = await api.get('/contacts/relations/types');
          setRelationTypes(response.data);
      } catch (err) {
          console.error("Failed to fetch relation types", err);
      }
  };

  const fetchAvailableContacts = async () => {
      try {
          const response = await api.get('/contacts');
          setAvailableContacts(response.data.filter((c: any) => c.id !== id));
      } catch (err) {
          console.error("Failed to fetch contacts", err);
      }
  };

  const handleCreateRelation = async () => {
      try {
          setLoading(true);
          let typeId = relationForm.relationTypeId;

          // Se estiver criando um novo tipo
          if (creatingType && relationForm.newTypeName) {
              const typeResponse = await api.post('/contacts/relations/types', {
                  name: relationForm.newTypeName,
                  isBilateral: relationForm.isBilateral
              });
              typeId = typeResponse.data.id;
              await fetchRelationTypes(); // Atualiza lista
          }

          if (!typeId) {
              toast.warning('Selecione ou crie um tipo de vínculo');
              setLoading(false);
              return;
          }

          if (!relationForm.toContactId) {
             toast.warning('Selecione o contato vinculado');
             setLoading(false);
             return;
          }

          await api.post(`/contacts/${id}/relations`, {
              toContactId: relationForm.toContactId,
              relationTypeId: typeId
          });

          await fetchRelations();
          setShowRelationForm(false);
          setRelationForm({ toContactId: '', relationTypeId: '', newTypeName: '', isBilateral: false });
          setCreatingType(false);
          toast.success('Vínculo criado com sucesso!');
      } catch (err) {
          console.error(err);
          toast.error('Erro ao criar vínculo');
      } finally {
          setLoading(false);
      }
  };

  const  handleDeleteRelation = async (relationId: string) => {
      if(!confirm('Deseja remover este vínculo?')) return;
      try {
          setLoading(true);
          await api.delete(`/contacts/${id}/relations/${relationId}`);
          await fetchRelations();
          toast.success('Vínculo removido!');
      } catch (err) {
          console.error(err);
          toast.error('Erro ao remover vínculo');
      } finally {
          setLoading(false);
      }
  };

  const handleCreateAsset = async () => {
      try {
          setLoading(true);
          let typeId = assetForm.assetTypeId;

          if (creatingAssetType && assetForm.newTypeName) {
              const typeResponse = await api.post('/contacts/assets/types', {
                  name: assetForm.newTypeName
              });
              typeId = typeResponse.data.id;
              await fetchAssetTypes();
          }

          if (!typeId) {
              toast.warning('Selecione ou crie um tipo de patrimônio');
              setLoading(false);
              return;
          }

          if (!assetForm.description || !assetForm.acquisitionDate || !assetForm.value) {
              toast.warning('Preencha os campos obrigatórios (Descrição, Data Aquisição, Valor)');
              setLoading(false);
              return;
          }

          const payload = {
              assetTypeId: typeId,
              description: assetForm.description,
              acquisitionDate: new Date(assetForm.acquisitionDate).toISOString(),
              value: parseFloat(assetForm.value.replace(',', '.')), // Basic parse
              writeOffDate: assetForm.writeOffDate ? new Date(assetForm.writeOffDate).toISOString() : undefined,
              notes: assetForm.notes
          };

          if (editingAsset) {
              await api.patch(`/contacts/${id}/assets/${editingAsset.id}`, payload);
              toast.success('Patrimônio atualizado!');
          } else {
              await api.post(`/contacts/${id}/assets`, payload);
              toast.success('Patrimônio adicionado!');
          }

          await fetchAssets();
          cancelAssetForm();
      } catch (err) {
          console.error(err);
          toast.error('Erro ao salvar patrimônio');
      } finally {
          setLoading(false);
      }
  };

  const handleDeleteAsset = async (assetId: string) => {
      if(!confirm('Deseja remover este item do patrimônio?')) return;
      try {
          setLoading(true);
          await api.delete(`/contacts/${id}/assets/${assetId}`);
          await fetchAssets();
          toast.success('Patrimônio removido!');
      } catch (err) {
          console.error(err);
          toast.error('Erro ao remover patrimônio');
      } finally {
          setLoading(false);
      }
  };
  
  const startEditAsset = (asset: ContactAsset) => {
      setEditingAsset(asset);
      setAssetForm({
          assetTypeId: asset.assetType.id,
          newTypeName: '',
          description: asset.description,
          acquisitionDate: asset.acquisitionDate ? asset.acquisitionDate.split('T')[0] : '',
          value: asset.value.toString(),
          writeOffDate: asset.writeOffDate ? asset.writeOffDate.split('T')[0] : '',
          notes: asset.notes || ''
      });
      setShowAssetForm(true);
      setCreatingAssetType(false);
  };

  const cancelAssetForm = () => {
      setShowAssetForm(false);
      setEditingAsset(null);
      setAssetForm({
          assetTypeId: '',
          newTypeName: '',
          description: '',
          acquisitionDate: '',
          value: '',
          writeOffDate: '',
          notes: ''
      });
      setCreatingAssetType(false);
  };

  const fetchContact = async () => {
    try {
        setLoading(true);
        const response = await api.get(`/contacts/${id}`);
<<<<<<< HEAD
        const { pfData, pjData, ...rest } = response.data;
        
        // Flatten nested data for form
        const flattened = {
            ...rest,
            cpf: pfData?.cpf || rest.cpf,
            rg: pfData?.rg || rest.rg,
            birthDate: pfData?.birthDate ? new Date(pfData.birthDate).toISOString().split('T')[0] : rest.birthDate,
            
            cnpj: pjData?.cnpj || rest.cnpj,
            companyName: pjData?.companyName || rest.companyName,
            stateRegistration: pjData?.stateReg || rest.stateRegistration,
        };
        
        setFormData(flattened);
=======
        setFormData(response.data);
>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69
    } catch(err) {
        console.error("Failed to fetch contact", err);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    if (id && id !== 'new') {
      fetchContact();
      fetchRelations();
      fetchAssets();
    }
    fetchRelationTypes();
    fetchAssetTypes();
    fetchAvailableContacts();
  }, [id]);

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
      
<<<<<<< HEAD
        setFormData({
          ...formData,
          companyName: data.razao_social || formData.companyName,
          name: data.nome_fantasia || data.razao_social || formData.name,
          email: data.email || formData.email,
          phone: data.ddd_telefone_1 || formData.phone,
        });
        toast.success('Dados do CNPJ carregados com sucesso!');
=======
      // ReceitaWS returns 'nome' (Razão Social) and 'fantasia' (Nome Fantasia)
      const companyName = data.nome || data.razao_social || formData.companyName;
      const tradeName = data.fantasia || data.nome_fantasia || companyName || formData.name;

        setFormData({
          ...formData,
          companyName: companyName,
          name: tradeName,
          email: data.email || formData.email,
          phone: data.telefone || data.ddd_telefone_1 || formData.phone,
          
          // Mapeamento Dados PJ Estendidos
          openingDate: data.abertura,
          size: data.porte,
          legalNature: data.natureza_juridica,
          mainActivity: data.atividade_principal ? data.atividade_principal[0] : null,
          sideActivities: data.atividades_secundarias || [],
          shareCapital: data.capital_social,
          status: data.situacao,
          statusDate: data.data_situacao,
          specialStatus: data.situacao_especial,
          specialStatusDate: data.data_situacao_especial,
          pjQsa: data.qsa || []
        });
        
        // Auto-fill address if available and form is empty or user confirms
        if (data.logradouro) {
             setAddressForm({
                 street: data.logradouro,
                 number: data.numero || '',
                 city: data.municipio,
                 state: data.uf,
                 zipCode: data.cep ? data.cep.replace(/\D/g, '') : ''
             });
             // We can suggest the user to add this address
             toast.success('Dados e Endereço carregados! Clique em "Salvar Endereço" se desejar adicionar.');
             setShowAddressForm(true); // Open address details
        } else {
             toast.success('Dados do CNPJ carregados com sucesso!');
        }
>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69
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

<<<<<<< HEAD
            {activeTab === 'pf_create' && (
                <div className="space-y-6 max-w-4xl">
                     <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-800">
                         <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                             <Users size={20} className="text-indigo-400" /> Dados Pessoais (PF)
                         </h3>
                         
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                     
                     <div className="flex justify-end">
                        <button onClick={handleSubmit} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium">
                            Salvar Alterações
                        </button>
                     </div>
                </div>
            )}
            
            {activeTab === 'pj_create' && (
                <div className="space-y-6 max-w-4xl">
                     <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-800">
                         <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                             <Briefcase size={20} className="text-indigo-400" /> Dados Empresariais (PJ)
                         </h3>
                         
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                 />
                             </div>
                         </div>
                     </div>

                     <div className="flex justify-end">
                        <button onClick={handleSubmit} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium">
                            Salvar Alterações
                        </button>
                     </div>
                </div>
            )}

            {activeTab === 'contact' && (
=======
        {/* Tab Content */}
        <div className="p-8">
            {activeTab === 'contact' ? (
>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69
                <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
                     {/* Tipo de Pessoa */}
                     <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-800">
                         <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
<<<<<<< HEAD
                             <Users size={20} className="text-indigo-400" /> Dados Principais
                         </h3>
                         
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="col-span-2">
                                <label className="text-sm font-medium text-slate-400 block mb-2">Tipo de Pessoa</label>
                                <div className="flex gap-4">
                                     <label className="flex items-center gap-2 cursor-pointer bg-slate-950 px-4 py-2 rounded border border-slate-700 hover:border-indigo-500 transition">
                                         <input
                                             type="radio"
                                             name="personType"
                                             value="PF"
                                             checked={formData.personType === 'PF'}
                                             onChange={e => setFormData({...formData, personType: e.target.value})}
                                             className="w-4 h-4 text-indigo-600"
                                         />
                                         <span className="text-white">Pessoa Física</span>
                                     </label>
                                     <label className="flex items-center gap-2 cursor-pointer bg-slate-950 px-4 py-2 rounded border border-slate-700 hover:border-indigo-500 transition">
                                         <input
                                             type="radio"
                                             name="personType"
                                             value="PJ"
                                             checked={formData.personType === 'PJ'}
                                             onChange={e => setFormData({...formData, personType: e.target.value})}
                                             className="w-4 h-4 text-indigo-600"
                                         />
                                         <span className="text-white">Pessoa Jurídica</span>
                                     </label>
                                </div>
                            </div>

                             <div className="space-y-2 md:col-span-2">
                                 <label className="text-sm font-medium text-slate-400">Nome de Exibição / Fantasia *</label>
                                 <input 
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                    placeholder="Nome principal do contato"
                                 />
                             </div>

                             <div className="space-y-2">
                                 <label className="text-sm font-medium text-slate-400">Email</label>
                                 <input 
                                    type="email"
                                    value={formData.email || ''}
                                    onChange={e => setFormData({...formData, email: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                    placeholder="contato@exemplo.com"
                                 />
                             </div>

                             <div className="space-y-2">
                                 <label className="text-sm font-medium text-slate-400">Telefone Principal</label>
                                 <input 
                                    value={formData.phone || ''}
                                    onChange={e => setFormData({...formData, phone: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                    placeholder="(00) 00000-0000"
=======
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

                     {/* Nova Aba de Dados Corporativos (Só aparece para PJ) */}
                     {formData.personType === 'PJ' && (
                        <PJTab formData={formData} />
                     )}

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
                                        onChange={e => setFormData({...formData, cpf: masks.cpf(e.target.value)})}
                                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                        placeholder="000.000.000-00"
                                        maxLength={14}
                                     />
                                 </div>

                                 <div className="space-y-2">
                                     <label className="text-sm font-medium text-slate-400">RG</label>
                                     <input 
                                        value={formData.rg || ''}
                                        onChange={e => setFormData({...formData, rg: e.target.value})} // RG doesn't have a standard mask often
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
                                            onChange={e => setFormData({...formData, cnpj: masks.cnpj(e.target.value)})}
                                            className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                            placeholder="00.000.000/0000-00"
                                            maxLength={18}
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
                                    onChange={e => setFormData({...formData, phone: masks.phone(e.target.value)})}
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                    placeholder="(00) 00000-0000"
                                    maxLength={15}
>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69
                                 />
                             </div>

                             <div className="space-y-2">
                                 <label className="text-sm font-medium text-slate-400">WhatsApp</label>
                                 <input 
                                    value={formData.whatsapp || ''}
<<<<<<< HEAD
                                    onChange={e => setFormData({...formData, whatsapp: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                    placeholder="(00) 00000-0000"
                                 />
                             </div>
                             
                             <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-medium text-slate-400">Categoria</label>
                                <select 
                                    value={formData.category || ''}
                                    onChange={e => setFormData({...formData, category: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="">Selecione...</option>
                                    {CATEGORIES.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
=======
                                    onChange={e => setFormData({...formData, whatsapp: masks.phone(e.target.value)})}
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                    placeholder="(00) 00000-0000"
                                    maxLength={15}
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
>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69
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
<<<<<<< HEAD
                          <button 
                             disabled={loading}
                             type="submit"
                             className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium transition disabled:opacity-50"
                          >
                             {loading ? 'Salvando...' : 'Salvar Contato (Ctrl+S)'}
                          </button>
                     </div>
                </form>
            )}

            {activeTab === 'addresses' && (
=======
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
>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69
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
<<<<<<< HEAD
                                                    onChange={e => setAddressForm({...addressForm, zipCode: e.target.value})}
                                                    className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                                    placeholder="00000-000"
=======
                                                    onChange={e => setAddressForm({...addressForm, zipCode: masks.cep(e.target.value)})}
                                                    className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                                    placeholder="00000-000"
                                                    maxLength={9}
>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69
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
<<<<<<< HEAD
            )}

            {activeTab === 'relations' && (
=======
            ) : activeTab === 'relations' ? (
>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69
                <div className="space-y-6 max-w-4xl">
                     <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Lock size={20} className="text-indigo-400" /> Vínculos e Relacionamentos
                        </h3>
                        <button
                            onClick={() => setShowRelationForm(true)}
                            disabled={!id || id === 'new'}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus size={16} /> Adicionar Vínculo
                        </button>
                    </div>

                    {!id || id === 'new' ? (
                        <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-8 text-center">
                            <p className="text-slate-400">Salve o contato antes de adicionar vínculos</p>
                        </div>
                    ) : (
                        <>
                            {showRelationForm && (
                                <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-800 animate-fadeIn">
                                    <h4 className="text-md font-semibold text-white mb-4">Novo Vínculo</h4>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2 md:col-span-2">
                                            <label className="text-sm font-medium text-slate-400">Vincular com quem?</label>
                                            <select
                                                value={relationForm.toContactId}
                                                onChange={e => setRelationForm({...relationForm, toContactId: e.target.value})}
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                            >
                                                <option value="">Selecione um contato...</option>
                                                {availableContacts.map(c => (
                                                    <option key={c.id} value={c.id || ''}>{c.name} ({c.document || 'Sem doc'})</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-400">Tipo de Vínculo</label>
                                            <div className="flex gap-2">
                                                {!creatingType ? (
                                                    <select
                                                        value={relationForm.relationTypeId}
                                                        onChange={e => {
                                                            if (e.target.value === 'NEW') setCreatingType(true);
                                                            else setRelationForm({...relationForm, relationTypeId: e.target.value});
                                                        }}
                                                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                                    >
                                                        <option value="">Selecione...</option>
                                                        {relationTypes.map(t => (
                                                            <option key={t.id} value={t.id}>{t.name}</option>
                                                        ))}
                                                        <option value="NEW">+ Novo Tipo Simplificado</option>
                                                    </select>
                                                ) : (
                                                    <div className="flex-1 flex gap-2">
                                                        <input 
                                                            autoFocus
                                                            placeholder="Nome do novo vínculo"
                                                            value={relationForm.newTypeName}
                                                            onChange={e => setRelationForm({...relationForm, newTypeName: e.target.value})}
                                                            className="flex-1 bg-slate-950 border border-indigo-500 rounded px-3 py-2 text-white focus:outline-none"
                                                        />
                                                        <button 
                                                            onClick={() => setCreatingType(false)}
                                                            className="px-2 text-slate-400 hover:text-white"
                                                            title="Cancelar novo tipo"
                                                        >
                                                            X
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {creatingType && (
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-slate-400">Opções do Tipo</label>
                                                <div className="flex items-center gap-2 h-10">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input 
                                                            type="checkbox"
                                                            checked={relationForm.isBilateral}
                                                            onChange={e => setRelationForm({...relationForm, isBilateral: e.target.checked})}
                                                            className="w-4 h-4 text-indigo-600 rounded"
                                                        />
                                                        <span className="text-white text-sm">É Bilateral? (Recíproco)</span>
                                                    </label>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-2 mt-6">
                                        <button
                                            onClick={handleCreateRelation}
                                            disabled={loading}
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium transition disabled:opacity-50"
                                        >
                                            {loading ? 'Salvando...' : 'Criar Vínculo'}
                                        </button>
                                        <button
                                            onClick={() => { setShowRelationForm(false); setCreatingType(false); }}
                                            disabled={loading}
                                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium transition disabled:opacity-50"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                {relations.map(rel => (
                                    <div key={rel.id} className="bg-slate-800/30 border border-slate-700 rounded-lg p-4 flex items-center justify-between hover:bg-slate-800/50 transition">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-indigo-500/10 p-2 rounded-full">
                                                <Users size={20} className="text-indigo-400" />
                                            </div>
                                            <div>
                                                <span className="text-slate-400 text-sm block">
                                                    {rel.isInverse ? 'É vinculado como:' : 'Tem como vínculo:'}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-white text-lg">
                                                        {rel.relatedContact.name}
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded-full bg-slate-700 text-xs text-slate-300 border border-slate-600">
                                                        {rel.type}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-slate-500">
                                                    {rel.relatedContact.personType}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <button 
                                            onClick={() => handleDeleteRelation(rel.id)}
                                            className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-700/50 rounded transition"
                                            title="Remover vínculo"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))}

                                {relations.length === 0 && !showRelationForm && (
                                    <div className="text-center py-12 text-slate-500">
                                        <Lock size={48} className="mx-auto mb-4 opacity-20" />
                                        <p>Nenhum vínculo cadastrado para este contato.</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
<<<<<<< HEAD
            )}

            {activeTab === 'contacts' && (
=======
            ) : activeTab === 'contacts' ? (
>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69
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
<<<<<<< HEAD
            )}

            {activeTab === 'assets' && (
=======
            ) : activeTab === 'assets' ? (
>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69
                <div className="space-y-6 max-w-5xl">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Briefcase size={20} className="text-indigo-400" /> Gestão de Patrimônio
                        </h3>
                        <button
                            onClick={() => setShowAssetForm(true)}
                            disabled={!id || id === 'new'}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus size={16} /> Adicionar Patrimônio
                        </button>
                    </div>

                    {!id || id === 'new' ? (
                        <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-8 text-center">
                            <p className="text-slate-400">Salve o contato antes de adicionar patrimônios</p>
                        </div>
                    ) : (
                        <>
                             {showAssetForm && (
                                <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-800 animate-fadeIn mb-6">
                                    <h4 className="text-md font-semibold text-white mb-4">
                                        {editingAsset ? 'Editar Patrimônio' : 'Novo Item de Patrimônio'}
                                    </h4>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-400">Tipo de Patrimônio</label>
                                            <div className="flex gap-2">
                                                {!creatingAssetType ? (
                                                    <select
                                                        value={assetForm.assetTypeId}
                                                        onChange={e => {
                                                            if (e.target.value === 'NEW') setCreatingAssetType(true);
                                                            else setAssetForm({...assetForm, assetTypeId: e.target.value});
                                                        }}
                                                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                                    >
                                                        <option value="">Selecione...</option>
                                                        {assetTypes.map(t => (
                                                            <option key={t.id} value={t.id}>{t.name}</option>
                                                        ))}
                                                        <option value="NEW">+ Novo Tipo Simplificado</option>
                                                    </select>
                                                ) : (
                                                    <div className="flex-1 flex gap-2">
                                                        <input 
                                                            autoFocus
                                                            placeholder="Nome do novo tipo"
                                                            value={assetForm.newTypeName}
                                                            onChange={e => setAssetForm({...assetForm, newTypeName: e.target.value})}
                                                            className="flex-1 bg-slate-950 border border-indigo-500 rounded px-3 py-2 text-white focus:outline-none"
                                                        />
                                                        <button 
                                                            onClick={() => setCreatingAssetType(false)}
                                                            className="px-2 text-slate-400 hover:text-white"
                                                            title="Cancelar"
                                                        >
                                                            X
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-2 md:col-span-2">
                                            <label className="text-sm font-medium text-slate-400">Descrição</label>
                                            <input 
                                                value={assetForm.description}
                                                onChange={e => setAssetForm({...assetForm, description: e.target.value})}
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                                placeholder="Ex: Apartamento Centro, Carro Honda Civic..."
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-400">Valor Estimado (R$)</label>
                                            <input 
                                                type="number"
                                                value={assetForm.value}
                                                onChange={e => setAssetForm({...assetForm, value: e.target.value})}
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                                placeholder="0.00"
                                                step="0.01"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-400">Data de Aquisição</label>
                                            <input 
                                                type="date"
                                                value={assetForm.acquisitionDate}
                                                onChange={e => setAssetForm({...assetForm, acquisitionDate: e.target.value})}
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-400">Data de Baixa (Venda/Perda)</label>
                                            <input 
                                                type="date"
                                                value={assetForm.writeOffDate}
                                                onChange={e => setAssetForm({...assetForm, writeOffDate: e.target.value})}
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                            />
                                        </div>

                                        <div className="space-y-2 md:col-span-3">
                                            <label className="text-sm font-medium text-slate-400">Observações</label>
                                            <textarea 
                                                rows={3}
                                                value={assetForm.notes}
                                                onChange={e => setAssetForm({...assetForm, notes: e.target.value})}
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                                placeholder="Detalhes adicionais..."
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-2 mt-6">
                                        <button
                                            onClick={handleCreateAsset}
                                            disabled={loading}
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium transition disabled:opacity-50"
                                        >
                                            {loading ? 'Salvando...' : editingAsset ? 'Atualizar Patrimônio' : 'Salvar Patrimônio'}
                                        </button>
                                        <button
                                            onClick={cancelAssetForm}
                                            disabled={loading}
                                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium transition disabled:opacity-50"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            )}

                             {/* Assets List Table */}
                             <div className="bg-slate-800/30 border border-slate-700 rounded-lg overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-800/50 border-b border-slate-700 text-slate-400 text-sm">
                                            <th className="p-4 font-medium">Tipo</th>
                                            <th className="p-4 font-medium">Descrição</th>
                                            <th className="p-4 font-medium">Data Aquisição</th>
                                            <th className="p-4 font-medium">Valor</th>
                                            <th className="p-4 font-medium">Status</th>
                                            <th className="p-4 font-medium text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {assets.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-slate-500">
                                                    Nenhum patrimônio cadastrado.
                                                </td>
                                            </tr>
                                        ) : (
                                            assets.map(asset => (
                                                <tr key={asset.id} className="hover:bg-slate-800/50 transition">
                                                    <td className="p-4 text-white font-medium">{asset.assetType.name}</td>
                                                    <td className="p-4 text-slate-300">{asset.description}</td>
                                                    <td className="p-4 text-slate-400">
                                                        {asset.acquisitionDate ? new Date(asset.acquisitionDate).toLocaleDateString('pt-BR') : '-'}
                                                    </td>
                                                    <td className="p-4 text-emerald-400 font-medium">
                                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(asset.value))}
                                                    </td>
                                                    <td className="p-4">
                                                        {asset.writeOffDate ? (
                                                            <span className="px-2 py-1 rounded-full bg-red-500/10 text-red-400 text-xs border border-red-500/20">Baixado</span>
                                                        ) : (
                                                            <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs border border-emerald-500/20">Ativo</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button 
                                                                onClick={() => startEditAsset(asset)}
                                                                className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-700 rounded transition"
                                                            >
                                                                <Edit size={16} />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDeleteAsset(asset.id)}
                                                                className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                             </div>
                        </>
                    )}
                </div>
<<<<<<< HEAD
            )}

            {['attachments', 'contracts', 'whatsapp', 'financial', 'processes', 'agenda'].includes(activeTab) && (
=======
            ) : (
>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69
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
