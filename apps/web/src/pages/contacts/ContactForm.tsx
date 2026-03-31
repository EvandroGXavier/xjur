import { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, Phone, Calendar, MessageSquare, Briefcase, FileText, Settings, Users, DollarSign, Paperclip, Home, Lock, Plus, Edit, Trash2, MapPin, Search, HelpCircle, Download, Upload, ExternalLink, Printer, CheckCircle2 } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { api, getApiUrl } from '../../services/api';
import { openProtectedMedia } from '../../services/protectedMedia';
import { isValidCnpj, isValidCpf, masks } from '../../utils/masks';
import { HelpModal, useHelpModal } from '../../components/HelpModal';
import { helpContacts } from '../../data/helpManuals';
import { useHotkeys } from '../../hooks/useHotkeys';
import { AttachmentPreview } from '../../components/ui/AttachmentPreview';

import { PJTab } from './PJTab';

// Interface matching Backend DTO
interface ContactData {
  id?: string;
  name: string;
  personType: string; // 'LEAD' | 'PF' | 'PJ'
  
  // Pessoa Física
  cpf?: string;
  rg?: string;
  rgIssuer?: string;
  rgIssueDate?: string;
  birthDate?: string; // Data Nascimento
  
  nis?: string; // Nº NIS
  pis?: string; // Nº PIS
  ctps?: string; // Nº CTPS
  motherName?: string; // Nome da Mãe
  fatherName?: string; // Nome do Pai
  profession?: string; // Profissão
  nationality?: string; // Nacionalidade
  naturality?: string; // Naturalidade
  gender?: string; // Gênero
  civilStatus?: string; // Estado Civil
  
  // CNH
  fullName?: string; // Nome Completo Legal
  cnh?: string; // CNH Nº
  cnhIssuer?: string; // Órgão Emissor
  cnhIssueDate?: string; // Data Emissão
  cnhExpirationDate?: string; // Validade
  cnhCategory?: string; // Categoria (A, B, AB, etc)
  
  // Pessoa Jurídica
  cnpj?: string;
  companyName?: string;
  stateRegistration?: string;
  
  // Dados Expandidos PJ
  openingDate?: string;
  size?: string;
  legalNature?: string;
  mainActivity?: { code: string; text: string };
  sideActivities?: { code: string; text: string }[];
  shareCapital?: string; // or number, keeping basic for form
  status?: string;
  statusDate?: string;
  statusReason?: string; // Motivo da Situação
  specialStatus?: string;
  specialStatusDate?: string;
  pjQsa?: any[];
  // Campos Gerais
  document?: string;
  email?: string;
  phone: string; // Telefone
  whatsappE164?: string;
  whatsappFullId?: string; // ID do WhatsApp
  notes?: string;
  category?: string;
  addresses?: Address[];
  additionalContacts?: AdditionalContact[];
  metadata?: {
    attachments?: ContactAttachment[];
    [key: string]: any;
  };
  active?: boolean;
}

// ... (Address, AdditionalContact, RelationType interfaces remain same)

// ...
interface Address {
  id?: string;
  type: string;
  street: string;
  number: string;
  complement?: string;
  district?: string;
  city: string;
  state: string;
  zipCode: string;
}

interface AdditionalContact {
  id?: string;
  type: string;
  value: string;
  nomeContatoAdicional?: string;
}

interface ContactAttachment {
  originalName: string;
  fileName: string;
  path?: string;
  mimeType?: string;
  size?: number;
  uploadedAt?: string;
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

interface ContactContract {
  id: string;
  type: string;
  description: string;
  dueDay: number;
  firstDueDate: string;
  billingFrequency: 'MONTHLY' | 'ANNUAL';
  transactionKind: 'INCOME' | 'EXPENSE';
  counterpartyRole: 'CONTRACTOR' | 'CONTRACTED';
  counterpartyName: string;
  status: 'ACTIVE' | 'PAUSED' | 'ENDED';
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ContactFinancialRecord {
  id: string;
  description: string;
  amount: number;
  amountFinal?: number | null;
  amountPaid?: number | null;
  dueDate: string;
  paymentDate?: string | null;
  status: string;
  effectiveStatus?: string;
  type: 'INCOME' | 'EXPENSE';
  category?: string | null;
  paymentMethod?: string | null;
  origin?: string | null;
  bankAccount?: {
    id: string;
    title: string;
    bankName?: string | null;
  } | null;
  financialCategory?: {
    id: string;
    name: string;
  } | null;
  contactRole?: string;
  parties?: Array<{
    id: string;
    role: string;
    amount?: number | null;
    contact: {
      id: string;
      name: string;
    };
  }>;
}

interface ContactInsightProcess {
  id: string;
  code?: string | null;
  title?: string | null;
  cnj?: string | null;
  status: string;
  area?: string | null;
  class?: string | null;
  court?: string | null;
  district?: string | null;
  updatedAt: string;
  relation: {
    type: 'owner' | 'party';
    label: string;
    roleCategory?: string | null;
    isClient: boolean;
    isOpposing: boolean;
  };
}

interface ContactInsightAppointment {
  id: string;
  title: string;
  type: string;
  status: string;
  startAt: string;
  endAt: string;
  location?: string | null;
  participantRole?: string | null;
  confirmed: boolean;
  process?: {
    id: string;
    title?: string | null;
    code?: string | null;
  } | null;
}

interface ContactInsightMessage {
  id: string;
  direction: string;
  role: string;
  content: string;
  contentType: string;
  status: string;
  senderName?: string | null;
  createdAt: string;
}

interface ContactInsightConversation {
  id: string;
  title?: string | null;
  status: string;
  priority: string;
  queue?: string | null;
  waitingReply: boolean;
  unreadCount: number;
  lastMessagePreview?: string | null;
  lastMessageAt?: string | null;
  connection?: {
    id: string;
    name: string;
    channel: string;
    status: string;
  } | null;
  ticket?: {
    id: string;
    code: number;
    status: string;
    priority: string;
    queue?: string | null;
  } | null;
  messages: ContactInsightMessage[];
}

interface ContactInsightTicket {
  id: string;
  code: number;
  title: string;
  status: string;
  priority: string;
  queue?: string | null;
  waitingReply: boolean;
  lastMessageAt?: string | null;
  updatedAt: string;
}

interface ContactInsights {
  processes: ContactInsightProcess[];
  appointments: ContactInsightAppointment[];
  whatsapp: {
    conversations: ContactInsightConversation[];
    tickets: ContactInsightTicket[];
  };
}

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

const CONTRACT_BILLING_LABELS = {
  MONTHLY: 'Mensal',
  ANNUAL: 'Anual',
} as const;

const CONTRACT_ROLE_LABELS = {
  CONTRACTOR: 'Contratante',
  CONTRACTED: 'Contratado',
} as const;

const CONTRACT_STATUS_LABELS = {
  ACTIVE: 'Ativo',
  PAUSED: 'Pausado',
  ENDED: 'Encerrado',
} as const;

const FINANCIAL_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  PAID: 'Pago',
  CANCELLED: 'Cancelado',
  OVERDUE: 'Vencido',
  PARTIAL: 'Parcial',
};

const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Agendado',
  CONFIRMED: 'Confirmado',
  IN_PROGRESS: 'Em andamento',
  DONE: 'Concluido',
  CANCELED: 'Cancelado',
  RESCHEDULED: 'Reagendado',
};

export function ContactForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'contact');
  const [formData, setFormData] = useState<ContactData>({
    name: '',
    personType: 'LEAD',
    phone: '',
    whatsapp: '',
    whatsappFullId: '',
    document: '',
    addresses: [],
    additionalContacts: [],
    metadata: { attachments: [] },
    sideActivities: [],
    pjQsa: [],
    active: true
  });

  const TABS = useMemo(() => {
    const baseTabs = [
      { id: 'contact', label: 'Contato', icon: Users },
    ];

    if (formData.personType === 'PF') {
      baseTabs.push({ id: 'pf_details', label: 'PF', icon: Users });
    }

    if (formData.personType === 'PJ') {
      baseTabs.push({ id: 'pj_details', label: 'PJ', icon: Briefcase });
    }

    // Abas comuns a todos (exceto Lead que pode ter restrições, mas o user disse "Lead... aba PF e PJ ocultas", implying others are fine or default)
    // "Lead= Cadastro básico... para este a ABA PF e a aba PJ estarão ocultas." -> Implies others might be visible?
    // "PF... exibe todas as demais."
    // "PJ... exibe todas as demais."
    // Let's assume common tabs are visible for everyone including Lead, unless specified.
    // Spec says: "Lead... Normalmente este cadastro estará com nome, Whatsapp, preenchidos, já que são obrigatórios, para este a ABA PF e a aba PJ estarão ocultas."
    // It doesn't explicitly hide "Addresses", "Financial", etc. for Leads. I'll keep them visible or maybe hide complex ones?
    // Usually Leads might not have Financials yet. But strict reading: "PF... exibe todas as demais" -> implies Lead might NOT show all?
    // Re-reading: "Lead... para este a ABA PF e a aba PJ estarão ocultas." -> That's the only exclusion mentioned.
    
    const commonTabs = [
        { id: 'relations', label: 'Vínculos', icon: Lock },
        { id: 'contacts', label: 'Contatos', icon: Users },
        { id: 'addresses', label: 'Endereços', icon: Home },
        { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
        { id: 'assets', label: 'Patrimônio', icon: Briefcase },
        { id: 'agenda', label: 'Agenda', icon: Calendar },
        { id: 'processes', label: 'Processos', icon: Settings },
        { id: 'attachments', label: 'Anexos', icon: Paperclip },
        { id: 'contracts', label: 'Contratos', icon: FileText },
        { id: 'financial', label: 'Financeiro', icon: DollarSign },
        { id: 'adm', label: 'ADM', icon: Settings }
    ];

    return [...baseTabs, ...commonTabs];
  }, [formData.personType]);

  useEffect(() => {
    if (!TABS.some(tab => tab.id === activeTab)) {
      setActiveTab('contact');
    }
  }, [TABS, activeTab]);

  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [requireOneInfo, setRequireOneInfo] = useState(true);
  const { isHelpOpen, setIsHelpOpen } = useHelpModal();
  
  // Address form states
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [addressForm, setAddressForm] = useState<Address>({
    type: 'Principal',
    street: '',
    number: '',
    complement: '',
    district: '',
    city: '',
    state: '',
    zipCode: ''
  });
  const [creatingAddressType, setCreatingAddressType] = useState(false);
  const [newAddressType, setNewAddressType] = useState('');
  const zipCodeRef = useRef<HTMLInputElement>(null);

  // Focus on zipCode when address form opens
  useEffect(() => {
    if (showAddressForm) {
      setTimeout(() => {
        zipCodeRef.current?.focus();
      }, 100);
    }
  }, [showAddressForm]);

  const handleAddressKeyDown = (e: React.KeyboardEvent, nextFieldId?: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextFieldId) {
        document.getElementById(nextFieldId)?.focus();
      }
    }
  };

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
  const [assetSearch, setAssetSearch] = useState('');
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
  const [contracts, setContracts] = useState<ContactContract[]>([]);
  const [showContractForm, setShowContractForm] = useState(false);
  const [editingContract, setEditingContract] = useState<ContactContract | null>(null);
  const [contractSearch, setContractSearch] = useState('');
  const [creatingContractType, setCreatingContractType] = useState(false);
  const [contractForm, setContractForm] = useState({
    type: '',
    newTypeName: '',
    description: '',
    dueDay: '5',
    firstDueDate: '',
    billingFrequency: 'MONTHLY' as 'MONTHLY' | 'ANNUAL',
    transactionKind: 'INCOME' as 'INCOME' | 'EXPENSE',
    counterpartyRole: 'CONTRACTOR' as 'CONTRACTOR' | 'CONTRACTED',
    counterpartyName: '',
    status: 'ACTIVE' as 'ACTIVE' | 'PAUSED' | 'ENDED',
    notes: '',
  });
  const [financialRecords, setFinancialRecords] = useState<ContactFinancialRecord[]>([]);
  const [financialSearch, setFinancialSearch] = useState('');
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [attachmentUploadProgress, setAttachmentUploadProgress] = useState(0);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [contactInsights, setContactInsights] = useState<ContactInsights>({
    processes: [],
    appointments: [],
    whatsapp: {
      conversations: [],
      tickets: [],
    },
  });

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

  const fetchContracts = async () => {
      try {
          const response = await api.get(`/contacts/${id}/contracts`);
          setContracts(response.data);
      } catch (err) {
          console.error("Failed to fetch contracts", err);
      }
  };

  const fetchFinancialRecords = async () => {
      try {
          const response = await api.get(`/contacts/${id}/financial-records`);
          setFinancialRecords(response.data);
      } catch (err) {
          console.error("Failed to fetch financial records", err);
      }
  };

  const fetchInsights = async () => {
      if (!id || id === 'new') {
        setContactInsights({
          processes: [],
          appointments: [],
          whatsapp: {
            conversations: [],
            tickets: [],
          },
        });
        return;
      }

      try {
          setInsightsLoading(true);
          const response = await api.get(`/contacts/${id}/insights`);
          setContactInsights({
            processes: Array.isArray(response.data?.processes) ? response.data.processes : [],
            appointments: Array.isArray(response.data?.appointments) ? response.data.appointments : [],
            whatsapp: {
              conversations: Array.isArray(response.data?.whatsapp?.conversations)
                ? response.data.whatsapp.conversations
                : [],
              tickets: Array.isArray(response.data?.whatsapp?.tickets) ? response.data.whatsapp.tickets : [],
            },
          });
      } catch (err) {
          console.error('Failed to fetch contact insights', err);
      } finally {
          setInsightsLoading(false);
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

  const resetContractForm = () => {
      setEditingContract(null);
      setCreatingContractType(false);
      setContractForm({
        type: '',
        newTypeName: '',
        description: '',
        dueDay: '5',
        firstDueDate: '',
        billingFrequency: 'MONTHLY',
        transactionKind: 'INCOME',
        counterpartyRole: 'CONTRACTOR',
        counterpartyName: '',
        status: 'ACTIVE',
        notes: '',
      });
  };

  const handleCreateContract = async () => {
      if (!id || id === 'new') {
          toast.warning('Salve o contato antes de adicionar contratos');
          return;
      }

      const resolvedType = creatingContractType ? contractForm.newTypeName.trim() : contractForm.type.trim();
      if (!resolvedType) {
          toast.warning('Informe o tipo do contrato');
          return;
      }
      if (!contractForm.description.trim()) {
          toast.warning('Informe a descrição do contrato');
          return;
      }
      if (!contractForm.firstDueDate) {
          toast.warning('Informe o primeiro vencimento');
          return;
      }
      if (!contractForm.counterpartyName.trim()) {
          toast.warning('Informe quem é a outra parte do contrato');
          return;
      }

      try {
          setLoading(true);
          const payload = {
              type: resolvedType,
              description: contractForm.description.trim(),
              dueDay: Number(contractForm.dueDay),
              firstDueDate: contractForm.firstDueDate,
              billingFrequency: contractForm.billingFrequency,
              transactionKind: contractForm.transactionKind,
              counterpartyRole: contractForm.counterpartyRole,
              counterpartyName: contractForm.counterpartyName.trim(),
              status: contractForm.status,
              notes: contractForm.notes.trim(),
          };

          const response = editingContract
            ? await api.patch(`/contacts/${id}/contracts/${editingContract.id}`, payload)
            : await api.post(`/contacts/${id}/contracts`, payload);

          setContracts(response.data);
          setFormData(prev => ({
              ...prev,
              metadata: {
                  ...(prev.metadata || {}),
                  contracts: response.data,
              },
          }));
          toast.success(editingContract ? 'Contrato atualizado!' : 'Contrato adicionado!');
          setShowContractForm(false);
          resetContractForm();
      } catch (err) {
          console.error(err);
          toast.error('Erro ao salvar contrato');
      } finally {
          setLoading(false);
      }
  };

  const startEditContract = (contract: ContactContract) => {
      setEditingContract(contract);
      setCreatingContractType(false);
      setContractForm({
          type: contract.type,
          newTypeName: '',
          description: contract.description,
          dueDay: String(contract.dueDay || 5),
          firstDueDate: contract.firstDueDate ? contract.firstDueDate.split('T')[0] : '',
          billingFrequency: contract.billingFrequency,
          transactionKind: contract.transactionKind,
          counterpartyRole: contract.counterpartyRole,
          counterpartyName: contract.counterpartyName,
          status: contract.status,
          notes: contract.notes || '',
      });
      setShowContractForm(true);
  };

  const handleDeleteContract = async (contractId: string) => {
      if (!id || id === 'new') return;
      if (!confirm('Deseja remover este contrato?')) return;

      try {
          setLoading(true);
          const response = await api.delete(`/contacts/${id}/contracts/${contractId}`);
          setContracts(response.data);
          setFormData(prev => ({
              ...prev,
              metadata: {
                  ...(prev.metadata || {}),
                  contracts: response.data,
              },
          }));
          toast.success('Contrato removido!');
      } catch (err) {
          console.error(err);
          toast.error('Erro ao remover contrato');
      } finally {
          setLoading(false);
      }
  };

  const fetchContact = async () => {
    try {
        setLoading(true);
        const response = await api.get(`/contacts/${id}`);
        // Helper to extract YYYY-MM-DD from ISO string
        const toDateInput = (isoDate: string | null | undefined) => {
            if (!isoDate) return '';
            return typeof isoDate === 'string' && isoDate.includes('T') 
                ? isoDate.split('T')[0] 
                : isoDate;
        };

        const data = response.data;
        // Format dates for inputs
        data.birthDate = toDateInput(data.birthDate);
        data.rgIssueDate = toDateInput(data.rgIssueDate);
        data.cnhIssueDate = toDateInput(data.cnhIssueDate);
        data.cnhExpirationDate = toDateInput(data.cnhExpirationDate);
        data.openingDate = toDateInput(data.openingDate);
        data.statusDate = toDateInput(data.statusDate);
        data.specialStatusDate = toDateInput(data.specialStatusDate);

        setFormData({
          ...data,
          addresses: data.addresses ?? [],
          additionalContacts: data.additionalContacts ?? [],
          metadata: data.metadata ?? { attachments: [] },
        });
        setContracts(Array.isArray(data.metadata?.contracts) ? data.metadata.contracts : []);
    } catch(err) {
        console.error("Failed to fetch contact", err);
    } finally {
        setLoading(false);
    }
  };

  useHotkeys({
      onNew: () => navigate('/contacts/new'),
      onCancel: () => {
          if (returnTo) {
             navigate(decodeURIComponent(returnTo));
          } else {
             navigate('/contacts');
          }
      }
  });

  useEffect(() => {
    if (id && id !== 'new') {
      fetchContact();
      fetchRelations();
      fetchAssets();
      fetchContracts();
      fetchFinancialRecords();
      fetchInsights();
    }
    fetchRelationTypes();
    fetchAssetTypes();
    fetchAvailableContacts();

    // Buscar configurações do Tenant
    api.get('/saas/my-tenant')
      .then(res => setRequireOneInfo(res.data.contactRequireOneInfo ?? true))
      .catch(err => console.error("Failed to fetch tenant settings", err));
  }, [id]);

  const hasFilledAddress = (address?: Partial<Address>) => {
    if (!address) return false;
    return Boolean(
      address.street?.trim() ||
      address.number?.trim() ||
      address.city?.trim() ||
      address.state?.trim() ||
      address.zipCode?.trim(),
    );
  };

  const buildDraftAddress = (): Address | null => {
    if (!hasFilledAddress(addressForm)) return null;

    const draftAddress = {
      type: addressForm.type?.trim() || 'Principal',
      street: addressForm.street?.trim() || '',
      number: addressForm.number?.trim() || 'S/N',
      complement: addressForm.complement?.trim() || '',
      district: addressForm.district?.trim() || '',
      city: addressForm.city?.trim() || '',
      state: addressForm.state?.trim() || '',
      zipCode: addressForm.zipCode?.trim() || '',
    };

    if (!draftAddress.street || !draftAddress.city || !draftAddress.state || !draftAddress.zipCode) {
      return null;
    }

    return draftAddress;
  };

  const collectCreateAddresses = (): Address[] => {
    const savedAddresses = Array.isArray(formData.addresses) ? [...formData.addresses] : [];
    const draftAddress = buildDraftAddress();
    if (!draftAddress) return savedAddresses;

    const alreadyIncluded = savedAddresses.some(address =>
      (address.zipCode || '') === draftAddress.zipCode &&
      (address.street || '').trim().toLowerCase() === draftAddress.street.trim().toLowerCase() &&
      (address.number || '').trim().toLowerCase() === draftAddress.number.trim().toLowerCase(),
    );

    return alreadyIncluded ? savedAddresses : [...savedAddresses, draftAddress];
  };

  const getAttachmentUrl = (attachment: ContactAttachment) => {
    const safeFileName = encodeURIComponent(attachment.fileName);
    return getApiUrl(`/contacts/${id}/attachments/${safeFileName}`);
  };

  const formatFileSize = (size?: number) => {
    if (!size) return 'Arquivo';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatCurrency = (value?: number | null) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Number(value || 0));

  const formatDateTime = (value?: string | null) => {
    if (!value) return '-';
    return new Date(value).toLocaleString('pt-BR');
  };

  const handleOpenPhone = () => {
    const destination = (formData.phone || formData.whatsapp || '').replace(/\D/g, '');
    if (!destination) {
      toast.warning('Este contato ainda nao possui telefone cadastrado.');
      return;
    }

    window.open(`tel:${destination}`, '_self');
  };

  const handleOpenWhatsapp = () => {
    const rawDestination = (formData.whatsapp || formData.phone || '').replace(/\D/g, '');
    if (!rawDestination) {
      toast.warning('Este contato ainda nao possui WhatsApp cadastrado.');
      return;
    }

    const destination =
      rawDestination.length > 11 || rawDestination.startsWith('55')
        ? rawDestination
        : `55${rawDestination}`;

    window.open(`https://wa.me/${destination}`, '_blank', 'noopener,noreferrer');
  };

  const getEffectiveFinancialStatus = (record: ContactFinancialRecord) =>
    record.effectiveStatus || record.status;

  const handleAttachmentSelection = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const filesArray: File[] = [];
    for (let i = 0; i < files.length; i++) {
        const f = files.item(i);
        if (f) filesArray.push(f);
    }
    
    if (filesArray.length > 0) {
        // Atualiza a fila e inicia o upload automático
        setPendingAttachments(filesArray); 
        // Pequeno delay para garantir que o state foi atualizado antes de ler a fila no upload
        setTimeout(() => {
            handleUploadAttachments(filesArray);
        }, 100);
    }
  };

  const handleUploadAttachments = async (filesOverride?: File[]) => {
    if (!id || id === 'new') {
      toast.warning('Salve o contato antes de anexar arquivos');
      return;
    }

    const filesToUpload = filesOverride || pendingAttachments;

    if (filesToUpload.length === 0) {
      toast.warning('Selecione pelo menos um arquivo');
      return;
    }

    try {
      setUploadingAttachments(true);
      setAttachmentUploadProgress(0);
      const data = new FormData();
      filesToUpload.forEach(file => data.append('attachments', file));
      
      const response = await api.post(`/contacts/${id}/attachments`, data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: progressEvent => {
          if (!progressEvent.total) return;
          setAttachmentUploadProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100));
        },
      });
      setFormData(response.data);
      setPendingAttachments([]);
      setAttachmentUploadProgress(100);
      toast.success(`${filesToUpload.length} anexo(s) enviado(s) com sucesso!`);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao enviar anexos do contato');
    } finally {
      setUploadingAttachments(false);
      setTimeout(() => setAttachmentUploadProgress(0), 1200);
    }
  };

  const handlePrintAttachment = async (attachment: ContactAttachment) => {
    const safeFileName = encodeURIComponent(attachment.fileName);
    const mediaUrl = `/contacts/${id}/attachments/${safeFileName}`;
    
    try {
        const { fetchProtectedMediaBlob } = await import('../../services/protectedMedia');
        const blob = await fetchProtectedMediaBlob(mediaUrl);
        const objectUrl = URL.createObjectURL(blob);
        const printWindow = window.open(objectUrl, '_blank', 'noopener,noreferrer');
        
        if (!printWindow) {
          toast.error('Nao foi possivel abrir o anexo para impressao');
          return;
        }

        setTimeout(() => {
          try {
            printWindow.print();
            window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
          } catch (error) {
            console.error(error);
          }
        }, 800);
    } catch (err) {
        console.error(err);
        toast.error('Falha ao autenticar para abrir o documento.');
    }
  };

  const handleRemovePendingAttachment = (index: number) => {
    setPendingAttachments(prev => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleDeleteAttachment = async (fileName: string) => {
    if (!id || id === 'new') return;
    if (!window.confirm('Deseja realmente excluir este anexo?')) return;

    try {
      setLoading(true);
      const response = await api.delete(`/contacts/${id}/attachments/${encodeURIComponent(fileName)}`);
      setFormData(response.data);
      toast.success('Anexo removido com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao remover anexo');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent, shouldClose: boolean = false) => {
    if (e) e.preventDefault();

    // Validação
    if (requireOneInfo) {
      const hasPhone = !!formData.phone?.trim();
      const hasWhatsapp = !!formData.whatsapp?.trim();
      const hasEmail = !!formData.email?.trim();
      
      if (!hasPhone && !hasWhatsapp && !hasEmail) {
        toast.warning('Você deve preencher pelo menos um meio de contato: Celular, Telefone ou E-mail.');
        return;
      }
    }

    // CPF/CNPJ Validation (Allow blank, but if filled must be valid)
    if (formData.cpf && formData.cpf.trim() !== '' && !isValidCpf(formData.cpf)) {
        toast.error('O CPF informado é inválido.');
        return;
    }

    if (formData.cnpj && formData.cnpj.trim() !== '' && !isValidCnpj(formData.cnpj)) {
        toast.error('O CNPJ informado é inválido.');
        return;
    }

    // If document is generic field, we could also validate it based on length
    if (formData.document && formData.document.trim() !== '') {
        const cleanDoc = formData.document.replace(/\D/g, '');
        if (cleanDoc.length === 11 && !isValidCpf(cleanDoc)) {
            toast.error('O CPF informado no campo documento é inválido.');
            return;
        } else if (cleanDoc.length === 14 && !isValidCnpj(cleanDoc)) {
            toast.error('O CNPJ informado no campo documento é inválido.');
            return;
        } else if (cleanDoc.length !== 11 && cleanDoc.length !== 14) {
             toast.error('O documento informado deve ser um CPF (11 dígitos) ou CNPJ (14 dígitos).');
             return;
        }
    }

    setLoading(true);
    try {
        const toISO = (dateStr: any) => {
            if (!dateStr || typeof dateStr !== 'string' || dateStr.trim() === '') return null;
            const trimmed = dateStr.trim();
            // Check if dd/mm/yyyy
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
                const [d, m, y] = trimmed.split('/');
                return `${y}-${m}-${d}T00:00:00.000Z`;
            }
            // Check if yyyy-mm-dd (Input date format)
            if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                return `${trimmed}T00:00:00.000Z`;
            }
            return trimmed;
        };

        const rawPayload = { ...formData };
        const normalizedName =
          String(rawPayload.name || '').trim() ||
          (rawPayload.personType === 'PJ'
            ? String(rawPayload.companyName || '').trim()
            : '');

        if (normalizedName.length < 3) {
            toast.warning(
              rawPayload.personType === 'PJ'
                ? 'Preencha o Nome Fantasia ou consulte um CNPJ valido antes de salvar.'
                : 'Preencha o nome do contato antes de salvar.',
            );
            return;
        }

        rawPayload.name = normalizedName;
        
        // Convert specific date fields if they are in BR format or YYYY-MM-DD
        if (rawPayload.openingDate) rawPayload.openingDate = toISO(rawPayload.openingDate);
        if (rawPayload.statusDate) rawPayload.statusDate = toISO(rawPayload.statusDate);
        if (rawPayload.specialStatusDate) rawPayload.specialStatusDate = toISO(rawPayload.specialStatusDate);
        
        // PF dates
        if (rawPayload.birthDate) rawPayload.birthDate = toISO(rawPayload.birthDate);
        if (rawPayload.rgIssueDate) rawPayload.rgIssueDate = toISO(rawPayload.rgIssueDate);
        if (rawPayload.cnhIssueDate) rawPayload.cnhIssueDate = toISO(rawPayload.cnhIssueDate);
        if (rawPayload.cnhExpirationDate) rawPayload.cnhExpirationDate = toISO(rawPayload.cnhExpirationDate);

        // Ensure shareCapital is number or compatible string
        if (rawPayload.shareCapital && typeof rawPayload.shareCapital === 'string') {
             // Removing currency formatting if present (e.g. "R$ 1.000,00" -> 1000.00)
             // But usually it comes as number or simple string from enrichment
        }

        const payload = Object.fromEntries(
          Object.entries(rawPayload).map(([key, value]) => [
            key,
            (typeof value === 'string' && value.trim() === '') ? null : value
          ])
        ) as ContactData;

        if (!id || id === 'new') {
            const addressesToCreate = collectCreateAddresses();
            if (addressesToCreate.length > 0) {
                payload.addresses = addressesToCreate;
            }
        }

        if (id && id !== 'new') {
            const response = await api.patch(`/contacts/${id}`, payload);
            setFormData(response.data);
            toast.success('Contato atualizado com sucesso!');
        } else {
            const response = await api.post('/contacts', payload);
            toast.success('Contato criado com sucesso!');

            if (shouldClose) {
                setTimeout(() => {
                    if (returnTo) {
                        navigate(decodeURIComponent(returnTo));
                    } else {
                        navigate('/contacts');
                    }
                }, 500);
            } else if (response.data?.id) {
                navigate(`/contacts/${response.data.id}?tab=${activeTab}`, { replace: true });
            } else {
                navigate('/contacts');
            }
            return;
        }

        if (shouldClose) {
            setTimeout(() => {
                if (returnTo) {
                    navigate(decodeURIComponent(returnTo));
                } else {
                    navigate('/contacts');
                }
            }, 500);
        }

    } catch (err: any) {
        console.error(err);
        const message = err.response?.data?.message || err.message || 'Erro ao conectar com servidor';
        
        const errorDetail = err.response?.data || err;
        const errorString = typeof errorDetail === 'object' ? JSON.stringify(errorDetail, null, 2) : String(errorDetail);

        toast.error(`Erro ao salvar contato`, {
            description: message,
            action: {
                label: 'Copiar Erro',
                onClick: () => {
                    navigator.clipboard.writeText(errorString);
                    toast.success('Erro copiado!');
                }
            },
            duration: 10000,
        });
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

    if (!isValidCnpj(formData.cnpj)) {
      toast.warning('Digite um CNPJ valido antes de consultar');
      return;
    }

    setEnriching(true);
    try {
      const response = await api.get(`/contacts/enrich/cnpj?cnpj=${formData.cnpj}`);
      const data = response.data;
      
      // ReceitaWS returns 'nome' (Razão Social) and 'fantasia' (Nome Fantasia)
      const companyName = data.nome || data.razao_social || formData.companyName;
      const tradeName = data.fantasia || data.nome_fantasia || companyName || formData.name;

        // Helper to normalize dates to yyyy-mm-dd for inputs
        const normalizeDate = (dateStr: string) => {
             if (!dateStr) return null;
             // Check if dd/mm/yyyy
             if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
                 const [d, m, y] = dateStr.split('/');
                 return `${y}-${m}-${d}`; // Return yyyy-mm-dd
             }
             return dateStr; // Assume already correct or ISO
        };

        const enrichedAddress = data.logradouro ? {
            type: 'Principal',
            street: data.logradouro,
            number: data.numero || '',
            complement: data.complemento || '',
            district: data.bairro || '',
            city: data.municipio,
            state: data.uf,
            zipCode: data.cep ? data.cep.replace(/\D/g, '') : ''
        } : null;

        setFormData(prev => {
          const existingAddresses = Array.isArray(prev.addresses) ? prev.addresses : [];
          const nextAddresses = enrichedAddress && !existingAddresses.some(address =>
            (address.zipCode || '') === enrichedAddress.zipCode &&
            (address.street || '').trim().toLowerCase() === enrichedAddress.street.trim().toLowerCase() &&
            (address.number || '').trim().toLowerCase() === (enrichedAddress.number || '').trim().toLowerCase()
          )
            ? [...existingAddresses, enrichedAddress]
            : existingAddresses;

          return {
            ...prev,
            companyName: companyName,
            name: tradeName,
            document: prev.document || prev.cnpj || formData.cnpj || undefined,
            email: data.email || prev.email,
            phone: data.telefone || data.ddd_telefone_1 || prev.phone,
            openingDate: normalizeDate(data.abertura) ?? undefined,
            size: data.porte,
            legalNature: data.natureza_juridica,
            mainActivity: data.atividade_principal ? data.atividade_principal[0] : null,
            sideActivities: data.atividades_secundarias || [],
            shareCapital: data.capital_social,
            status: data.situacao,
            statusDate: normalizeDate(data.data_situacao) ?? undefined,
            statusReason: data.motivo_situacao,
            specialStatus: data.situacao_especial,
            specialStatusDate: normalizeDate(data.data_situacao_especial) ?? undefined,
            pjQsa: data.qsa || [],
            addresses: nextAddresses
          };
        });
        
        if (enrichedAddress) {
             toast.success('Dados da empresa e endereço carregados com sucesso!');
        } else {
             toast.success('Dados da empresa carregados com sucesso!');
        }
    } catch (err: any) {
      console.error(err);
      const message = err.response?.data?.message || 'CNPJ não encontrado';
      toast.error(`Erro: ${message}`);
    } finally {
      setEnriching(false);
    }
  };

  const handleBlurLookup = async (field: keyof ContactData, value: string | undefined) => {
      // Somente valida se preencheu algo, e ignoramos se já estiver salvo e o valor encontrado for de outro? 
      // Se encontrarmos, redirecionamos.
      if (!value || !value.trim()) return;

      // Ignorar placeholders
      const isPlaceholderPhone = (val: string) => {
          const d = val.replace(/\D/g, '');
          return d === '9999999999' || d === '99999999999';
      };
      const isPlaceholderEmail = (val: string) => val.toLowerCase().trim() === 'nt@nt.com.br';
      
      if ((field === 'whatsapp' || field === 'phone') && isPlaceholderPhone(value)) return;
      if (field === 'email' && isPlaceholderEmail(value)) return;

      if (id !== 'new') return; // Se já estamos editando um contato existente, evitar redirecionamentos surpresa (ou podemos redirecionar se for diferente do id atual). A regra faz mais sentido na criação.
      
      try {
          // Send only the current field being typed to check specifically
          const params = new URLSearchParams({ [field]: value });
          const res = await api.get(`/contacts/lookup/exact?${params.toString()}`);
          if (res.data && res.data.id && res.data.id !== id) {
               navigate(`/contacts/${res.data.id}`);
          }
      } catch (err) {
          // Ignora abertamente, se falhar ou não achar só segue a vida
      }
  };

  // Enriquecimento de CEP
  const handleEnrichCEP = async (cepValue?: string) => {
    const zipToConsult = cepValue || addressForm.zipCode;
    if (!zipToConsult) {
      return;
    }

    const cleanZip = zipToConsult.replace(/\D/g, '');
    if (cleanZip.length < 8) return;

    setEnriching(true);
    try {
      const response = await api.get(`/contacts/enrich/cep?cep=${cleanZip}`);
      const data = response.data;

        setAddressForm(prev => ({
          ...prev,
          street: data.logradouro || prev.street,
          city: data.localidade || prev.city,
          state: data.uf || prev.state,
          district: data.bairro || prev.district,
        }));
        toast.success('Endereço carregado via CEP!');
    } catch (err: any) {
      console.error(err);
      // Quiet fail if automatic
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

    // Verificar duplicidade antes de enviar
    const isDuplicate = Array.isArray(formData.addresses) && formData.addresses.some(address =>
      (address.zipCode || '') === addressForm.zipCode &&
      (address.street || '').trim().toLowerCase() === addressForm.street?.trim().toLowerCase() &&
      (address.number || '').trim().toLowerCase() === (addressForm.number || '').trim().toLowerCase()
    );

    if (isDuplicate) {
      toast.warning('Este endereço já está cadastrado para este contato.');
      return;
    }

    try {
      setLoading(true);
      await api.post(`/contacts/${id}/addresses`, addressForm);

      await fetchContact();
      setAddressForm({ type: 'Principal', street: '', number: '', city: '', state: '', zipCode: '', complement: '', district: '' });
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
      setAddressForm({ type: 'Principal', street: '', number: '', city: '', state: '', zipCode: '', complement: '', district: '' });
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

  const handlePrimaryAddressAction = () => {
    if (!id || id === 'new') {
      toast.warning('Salve o contato antes de adicionar endereços');
      return;
    }

    if (!showAddressForm) {
      setShowAddressForm(true);
      return;
    }

    if (editingAddress) {
      handleUpdateAddress();
      return;
    }

    if (hasFilledAddress(addressForm)) {
      handleAddAddress();
      return;
    }

    zipCodeRef.current?.focus();
  };

  const startEditAddress = (address: Address) => {
    setEditingAddress(address);
    setAddressForm(address);
    setShowAddressForm(true);
  };

  const cancelAddressForm = () => {
    setShowAddressForm(false);
    setEditingAddress(null);
    setAddressForm({ type: 'Principal', street: '', number: '', city: '', state: '', zipCode: '', complement: '', district: '' });
  };

  // Additional Contact form states
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState<AdditionalContact | null>(null);
  const [contactForm, setContactForm] = useState<AdditionalContact>({
    type: 'EMAIL',
    value: '',
    nomeContatoAdicional: '',
  });
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);

  const contactAttachments = useMemo(
    () => (Array.isArray(formData.metadata?.attachments) ? (formData.metadata?.attachments as ContactAttachment[]) : []),
    [formData.metadata],
  );

  const contractTypeOptions = useMemo(() => {
    const defaults = [
      'Honorários',
      'Prestação de Serviços',
      'Locação',
      'Mensalidade',
      'Manutenção',
      'Licenciamento',
      'Assinatura',
      'Parceria',
    ];
    const dynamic = contracts.map(contract => contract.type).filter(Boolean);
    const currentType = contractForm.type && contractForm.type !== '__new__' ? [contractForm.type] : [];
    return Array.from(new Set([...defaults, ...dynamic, ...currentType])).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [contracts, contractForm.type]);

  const filteredAssets = useMemo(() => {
    const term = assetSearch.trim().toLowerCase();
    if (!term) return assets;

    return assets.filter(asset =>
      asset.assetType.name.toLowerCase().includes(term) ||
      asset.description.toLowerCase().includes(term) ||
      (asset.notes || '').toLowerCase().includes(term) ||
      String(asset.value || '').includes(term),
    );
  }, [assets, assetSearch]);

  const filteredContracts = useMemo(() => {
    const term = contractSearch.trim().toLowerCase();
    if (!term) return contracts;

    return contracts.filter(contract =>
      contract.type.toLowerCase().includes(term) ||
      contract.description.toLowerCase().includes(term) ||
      contract.counterpartyName.toLowerCase().includes(term) ||
      (contract.notes || '').toLowerCase().includes(term),
    );
  }, [contracts, contractSearch]);

  const filteredFinancialRecords = useMemo(() => {
    const term = financialSearch.trim().toLowerCase();
    if (!term) return financialRecords;

    return financialRecords.filter(record =>
      record.description.toLowerCase().includes(term) ||
      (record.category || '').toLowerCase().includes(term) ||
      (record.financialCategory?.name || '').toLowerCase().includes(term) ||
      (record.bankAccount?.title || '').toLowerCase().includes(term) ||
      (record.paymentMethod || '').toLowerCase().includes(term),
    );
  }, [financialRecords, financialSearch]);

  const financialSummary = useMemo(() => {
    return filteredFinancialRecords.reduce(
      (summary, record) => {
        const amount = Number(record.amount || 0);
        if (record.type === 'INCOME') {
          summary.income += amount;
        } else {
          summary.expense += amount;
        }
        if ((record.effectiveStatus || record.status) === 'OVERDUE') {
          summary.overdue += 1;
        }
        if ((record.effectiveStatus || record.status) === 'PENDING') {
          summary.pending += 1;
        }
        return summary;
      },
      { income: 0, expense: 0, overdue: 0, pending: 0 },
    );
  }, [filteredFinancialRecords]);

  const handleAddContact = async () => {
    if (!id || id === 'new') {
        toast.warning('Salve o contato antes de adicionar contatos extras');
        return;
    }
    try {
        setLoading(true);
        await api.post(`/contacts/${id}/additional-contacts`, contactForm);
        await fetchContact();
        setContactForm({ type: 'EMAIL', value: '', nomeContatoAdicional: '' });
        setShowContactForm(false);
        toast.success('Contato adicionado!');
    } catch (err: any) {
        console.error(err);
        const msg = err.response?.data?.message 
            ? (Array.isArray(err.response.data.message) ? err.response.data.message[0] : err.response.data.message)
            : 'Erro ao adicionar contato extra';
        toast.error(msg);
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
          setContactForm({ type: 'EMAIL', value: '', nomeContatoAdicional: '' });
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
      setContactForm({
        type: contact.type,
        value: contact.value,
        nomeContatoAdicional: contact.nomeContatoAdicional || '',
        id: contact.id,
      });
      setShowContactForm(true);
  };

  const cancelContactForm = () => {
      setShowContactForm(false);
      setEditingContact(null);
      setContactForm({ type: 'EMAIL', value: '', nomeContatoAdicional: '' });
  };

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (returnTo) {
                  navigate(decodeURIComponent(returnTo));
                  return;
                }

                navigate('/contacts');
              }}
              className="flex items-center gap-1 text-slate-400 hover:text-white transition"
            >
                <ArrowLeft size={16} /> Voltar
            </button>
            <h1 className="text-2xl font-bold text-white">
                {id === 'new' ? 'Novo Contato' : `Editar Contato: ${formData.name}`}
            </h1>
        </div>
        <div className="flex gap-2">
            <button
                onClick={handleOpenPhone}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 text-sm border border-slate-700"
            >
                <Phone size={14} /> Ligar
            </button>
             <button
                onClick={handleOpenWhatsapp}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 text-sm border border-slate-700"
             >
                <MessageSquare size={14} /> WhatsApp
            </button>
             <button
                onClick={() => setActiveTab('agenda')}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 text-sm border border-slate-700"
             >
                <Calendar size={14} /> Agenda
            </button>
            <button 
                onClick={() => setIsHelpOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium transition border border-slate-700 text-sm"
                title="Ajuda (F1)"
            >
                <HelpCircle size={14} /> Ajuda
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
        {/* Tab Content */}
        <div className="p-8">
            {activeTab === 'contact' && (
                <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
                     {/* General Information */}
                     <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-800">
                         <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                             <FileText size={20} className="text-indigo-400" /> Informações Principais
                         </h3>
                         
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                             {/* Nome Fantasia / Nome */}
                             <div className="space-y-2 md:col-span-3">
                                 <label className="text-sm font-medium text-slate-400">
                                     {formData.personType === 'PJ' ? 'Nome Fantasia *' : 'Nome Completo *'}
                                 </label>
                                 <input 
                                    autoFocus
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                    onBlur={e => handleBlurLookup('name', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                    placeholder={formData.personType === 'PJ' ? "Nome Fantasia da Empresa" : "Nome do Contato"}
                                 />
                             </div>

                             {/* Celular / WhatsApp */}
                             <div className="space-y-2">
                                 <label className="text-sm font-medium text-slate-400">
                                     Celular / WhatsApp {requireOneInfo ? '*' : ''}
                                 </label>
                                 <input 
                                    value={formData.whatsapp || ''}
                                    onChange={e => setFormData({...formData, whatsapp: masks.phone(e.target.value)})}
                                    onBlur={e => handleBlurLookup('whatsapp', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                    placeholder="(00) 00000-0000"
                                    maxLength={15}
                                 />
                             </div>

                             {/* Telefone */}
                             <div className="space-y-2">
                                 <label className="text-sm font-medium text-slate-400">Telefone Fixo</label>
                                 <input 
                                    value={formData.phone || ''}
                                    onChange={e => setFormData({...formData, phone: masks.phone(e.target.value)})}
                                    onBlur={e => handleBlurLookup('phone', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                    placeholder="(00) 0000-0000"
                                    maxLength={14}
                                 />
                             </div>

                             {/* WhatsApp Full ID */}
                             <div className="space-y-2">
                                 <label className="text-sm font-medium text-slate-400 flex items-center gap-1">
                                     WhatsApp ID (Sistema)
                                     <HelpCircle size={12} className="text-slate-500" title="Identificador técnico do WhatsApp (ex: 55... @s.whatsapp.net)" />
                                 </label>
                                 <input 
                                    value={formData.whatsappFullId || ''}
                                    onChange={e => setFormData({...formData, whatsappFullId: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                    placeholder="Identificador do WhatsApp"
                                 />
                             </div>

                             {/* E-mail */}
                             <div className="space-y-2">
                                 <label className="text-sm font-medium text-slate-400">E-mail</label>
                                 <input 
                                    type="email"
                                    value={formData.email || ''}
                                    onChange={e => setFormData({...formData, email: e.target.value})}
                                    onBlur={e => handleBlurLookup('email', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                    placeholder="email@exemplo.com"
                                 />
                             </div>
                             
                             {/* Documento (CPF / CNPJ) - Misto */}
                             <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-medium text-slate-400">
                                    Documento (CPF / CNPJ)
                                </label>
                                <div className="flex gap-2">
                                    <input 
                                        value={formData.document || formData.cnpj || formData.cpf || ''}
                                        onChange={e => {
                                            const raw = e.target.value.replace(/\D/g, '');
                                            let formatted = raw;
                                            let type = 'LEAD';

                                            if (raw.length <= 11) {
                                                formatted = masks.cpf(raw);
                                                if (raw.length === 11) type = 'PF'; // 11 digits = PF
                                            } else {
                                                formatted = masks.cnpj(raw);
                                                type = 'PJ'; // > 11 digits = PJ (assuming user types 14)
                                            }
                                            
                                            // Rules:
                                            // Empty -> Lead
                                            // 11 digits -> PF
                                            // 14 digits -> PJ
                                            
                                            // We update state immediately for feedback, but tabs might flicker if we strict check.
                                            // But since we want to show/hide tabs, immediate update is correct.
                                            
                                            const newData = { ...formData, personType: type };

                                            // Sync specific fields
                                            if (type === 'PJ') {
                                                newData.cnpj = formatted;
                                                newData.cpf = '';
                                                newData.document = formatted;
                                            } else if (type === 'PF') {
                                                newData.cpf = formatted;
                                                newData.cnpj = '';
                                                newData.document = formatted;
                                            } else {
                                                // Lead or partial typing
                                                // Keep the value in document field for display, but clear specific ones?
                                                // Or just keep the last valid one? 
                                                // Better to store in 'document' and clear cpf/cnpj until valid?
                                                // If we clear, we lose data if user backspaces from 12->11. 
                                                // Store everything in respective fields or document.
                                                // For now, let's keep it simple: always update document.
                                                newData.document = formatted;
                                                // Partial typing shouldn't necessarily clear fields unless we want to reset classification.
                                                if (type === 'LEAD') {
                                                    newData.cpf = '';
                                                    newData.cnpj = '';
                                                }
                                            }
                                            setFormData(newData);
                                        }}
                                        onBlur={e => handleBlurLookup('document', e.target.value)}
                                        className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                        placeholder="CPF ou CNPJ"
                                        maxLength={18}
                                    />
                                    {formData.personType === 'PJ' && (
                                        <button
                                            type="button"
                                            onClick={handleEnrichCNPJ}
                                            disabled={enriching || !formData.cnpj || !isValidCnpj(formData.cnpj)}
                                            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium transition disabled:opacity-50 flex items-center justify-center"
                                            title="Consultar na Receita"
                                        >
                                            <Search size={16} />
                                        </button>
                                    )}
                                </div>
                             </div>

                             {/* Observações */}
                             <div className="space-y-2 md:col-span-3">
                                 <label className="text-sm font-medium text-slate-400">Observações</label>
                                 <textarea 
                                    rows={4}
                                    value={formData.notes || ''}
                                    onChange={e => setFormData({...formData, notes: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                    placeholder="Observações gerais sobre o contato..."
                                 />
                             </div>
                         </div>
                     </div>

                     <div className="flex justify-end pt-4 gap-3 bg-slate-900 border-t border-slate-800 -mx-6 -mb-6 p-6 mt-8 rounded-b-lg">
                          <button 
                             type="button"
                             onClick={() => {
                                 if (returnTo) {
                                     navigate(decodeURIComponent(returnTo));
                                 } else {
                                     navigate('/contacts');
                                 }
                             }}
                             className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition"
                          >
                             Cancelar (ESC)
                          </button>
                          <button 
                             type="submit"
                             onClick={(e) => { e.preventDefault(); handleSubmit(e, false); }}
                             disabled={loading}
                             className="px-6 py-2 bg-indigo-600/90 hover:bg-indigo-600 text-white rounded-lg font-medium transition shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                          >
                             Salvar
                          </button>
                          <button 
                             type="button"
                             onClick={(e) => { e.preventDefault(); handleSubmit(e, true); }}
                             disabled={loading}
                             className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                          >
                             Salvar e Sair
                          </button>
                     </div>
                </form>
            )}

            {activeTab === 'pf_details' && (
                <div className="space-y-6 max-w-4xl">
                     <div className="flex justify-end">
                        <button onClick={handleSubmit} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium mb-4">
                            Salvar Alterações
                        </button>
                     </div>

                     <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-800">
                         <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                             <Users size={20} className="text-indigo-400" /> Dados Pessoais (Detalhado)
                         </h3>
                         
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              {/* Row 1: Nome Completo Legal (3 cols) */}
                              <div className="space-y-2 md:col-span-3">
                                  <label className="text-sm font-medium text-slate-400">Nome Completo (Registro Civil)</label>
                                  <input 
                                     value={formData.fullName || ''}
                                     onChange={e => setFormData({...formData, fullName: e.target.value})}
                                     className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                     placeholder="Nome completo conforme documentos"
                                  />
                              </div>

                              {/* Row 2: CPF, RG, RG Emitido */}
                              <div className="space-y-2">
                                  <label className="text-sm font-medium text-slate-400">CPF</label>
                                  <input 
                                     value={formData.cpf || ''}
                                     onChange={e => setFormData({...formData, cpf: masks.cpf(e.target.value)})}
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
                                     placeholder="RG"
                                  />
                              </div>
                              <div className="space-y-2">
                                  <label className="text-sm font-medium text-slate-400">RG - Emitido em</label>
                                  <div className="flex gap-2">
                                      <input 
                                        type="date"
                                        value={formData.rgIssueDate || ''}
                                        onChange={e => setFormData({...formData, rgIssueDate: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                      />
                                  </div>
                              </div>

                              {/* Row 3: CNH (Substitui Email Secundário + Extras) */}
                              <div className="space-y-2">
                                  <label className="text-sm font-medium text-slate-400">CNH Nº</label>
                                  <input 
                                     value={formData.cnh || ''}
                                     onChange={e => setFormData({...formData, cnh: e.target.value})}
                                     className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                  />
                              </div>
                              <div className="space-y-2">
                                  <label className="text-sm font-medium text-slate-400">Categoria CNH</label>
                                  <input 
                                     value={formData.cnhCategory || ''}
                                     onChange={e => setFormData({...formData, cnhCategory: e.target.value})}
                                     className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                     placeholder="Ex: AB"
                                  />
                              </div>
                              <div className="space-y-2">
                                  <label className="text-sm font-medium text-slate-400">Data CNH (Emissão)</label>
                                  <input 
                                     type="date"
                                     value={formData.cnhIssueDate || ''}
                                     onChange={e => setFormData({...formData, cnhIssueDate: e.target.value})}
                                     className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                  />
                              </div>
                              <div className="space-y-2">
                                  <label className="text-sm font-medium text-slate-400">Validade CNH</label>
                                  <input 
                                     type="date"
                                     value={formData.cnhExpirationDate || ''}
                                     onChange={e => setFormData({...formData, cnhExpirationDate: e.target.value})}
                                     className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                  />
                              </div>
                              <div className="space-y-2">
                                   <label className="text-sm font-medium text-slate-400">Órgão Emissor CNH</label>
                                  <input 
                                     value={formData.cnhIssuer || ''}
                                     onChange={e => setFormData({...formData, cnhIssuer: e.target.value})}
                                     className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                     placeholder="Ex: DETRAN/SP"
                                  />
                              </div>
                              <div className="space-y-2">
                                 {/* Spacer or extra field */}
                              </div>
                              
                              {/* Row 4: Data Nasc, Naturalidade, Nacionalidade */}
                              <div className="space-y-2">
                                  <label className="text-sm font-medium text-slate-400">Data de Nascimento</label>
                                  <input 
                                     type="date"
                                     value={formData.birthDate || ''}
                                     onChange={e => setFormData({...formData, birthDate: e.target.value})}
                                     className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                  />
                              </div>
                              <div className="space-y-2">
                                  <label className="text-sm font-medium text-slate-400">Naturalidade</label>
                                  <input 
                                     value={formData.naturality || ''}
                                     onChange={e => setFormData({...formData, naturality: e.target.value})}
                                     className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                     placeholder="Cidade/UF"
                                  />
                              </div>
                              <div className="space-y-2">
                                  <label className="text-sm font-medium text-slate-400">Nacionalidade</label>
                                  <input 
                                     value={formData.nationality || 'Brasileira'}
                                     onChange={e => setFormData({...formData, nationality: e.target.value})}
                                     className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                     placeholder="País"
                                  />
                              </div>

                              {/* Row 5: NIS, PIS, CTPS */}
                              <div className="space-y-2">
                                  <label className="text-sm font-medium text-slate-400">Nº NIS</label>
                                  <input 
                                     value={formData.nis || ''}
                                     onChange={e => setFormData({...formData, nis: e.target.value})}
                                     className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                  />
                              </div>
                              <div className="space-y-2">
                                  <label className="text-sm font-medium text-slate-400">Nº PIS</label>
                                  <input 
                                     value={formData.pis || ''}
                                     onChange={e => setFormData({...formData, pis: e.target.value})}
                                     className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                  />
                              </div>
                              <div className="space-y-2">
                                  <label className="text-sm font-medium text-slate-400">Nº CTPS</label>
                                  <input 
                                     value={formData.ctps || ''}
                                     onChange={e => setFormData({...formData, ctps: e.target.value})}
                                     className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                  />
                              </div>

                              {/* Row 6: Filiação */}
                              <div className="space-y-2 md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="space-y-2">
                                      <label className="text-sm font-medium text-slate-400">Nome da Mãe</label>
                                      <input 
                                         value={formData.motherName || ''}
                                         onChange={e => setFormData({...formData, motherName: e.target.value})}
                                         className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                      />
                                  </div>
                                  <div className="space-y-2">
                                      <label className="text-sm font-medium text-slate-400">Nome do Pai</label>
                                      <input 
                                         value={formData.fatherName || ''}
                                         onChange={e => setFormData({...formData, fatherName: e.target.value})}
                                         className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                      />
                                  </div>
                              </div>

                              {/* Row 7: Profissão, Gênero, Estado Civil */}
                              <div className="space-y-2">
                                  <label className="text-sm font-medium text-slate-400">Profissão</label>
                                  <input 
                                     value={formData.profession || ''}
                                     onChange={e => setFormData({...formData, profession: e.target.value})}
                                     className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                  />
                              </div>
                              <div className="space-y-2">
                                  <label className="text-sm font-medium text-slate-400">Gênero</label>
                                  <select 
                                     value={formData.gender || ''}
                                     onChange={e => setFormData({...formData, gender: e.target.value})}
                                     className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                  >
                                      <option value="">Selecione</option>
                                      <option value="MASCULINO">Masculino</option>
                                      <option value="FEMININO">Feminino</option>
                                      <option value="OUTRO">Outro</option>
                                  </select>
                              </div>
                              <div className="space-y-2">
                                  <label className="text-sm font-medium text-slate-400">Estado Civil</label>
                                  <select 
                                     value={formData.civilStatus || ''}
                                     onChange={e => setFormData({...formData, civilStatus: e.target.value})}
                                     className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                  >
                                      <option value="">Selecione</option>
                                      <option value="SOLTEIRO">Solteiro(a)</option>
                                      <option value="CASADO">Casado(a)</option>
                                      <option value="DIVORCIADO">Divorciado(a)</option>
                                      <option value="VIUVO">Viúvo(a)</option>
                                      <option value="UNIAO_ESTAVEL">União Estável</option>
                                  </select>
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
            
            {/* PJ Tab is used for PJ Details when active */}
            {activeTab === 'pj_details' && (
               <PJTab formData={formData} setFormData={setFormData} onSave={handleSubmit} />
            )}



            {activeTab === 'addresses' && (
                <div className="space-y-6 max-w-4xl">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <MapPin size={20} className="text-indigo-400" /> Endereços Cadastrados
                        </h3>
                        <button
                            onClick={handlePrimaryAddressAction}
                            disabled={!id || id === 'new'}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus size={16} />
                            {showAddressForm
                              ? editingAddress
                                ? 'Atualizar Endereço'
                                : hasFilledAddress(addressForm)
                                  ? 'Salvar Endereço'
                                  : 'Adicionar Endereço'
                              : 'Adicionar Endereço'}
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
                                <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-800 animate-fadeIn">
                                    <h4 className="text-md font-semibold text-white mb-4">
                                        {editingAddress ? 'Editar Endereço' : 'Novo Endereço'}
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* Linha 1: CEP, Número, Complemento */}
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                                                <a
                                                    href="https://buscacepinter.correios.com.br/app/endereco/index.php"
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center justify-center text-indigo-400 hover:text-indigo-300 transition"
                                                    title="Pesquisar CEP nos Correios"
                                                >
                                                    <Search size={14} />
                                                </a>
                                                <span>CEP</span>
                                            </label>
                                            <input
                                                id="addr-zip"
                                                ref={zipCodeRef}
                                                value={addressForm.zipCode}
                                                onChange={e => setAddressForm({...addressForm, zipCode: masks.cep(e.target.value)})}
                                                onBlur={e => handleEnrichCEP(e.target.value)}
                                                onKeyDown={e => handleAddressKeyDown(e, 'addr-number')}
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                                placeholder="00000-000"
                                                maxLength={9}
                                            />
                                            <p className="text-[11px] text-slate-500">Nao sabe o CEP? Use a lupa para pesquisar nos Correios.</p>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-400">Número</label>
                                            <input
                                                id="addr-number"
                                                value={addressForm.number}
                                                onChange={e => setAddressForm({...addressForm, number: e.target.value})}
                                                onKeyDown={e => handleAddressKeyDown(e, 'addr-complement')}
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                                placeholder="123"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-400">Complemento</label>
                                            <input
                                                id="addr-complement"
                                                value={addressForm.complement || ''}
                                                onChange={e => setAddressForm({...addressForm, complement: e.target.value})}
                                                onKeyDown={e => handleAddressKeyDown(e, 'addr-street')}
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                                placeholder="Apto, Sala, KM..."
                                            />
                                        </div>

                                        {/* Linha 2: Logradouro, Bairro */}
                                        <div className="space-y-2 md:col-span-2">
                                            <label className="text-sm font-medium text-slate-400">Logradouro</label>
                                            <input
                                                id="addr-street"
                                                value={addressForm.street}
                                                onChange={e => setAddressForm({...addressForm, street: e.target.value})}
                                                onKeyDown={e => handleAddressKeyDown(e, 'addr-district')}
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                                placeholder="Rua, Avenida, etc."
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-400">Bairro</label>
                                            <input
                                                id="addr-district"
                                                value={addressForm.district || ''}
                                                onChange={e => setAddressForm({...addressForm, district: e.target.value})}
                                                onKeyDown={e => handleAddressKeyDown(e, 'addr-city')}
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                                placeholder="Nome do Bairro"
                                            />
                                        </div>

                                        {/* Linha 3: Cidade, Estado, Tipo */}
                                        <div className="space-y-2 md:col-span-2">
                                            <label className="text-sm font-medium text-slate-400">Cidade</label>
                                            <input
                                                id="addr-city"
                                                value={addressForm.city}
                                                onChange={e => setAddressForm({...addressForm, city: e.target.value})}
                                                onKeyDown={e => handleAddressKeyDown(e, 'addr-state')}
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                                placeholder="Ex: São Paulo"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-400">Estado (UF)</label>
                                            <input
                                                id="addr-state"
                                                value={addressForm.state}
                                                onChange={e => setAddressForm({...addressForm, state: e.target.value.toUpperCase()})}
                                                onKeyDown={e => handleAddressKeyDown(e, 'addr-type')}
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                                placeholder="SP"
                                                maxLength={2}
                                            />
                                        </div>

                                        <div className="space-y-2 md:col-span-3">
                                            <label className="text-sm font-medium text-slate-400">Tipo de Endereço</label>
                                            {!creatingAddressType ? (
                                                <select
                                                    id="addr-type"
                                                    value={addressForm.type}
                                                    onChange={e => {
                                                        if (e.target.value === 'NEW') {
                                                            setCreatingAddressType(true);
                                                        } else {
                                                            setAddressForm({...addressForm, type: e.target.value});
                                                        }
                                                    }}
                                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                                >
                                                    <option value="Principal">Principal</option>
                                                    <option value="Residencial">Residencial</option>
                                                    <option value="Comercial">Comercial</option>
                                                    <option value="Cobrança">Cobrança</option>
                                                    <option value="Outro">Outro</option>
                                                    <option value="NEW">+ Adicionar Novo Tipo...</option>
                                                </select>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <input 
                                                        autoFocus
                                                        value={newAddressType}
                                                        onChange={e => setNewAddressType(e.target.value)}
                                                        className="flex-1 bg-slate-950 border border-indigo-500 rounded px-3 py-2 text-white focus:outline-none"
                                                        placeholder="Digite o novo tipo..."
                                                    />
                                                    <button 
                                                        onClick={() => {
                                                            if (newAddressType) {
                                                                setAddressForm({...addressForm, type: newAddressType});
                                                                setNewAddressType('');
                                                            }
                                                            setCreatingAddressType(false);
                                                        }}
                                                        className="px-4 bg-indigo-600 text-white rounded"
                                                    >
                                                        Ok
                                                    </button>
                                                    <button 
                                                        onClick={() => setCreatingAddressType(false)}
                                                        className="px-2 text-slate-400"
                                                    >
                                                        X
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-2 mt-6">
                                        <button
                                            onClick={editingAddress ? handleUpdateAddress : handleAddAddress}
                                            disabled={loading || enriching}
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
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Home size={16} className="text-indigo-400" />
                                                        <span className="font-medium text-white">
                                                            {address.street}, {address.number}
                                                            {address.complement && ` - ${address.complement}`}
                                                        </span>
                                                        <span className="text-[10px] px-2 py-0.5 bg-indigo-900/50 text-indigo-300 rounded-full border border-indigo-700/50">
                                                            {address.type}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-slate-400">
                                                        {address.district ? `${address.district}, ` : ''}{address.city} - {address.state}
                                                    </p>
                                                    <p className="text-sm text-slate-400">CEP: {address.zipCode}</p>
                                                    
                                                    <a 
                                                        href={`https://www.google.com/maps/dir/?api=1&origin=My+Location&destination=${encodeURIComponent(`${address.street}, ${address.number} - ${address.district || ''}, ${address.city} - ${address.state}, ${address.zipCode}`)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 mt-2 transition"
                                                    >
                                                        <MapPin size={12} /> Ver Rota no Google Maps
                                                    </a>
                                                </div>
                                                <div className="flex gap-1">
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
            )}

            {activeTab === 'relations' && (
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
            )}

            {activeTab === 'contacts' && (
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
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-400">Nome do contato adicional</label>
                                            <input
                                                value={contactForm.nomeContatoAdicional || ''}
                                                onChange={e => setContactForm({...contactForm, nomeContatoAdicional: e.target.value})}
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                                placeholder="Ex: Maria do Financeiro"
                                            />
                                        </div>
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
                                                        {contact.nomeContatoAdicional && (
                                                            <p className="text-sm font-semibold text-slate-200">{contact.nomeContatoAdicional}</p>
                                                        )}
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
            )}

            {activeTab === 'attachments' && (
                <div className="space-y-6 max-w-5xl">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Paperclip size={20} className="text-indigo-400" /> Anexos do Contato
                            </h3>
                            <p className="text-sm text-slate-400 mt-1">
                                Centralize contratos, PDFs, imagens, planilhas e outros documentos do contato em um so lugar.
                            </p>
                        </div>
                        <div className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-sm text-slate-300">
                            {contactAttachments.length} arquivo(s) salvo(s)
                        </div>
                    </div>

                    {!id || id === 'new' ? (
                        <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-8 text-center">
                            <p className="text-slate-400">Salve o contato antes de anexar documentos</p>
                        </div>
                    ) : (
                        <>
                            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-4">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                    <div>
                                        <p className="text-white font-medium">Upload multiplo</p>
                                        <p className="text-sm text-slate-400 mt-1">
                                            Aceita PDF, imagens, Word, Excel e outros arquivos. 
                                            <strong> O salvamento é automático ao selecionar.</strong>
                                        </p>
                                    </div>
                                    <label 
                                        htmlFor="contact-attachments-upload"
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium cursor-pointer transition group"
                                    >
                                        <Upload size={16} className="group-hover:scale-110 transition-transform" />
                                        Selecionar arquivos
                                        <input
                                            id="contact-attachments-upload"
                                            type="file"
                                            multiple
                                            className="sr-only"
                                            onChange={(event) => {
                                                if (event.target.files) {
                                                    handleAttachmentSelection(event.target.files);
                                                    // Limpa o valor para permitir selecionar o mesmo arquivo novamente
                                                    event.target.value = ''; 
                                                }
                                            }}
                                        />
                                    </label>
                                </div>

                                {pendingAttachments.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-medium text-slate-300">Prontos para envio</p>
                                            <button
                                                onClick={handleUploadAttachments}
                                                disabled={uploadingAttachments}
                                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition disabled:opacity-50"
                                            >
                                                {uploadingAttachments ? `Enviando... ${attachmentUploadProgress}%` : `Enviar ${pendingAttachments.length} arquivo(s)`}
                                            </button>
                                        </div>
                                        {uploadingAttachments && (
                                            <div className="space-y-2">
                                                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                                                    <div
                                                        className="h-full bg-emerald-500 transition-all duration-300"
                                                        style={{ width: `${attachmentUploadProgress}%` }}
                                                    />
                                                </div>
                                                <p className="text-xs text-emerald-300">Upload em andamento. Os arquivos aparecerao abaixo quando o envio terminar.</p>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {pendingAttachments.map((file, index) => (
                                                <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-white truncate">{file.name}</p>
                                                        <p className="text-xs text-slate-400">{formatFileSize(file.size)}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleRemovePendingAttachment(index)}
                                                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
                                                        title="Remover da fila"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-slate-400 px-1">
                                    <CheckCircle2 size={16} className="text-emerald-500" />
                                    <span className="text-sm font-medium uppercase tracking-wider">Arquivos Salvos no Sistema</span>
                                </div>
                                
                                {contactAttachments.length > 0 ? (
                                    contactAttachments.map((attachment) => {
                                        const attachmentUrl = getAttachmentUrl(attachment);
                                        return (
                                            <div key={attachment.fileName} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                                                <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start gap-4">
                                                    <div className="min-w-0 overflow-hidden w-full block">
                                                        <AttachmentPreview url={attachmentUrl} title={attachment.originalName} className="block w-full">
                                                            <button className="text-left w-full block group">
                                                                <p className="font-semibold text-white break-words hover:text-indigo-300 transition w-full max-w-full leading-tight">
                                                                    {attachment.originalName}
                                                                </p>
                                                            </button>
                                                        </AttachmentPreview>
                                                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-400">
                                                            <span>{formatFileSize(attachment.size)}</span>
                                                            <span>{attachment.mimeType || 'arquivo'}</span>
                                                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                                                                <CheckCircle2 size={12} />
                                                                Upload concluído
                                                            </span>
                                                            {attachment.uploadedAt && (
                                                                <span>{new Date(attachment.uploadedAt).toLocaleString('pt-BR')}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5 shrink-0 justify-end">
                                                        <AttachmentPreview url={attachmentUrl} title={attachment.originalName}>
                                                            <button title="Abrir arquivo" className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-slate-600 text-slate-200 hover:border-indigo-400 hover:text-white transition text-xs font-medium">
                                                                <ExternalLink size={14} />
                                                                Abrir
                                                            </button>
                                                        </AttachmentPreview>
                                                        <button
                                                            title="Baixar arquivo"
                                                            onClick={async () => {
                                                                try {
                                                                    const { fetchProtectedMediaBlob } = await import('../../services/protectedMedia');
                                                                    const safeFileName = encodeURIComponent(attachment.fileName);
                                                                    const blob = await fetchProtectedMediaBlob(`/contacts/${id}/attachments/${safeFileName}`);
                                                                    const objectUrl = URL.createObjectURL(blob);
                                                                    const link = document.createElement('a');
                                                                    link.href = objectUrl;
                                                                    link.download = attachment.originalName || attachment.fileName;
                                                                    document.body.appendChild(link);
                                                                    link.click();
                                                                    document.body.removeChild(link);
                                                                    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
                                                                } catch (err) {
                                                                    console.error(err);
                                                                    toast.error('Erro ao baixar arquivo');
                                                                }
                                                            }}
                                                            className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-slate-600 text-slate-200 hover:border-indigo-400 hover:text-white transition text-xs font-medium"
                                                        >
                                                            <Download size={14} />
                                                            Baixar
                                                        </button>
                                                        <button
                                                            title="Imprimir arquivo"
                                                            onClick={() => handlePrintAttachment(attachment)}
                                                            className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-slate-600 text-slate-200 hover:border-indigo-400 hover:text-white transition text-xs font-medium"
                                                        >
                                                            <Printer size={14} />
                                                            Imprimir
                                                        </button>
                                                        <button
                                                            title="Excluir arquivo"
                                                            onClick={() => handleDeleteAttachment(attachment.fileName)}
                                                            className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 transition text-xs font-medium"
                                                        >
                                                            <Trash2 size={14} />
                                                            Excluir
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-8 text-center">
                                        <p className="text-slate-400">Nenhum anexo salvo para este contato</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            {activeTab === 'whatsapp' && (
                <div className="space-y-6 max-w-6xl">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <MessageSquare size={20} className="text-indigo-400" /> WhatsApp e Atendimento
                            </h3>
                            <p className="text-sm text-slate-400 mt-1">
                                Consulte o historico recente do canal e abra rapidamente o atendimento do contato.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={handleOpenWhatsapp}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition"
                            >
                                <MessageSquare size={16} />
                                Abrir no WhatsApp
                            </button>
                            <button
                                onClick={() => navigate('/chat')}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:border-indigo-400 hover:text-white transition"
                            >
                                <ExternalLink size={16} />
                                Abrir Atendimento
                            </button>
                        </div>
                    </div>

                    {!id || id === 'new' ? (
                        <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-8 text-center">
                            <p className="text-slate-400">Salve o contato para consultar o historico do atendimento.</p>
                        </div>
                    ) : insightsLoading ? (
                        <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-8 text-center text-slate-400">
                            Carregando historico do WhatsApp...
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
                                    <p className="text-xs uppercase tracking-wide text-slate-400">WhatsApp principal</p>
                                    <p className="text-lg font-semibold text-white mt-2">{formData.whatsapp || 'Nao informado'}</p>
                                </div>
                                <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
                                    <p className="text-xs uppercase tracking-wide text-slate-400">Conversas</p>
                                    <p className="text-2xl font-semibold text-white mt-2">{contactInsights.whatsapp.conversations.length}</p>
                                </div>
                                <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
                                    <p className="text-xs uppercase tracking-wide text-slate-400">Tickets</p>
                                    <p className="text-2xl font-semibold text-white mt-2">{contactInsights.whatsapp.tickets.length}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-6">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-white font-semibold">Conversas recentes</h4>
                                        <span className="text-xs text-slate-500">
                                            {contactInsights.whatsapp.conversations.length} conversa(s)
                                        </span>
                                    </div>
                                    {contactInsights.whatsapp.conversations.length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-500">
                                            Nenhuma conversa de WhatsApp vinculada a este contato.
                                        </div>
                                    ) : (
                                        contactInsights.whatsapp.conversations.map(conversation => (
                                            <div key={conversation.id} className="rounded-xl border border-slate-700 bg-slate-800/40 p-4 space-y-3">
                                                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                                                    <div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="font-semibold text-white">
                                                                {conversation.title || `Conversa ${conversation.id.slice(0, 8)}`}
                                                            </p>
                                                            <span className="text-[11px] px-2 py-0.5 rounded-full border border-slate-600 text-slate-300">
                                                                {conversation.status}
                                                            </span>
                                                            {conversation.unreadCount > 0 && (
                                                                <span className="text-[11px] px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300">
                                                                    {conversation.unreadCount} nao lida(s)
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-slate-400 mt-1">
                                                            {conversation.connection?.name || 'Sem conexao identificada'}
                                                            {conversation.queue ? ` • Fila ${conversation.queue}` : ''}
                                                        </p>
                                                    </div>
                                                    <div className="text-sm text-slate-500">
                                                        {formatDateTime(conversation.lastMessageAt)}
                                                    </div>
                                                </div>

                                                {conversation.lastMessagePreview && (
                                                    <div className="rounded-lg bg-slate-950/70 border border-slate-700 px-3 py-2 text-sm text-slate-300">
                                                        {conversation.lastMessagePreview}
                                                    </div>
                                                )}

                                                <div className="space-y-2">
                                                    {conversation.messages.length === 0 ? (
                                                        <p className="text-sm text-slate-500">Sem mensagens recentes sincronizadas.</p>
                                                    ) : (
                                                        conversation.messages.map(message => (
                                                            <div key={message.id} className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="text-xs uppercase tracking-wide text-slate-500">
                                                                        {message.direction === 'OUTBOUND' ? 'Saida' : 'Entrada'}
                                                                    </span>
                                                                    <span className="text-xs text-slate-500">{formatDateTime(message.createdAt)}</span>
                                                                </div>
                                                                <p className="text-sm text-slate-200 mt-1 break-words">{message.content}</p>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-white font-semibold">Tickets do canal</h4>
                                        <span className="text-xs text-slate-500">
                                            {contactInsights.whatsapp.tickets.length} ticket(s)
                                        </span>
                                    </div>
                                    {contactInsights.whatsapp.tickets.length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-500">
                                            Nenhum ticket de WhatsApp encontrado.
                                        </div>
                                    ) : (
                                        contactInsights.whatsapp.tickets.map(ticket => (
                                            <div key={ticket.id} className="rounded-xl border border-slate-700 bg-slate-800/40 p-4 space-y-2">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <p className="font-semibold text-white">Ticket #{ticket.code}</p>
                                                        <p className="text-sm text-slate-400">{ticket.title}</p>
                                                    </div>
                                                    <span className="text-xs px-2 py-1 rounded-full border border-slate-600 text-slate-300">
                                                        {ticket.status}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500">
                                                    Prioridade {ticket.priority}
                                                    {ticket.queue ? ` • Fila ${ticket.queue}` : ''}
                                                    {ticket.waitingReply ? ' • aguardando resposta' : ''}
                                                </p>
                                                <p className="text-xs text-slate-500">Ultima atividade: {formatDateTime(ticket.lastMessageAt || ticket.updatedAt)}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {activeTab === 'agenda' && (
                <div className="space-y-6 max-w-5xl">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Calendar size={20} className="text-indigo-400" /> Compromissos vinculados
                            </h3>
                            <p className="text-sm text-slate-400 mt-1">
                                Eventos em que este contato participa, com atalho direto para a agenda completa.
                            </p>
                        </div>
                        <button
                            onClick={() => navigate('/agenda')}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:border-indigo-400 hover:text-white transition"
                        >
                            <ExternalLink size={16} />
                            Abrir Agenda
                        </button>
                    </div>

                    {!id || id === 'new' ? (
                        <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-8 text-center">
                            <p className="text-slate-400">Salve o contato para consultar os compromissos vinculados.</p>
                        </div>
                    ) : insightsLoading ? (
                        <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-8 text-center text-slate-400">
                            Carregando agenda do contato...
                        </div>
                    ) : contactInsights.appointments.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-500">
                            Nenhum compromisso vinculado a este contato.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {contactInsights.appointments.map(appointment => (
                                <div key={appointment.id} className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
                                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="font-semibold text-white">{appointment.title}</p>
                                                <span className="text-[11px] px-2 py-0.5 rounded-full border border-slate-600 text-slate-300">
                                                    {APPOINTMENT_STATUS_LABELS[appointment.status] || appointment.status}
                                                </span>
                                                <span className="text-[11px] px-2 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300">
                                                    {appointment.type}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-400 mt-1">
                                                {formatDateTime(appointment.startAt)} ate {formatDateTime(appointment.endAt)}
                                            </p>
                                            <p className="text-sm text-slate-500 mt-1">
                                                Papel: {appointment.participantRole || 'Participante'}
                                                {appointment.confirmed ? ' • confirmado' : ' • pendente'}
                                            </p>
                                        </div>
                                        {appointment.process?.id && (
                                            <button
                                                onClick={() => navigate(`/processes/${appointment.process?.id}`)}
                                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-600 text-slate-200 hover:border-indigo-400 hover:text-white transition"
                                            >
                                                <Briefcase size={15} />
                                                Abrir Processo
                                            </button>
                                        )}
                                    </div>
                                    {(appointment.location || appointment.process?.title) && (
                                        <div className="mt-3 text-sm text-slate-400 space-y-1">
                                            {appointment.location && <p>Local: {appointment.location}</p>}
                                            {appointment.process?.title && (
                                                <p>Processo: {appointment.process.title}{appointment.process.code ? ` (${appointment.process.code})` : ''}</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'processes' && (
                <div className="space-y-6 max-w-6xl">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Briefcase size={20} className="text-indigo-400" /> Processos vinculados
                            </h3>
                            <p className="text-sm text-slate-400 mt-1">
                                Casos em que este contato atua como contato principal ou parte processual.
                            </p>
                        </div>
                        <button
                            onClick={() => navigate('/processes')}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:border-indigo-400 hover:text-white transition"
                        >
                            <ExternalLink size={16} />
                            Abrir Processos
                        </button>
                    </div>

                    {!id || id === 'new' ? (
                        <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-8 text-center">
                            <p className="text-slate-400">Salve o contato para visualizar os processos vinculados.</p>
                        </div>
                    ) : insightsLoading ? (
                        <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-8 text-center text-slate-400">
                            Carregando processos do contato...
                        </div>
                    ) : contactInsights.processes.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-500">
                            Nenhum processo vinculado a este contato.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {contactInsights.processes.map(process => (
                                <button
                                    key={process.id}
                                    onClick={() => navigate(`/processes/${process.id}`)}
                                    className="text-left rounded-xl border border-slate-700 bg-slate-800/40 p-5 hover:border-indigo-400/60 hover:bg-slate-800/70 transition"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="font-semibold text-white">
                                                    {process.title || process.cnj || process.code || 'Processo sem titulo'}
                                                </p>
                                                <span className="text-[11px] px-2 py-0.5 rounded-full border border-slate-600 text-slate-300">
                                                    {process.status}
                                                </span>
                                                <span className={clsx(
                                                    'text-[11px] px-2 py-0.5 rounded-full border',
                                                    process.relation.isClient
                                                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                                      : process.relation.isOpposing
                                                        ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                                                        : 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300',
                                                )}>
                                                    {process.relation.label}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-400 mt-2">
                                                {process.cnj || 'Sem CNJ'}
                                                {process.class ? ` • ${process.class}` : ''}
                                                {process.area ? ` • ${process.area}` : ''}
                                            </p>
                                        </div>
                                        <ExternalLink size={18} className="text-slate-500" />
                                    </div>
                                    <div className="mt-4 text-sm text-slate-500 space-y-1">
                                        {(process.court || process.district) && (
                                            <p>{[process.court, process.district].filter(Boolean).join(' • ')}</p>
                                        )}
                                        <p>Ultima atualizacao: {formatDateTime(process.updatedAt)}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'assets' && (
                <div className="space-y-6 max-w-5xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Briefcase size={20} className="text-indigo-400" /> Gestão de Patrimônio
                            </h3>
                            <p className="text-sm text-slate-400 mt-1">Pesquise e gerencie os bens vinculados a este contato sem sair da aba.</p>
                        </div>
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
                             <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-3 items-center">
                                <div className="relative">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                    <input
                                        value={assetSearch}
                                        onChange={e => setAssetSearch(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                        placeholder="Buscar por tipo, descricao, observacao ou valor"
                                    />
                                </div>
                                <div className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/40 text-sm text-slate-300">
                                    {filteredAssets.length} item(ns) exibido(s)
                                </div>
                                <div className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/40 text-sm text-slate-300">
                                    Ativos: {assets.filter(asset => !asset.writeOffDate).length}
                                </div>
                             </div>
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
                                        {filteredAssets.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-slate-500">
                                                    {assetSearch ? 'Nenhum patrimônio encontrado para a busca informada.' : 'Nenhum patrimônio cadastrado.'}
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredAssets.map(asset => (
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
            )}

            {activeTab === 'contracts' && (
                <div className="space-y-6 max-w-6xl">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <FileText size={20} className="text-indigo-400" /> Contratos do Contato
                            </h3>
                            <p className="text-sm text-slate-400 mt-1">
                                Cadastre recorrencias e organize rapidamente quem paga, quem recebe e quando vence.
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                if (!showContractForm) resetContractForm();
                                setShowContractForm(true);
                            }}
                            disabled={!id || id === 'new'}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus size={16} />
                            Novo Contrato
                        </button>
                    </div>

                    {!id || id === 'new' ? (
                        <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-8 text-center">
                            <p className="text-slate-400">Salve o contato antes de cadastrar contratos</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
                                    <p className="text-xs uppercase tracking-wide text-slate-400">Contratos</p>
                                    <p className="text-2xl font-semibold text-white mt-2">{filteredContracts.length}</p>
                                </div>
                                <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
                                    <p className="text-xs uppercase tracking-wide text-slate-400">Ativos</p>
                                    <p className="text-2xl font-semibold text-emerald-300 mt-2">
                                        {filteredContracts.filter(contract => contract.status === 'ACTIVE').length}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
                                    <p className="text-xs uppercase tracking-wide text-slate-400">Receitas</p>
                                    <p className="text-2xl font-semibold text-cyan-300 mt-2">
                                        {filteredContracts.filter(contract => contract.transactionKind === 'INCOME').length}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
                                    <p className="text-xs uppercase tracking-wide text-slate-400">Despesas</p>
                                    <p className="text-2xl font-semibold text-rose-300 mt-2">
                                        {filteredContracts.filter(contract => contract.transactionKind === 'EXPENSE').length}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-center">
                                <div className="relative">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                    <input
                                        value={contractSearch}
                                        onChange={e => setContractSearch(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                        placeholder="Buscar por tipo, descricao, outra parte ou observacao"
                                    />
                                </div>
                                <div className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/40 text-sm text-slate-300">
                                    {filteredContracts.length} contrato(s) exibido(s)
                                </div>
                            </div>

                            {showContractForm && (
                                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-4">
                                    <h4 className="text-white font-semibold">
                                        {editingContract ? 'Editar contrato' : 'Novo contrato'}
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-400">Tipo</label>
                                            {!creatingContractType ? (
                                                <select
                                                    value={contractForm.type}
                                                    onChange={e => {
                                                        if (e.target.value === '__new__') {
                                                            setCreatingContractType(true);
                                                            setContractForm(prev => ({ ...prev, type: '' }));
                                                            return;
                                                        }
                                                        setContractForm(prev => ({ ...prev, type: e.target.value }));
                                                    }}
                                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                                >
                                                    <option value="">Selecione...</option>
                                                    {contractTypeOptions.map(type => (
                                                        <option key={type} value={type}>{type}</option>
                                                    ))}
                                                    <option value="__new__">+ Novo tipo</option>
                                                </select>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <input
                                                        autoFocus
                                                        value={contractForm.newTypeName}
                                                        onChange={e => setContractForm(prev => ({ ...prev, newTypeName: e.target.value }))}
                                                        className="flex-1 bg-slate-950 border border-indigo-500 rounded px-3 py-2 text-white focus:outline-none"
                                                        placeholder="Digite o novo tipo"
                                                    />
                                                    <button
                                                        onClick={() => setCreatingContractType(false)}
                                                        className="px-3 text-slate-300 hover:text-white"
                                                        type="button"
                                                    >
                                                        X
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2 xl:col-span-3">
                                            <label className="text-sm font-medium text-slate-400">Descricao</label>
                                            <input
                                                value={contractForm.description}
                                                onChange={e => setContractForm(prev => ({ ...prev, description: e.target.value }))}
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                                placeholder="Ex: Honorarios mensais da assessoria juridica"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-400">Vencimento (dia)</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={31}
                                                value={contractForm.dueDay}
                                                onChange={e => setContractForm(prev => ({ ...prev, dueDay: e.target.value }))}
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-400">Primeiro vencimento</label>
                                            <input
                                                type="date"
                                                value={contractForm.firstDueDate}
                                                onChange={e => setContractForm(prev => ({ ...prev, firstDueDate: e.target.value }))}
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-400">Cobranca</label>
                                            <select
                                                value={contractForm.billingFrequency}
                                                onChange={e => setContractForm(prev => ({ ...prev, billingFrequency: e.target.value as 'MONTHLY' | 'ANNUAL' }))}
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                            >
                                                <option value="MONTHLY">Mensal</option>
                                                <option value="ANNUAL">Anual</option>
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-400">Receita / Despesa</label>
                                            <select
                                                value={contractForm.transactionKind}
                                                onChange={e => setContractForm(prev => ({ ...prev, transactionKind: e.target.value as 'INCOME' | 'EXPENSE' }))}
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                            >
                                                <option value="INCOME">Receita</option>
                                                <option value="EXPENSE">Despesa</option>
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-400">Outra parte</label>
                                            <select
                                                value={contractForm.counterpartyRole}
                                                onChange={e => setContractForm(prev => ({ ...prev, counterpartyRole: e.target.value as 'CONTRACTOR' | 'CONTRACTED' }))}
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                            >
                                                <option value="CONTRACTOR">Contratante</option>
                                                <option value="CONTRACTED">Contratado</option>
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-400">Nome da outra parte</label>
                                            <input
                                                value={contractForm.counterpartyName}
                                                onChange={e => setContractForm(prev => ({ ...prev, counterpartyName: e.target.value }))}
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                                placeholder="Quem esta do outro lado do contrato"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-400">Status</label>
                                            <select
                                                value={contractForm.status}
                                                onChange={e => setContractForm(prev => ({ ...prev, status: e.target.value as 'ACTIVE' | 'PAUSED' | 'ENDED' }))}
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                            >
                                                <option value="ACTIVE">Ativo</option>
                                                <option value="PAUSED">Pausado</option>
                                                <option value="ENDED">Encerrado</option>
                                            </select>
                                        </div>

                                        <div className="space-y-2 xl:col-span-4">
                                            <label className="text-sm font-medium text-slate-400">Observacoes</label>
                                            <textarea
                                                rows={3}
                                                value={contractForm.notes}
                                                onChange={e => setContractForm(prev => ({ ...prev, notes: e.target.value }))}
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                                placeholder="Detalhes internos para uso operacional e de cobranca"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleCreateContract}
                                            disabled={loading}
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition disabled:opacity-50"
                                        >
                                            {loading ? 'Salvando...' : editingContract ? 'Atualizar contrato' : 'Salvar contrato'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowContractForm(false);
                                                resetContractForm();
                                            }}
                                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition"
                                            type="button"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="bg-slate-800/30 border border-slate-700 rounded-lg overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-800/50 border-b border-slate-700 text-slate-400 text-sm">
                                            <th className="p-4 font-medium">Tipo</th>
                                            <th className="p-4 font-medium">Descricao</th>
                                            <th className="p-4 font-medium">Cobranca</th>
                                            <th className="p-4 font-medium">Primeiro Venc.</th>
                                            <th className="p-4 font-medium">Fluxo</th>
                                            <th className="p-4 font-medium">Outra Parte</th>
                                            <th className="p-4 font-medium">Status</th>
                                            <th className="p-4 font-medium text-right">Acoes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {filteredContracts.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="p-8 text-center text-slate-500">
                                                    {contractSearch ? 'Nenhum contrato encontrado com os filtros atuais.' : 'Nenhum contrato cadastrado.'}
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredContracts.map(contract => (
                                                <tr key={contract.id} className="hover:bg-slate-800/40 transition">
                                                    <td className="p-4 text-white font-medium">{contract.type}</td>
                                                    <td className="p-4 text-slate-300">
                                                        <div>
                                                            <p>{contract.description}</p>
                                                            <p className="text-xs text-slate-500 mt-1">Vence todo dia {contract.dueDay}</p>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-slate-300">{CONTRACT_BILLING_LABELS[contract.billingFrequency]}</td>
                                                    <td className="p-4 text-slate-300">
                                                        {contract.firstDueDate ? new Date(contract.firstDueDate).toLocaleDateString('pt-BR') : '-'}
                                                    </td>
                                                    <td className={clsx('p-4 font-medium', contract.transactionKind === 'INCOME' ? 'text-emerald-300' : 'text-rose-300')}>
                                                        {contract.transactionKind === 'INCOME' ? 'Receita' : 'Despesa'}
                                                    </td>
                                                    <td className="p-4 text-slate-300">
                                                        <div>
                                                            <p>{contract.counterpartyName}</p>
                                                            <p className="text-xs text-slate-500">{CONTRACT_ROLE_LABELS[contract.counterpartyRole]}</p>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={clsx(
                                                            'inline-flex rounded-full border px-2 py-1 text-xs',
                                                            contract.status === 'ACTIVE' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
                                                            contract.status === 'PAUSED' && 'border-amber-500/30 bg-amber-500/10 text-amber-300',
                                                            contract.status === 'ENDED' && 'border-slate-600 bg-slate-700/40 text-slate-300',
                                                        )}>
                                                            {CONTRACT_STATUS_LABELS[contract.status]}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => startEditContract(contract)}
                                                                className="p-2 text-slate-400 hover:text-indigo-300 hover:bg-slate-700 rounded-lg transition"
                                                            >
                                                                <Edit size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteContract(contract.id)}
                                                                className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition"
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
            )}

            {activeTab === 'financial' && (
                <div className="space-y-6 max-w-6xl">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <DollarSign size={20} className="text-indigo-400" /> Financeiro do Contato
                            </h3>
                            <p className="text-sm text-slate-400 mt-1">
                                Veja todas as transacoes ligadas a este contato sem sair do cadastro.
                            </p>
                        </div>
                        <button
                            onClick={() => navigate('/financial')}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:border-indigo-400 hover:text-white transition"
                        >
                            <ExternalLink size={16} />
                            Abrir Financeiro
                        </button>
                    </div>

                    {!id || id === 'new' ? (
                        <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-8 text-center">
                            <p className="text-slate-400">Salve o contato para visualizar o financeiro vinculado</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
                                    <p className="text-xs uppercase tracking-wide text-slate-400">Receitas</p>
                                    <p className="text-2xl font-semibold text-emerald-300 mt-2">{formatCurrency(financialSummary.income)}</p>
                                </div>
                                <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
                                    <p className="text-xs uppercase tracking-wide text-slate-400">Despesas</p>
                                    <p className="text-2xl font-semibold text-rose-300 mt-2">{formatCurrency(financialSummary.expense)}</p>
                                </div>
                                <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
                                    <p className="text-xs uppercase tracking-wide text-slate-400">Pendentes</p>
                                    <p className="text-2xl font-semibold text-amber-300 mt-2">{financialSummary.pending}</p>
                                </div>
                                <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
                                    <p className="text-xs uppercase tracking-wide text-slate-400">Vencidas</p>
                                    <p className="text-2xl font-semibold text-red-300 mt-2">{financialSummary.overdue}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-center">
                                <div className="relative">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                    <input
                                        value={financialSearch}
                                        onChange={e => setFinancialSearch(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                        placeholder="Buscar por descricao, categoria, conta ou forma de pagamento"
                                    />
                                </div>
                                <div className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/40 text-sm text-slate-300">
                                    {filteredFinancialRecords.length} lancamento(s)
                                </div>
                            </div>

                            <div className="bg-slate-800/30 border border-slate-700 rounded-lg overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-800/50 border-b border-slate-700 text-slate-400 text-sm">
                                            <th className="p-4 font-medium">Tipo</th>
                                            <th className="p-4 font-medium">Descricao</th>
                                            <th className="p-4 font-medium">Vencimento</th>
                                            <th className="p-4 font-medium">Status</th>
                                            <th className="p-4 font-medium">Valor</th>
                                            <th className="p-4 font-medium">Conta</th>
                                            <th className="p-4 font-medium">Categoria</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {filteredFinancialRecords.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="p-8 text-center text-slate-500">
                                                    {financialSearch ? 'Nenhuma transacao encontrada para a busca informada.' : 'Nenhuma transacao financeira vinculada a este contato.'}
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredFinancialRecords.map(record => {
                                                const effectiveStatus = getEffectiveFinancialStatus(record);
                                                return (
                                                    <tr key={record.id} className="hover:bg-slate-800/40 transition">
                                                        <td className={clsx('p-4 font-medium', record.type === 'INCOME' ? 'text-emerald-300' : 'text-rose-300')}>
                                                            {record.type === 'INCOME' ? 'Receita' : 'Despesa'}
                                                        </td>
                                                        <td className="p-4 text-slate-300">
                                                            <div>
                                                                <p className="text-white">{record.description}</p>
                                                                <p className="text-xs text-slate-500 mt-1">
                                                                    {record.paymentMethod || 'Sem forma definida'}
                                                                    {record.contactRole ? ` • ${record.contactRole}` : ''}
                                                                </p>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-slate-300">
                                                            <div>
                                                                <p>{new Date(record.dueDate).toLocaleDateString('pt-BR')}</p>
                                                                <p className="text-xs text-slate-500">
                                                                    {record.paymentDate ? `Pago em ${new Date(record.paymentDate).toLocaleDateString('pt-BR')}` : 'Aguardando pagamento'}
                                                                </p>
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            <span className={clsx(
                                                                'inline-flex rounded-full border px-2 py-1 text-xs',
                                                                effectiveStatus === 'PAID' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
                                                                effectiveStatus === 'PENDING' && 'border-amber-500/30 bg-amber-500/10 text-amber-300',
                                                                effectiveStatus === 'OVERDUE' && 'border-red-500/30 bg-red-500/10 text-red-300',
                                                                effectiveStatus === 'PARTIAL' && 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
                                                                effectiveStatus === 'CANCELLED' && 'border-slate-600 bg-slate-700/40 text-slate-300',
                                                            )}>
                                                                {FINANCIAL_STATUS_LABELS[effectiveStatus] || effectiveStatus}
                                                            </span>
                                                        </td>
                                                        <td className={clsx('p-4 font-semibold', record.type === 'INCOME' ? 'text-emerald-300' : 'text-rose-300')}>
                                                            {formatCurrency(record.amountFinal ?? record.amount)}
                                                        </td>
                                                        <td className="p-4 text-slate-300">{record.bankAccount?.title || '-'}</td>
                                                        <td className="p-4 text-slate-300">{record.financialCategory?.name || record.category || '-'}</td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            )}

            {activeTab === 'adm' && (
                <div className="space-y-6 max-w-2xl animate-fadeIn">
                     <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-800">
                         <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                             <Settings size={20} className="text-indigo-400" /> Configurações Administrativas
                         </h3>
                         
                         <div className="flex items-center justify-between p-4 bg-slate-900 rounded-lg border border-slate-800">
                             <div>
                                 <p className="font-medium text-white">Status do Contato</p>
                                 <p className="text-sm text-slate-400">Contatos inativos não aparecem nas buscas padrão</p>
                             </div>
                             
                             <label className="relative inline-flex items-center cursor-pointer">
                                 <input 
                                    type="checkbox" 
                                    checked={formData.active !== false} 
                                    onChange={(e) => setFormData({...formData, active: e.target.checked})}
                                    className="sr-only peer"
                                 />
                                 <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                 <span className="ml-3 text-sm font-medium text-white">
                                     {formData.active !== false ? 'ATIVO' : 'INATIVO'}
                                 </span>
                             </label>
                         </div>
                     </div>
                     
                     <div className="flex justify-end pt-4">
                        <button onClick={handleSubmit} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium shadow-lg hover:shadow-green-900/20 transition-all">
                            Salvar Alterações
                        </button>
                     </div>
                </div>
            )}


        </div>
      </div>
      {/* Botão Flutuante de Retorno */}
      {returnTo && (
        <button
          onClick={() => navigate(decodeURIComponent(returnTo))}
          className="fixed bottom-8 right-8 z-[100] flex items-center gap-2 px-6 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-[0_0_30px_rgba(79,70,229,0.5)] border border-indigo-400/50 font-bold transition-all hover:scale-105 active:scale-95 animate-in slide-in-from-bottom-8 duration-500"
        >
          <ArrowLeft size={20} />
          <span>Voltar para o Local Anterior</span>
        </button>
      )}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} title="Contatos" sections={helpContacts} />
    </div>
  );
}


