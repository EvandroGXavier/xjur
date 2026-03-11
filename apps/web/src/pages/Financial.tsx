import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react';
import {
  DollarSign,
  Plus,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Calendar,
  CreditCard,
  Building2,
  X,
  Edit,
  Trash2,
  Download,
  User,
  Repeat,
  Percent,
  Calculator,
  ChevronDown,
  ChevronRight,
  Tag,
  Split,
  AlertTriangle,
  Clock,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Paperclip,
  Image,
  ArrowUp,
  ArrowDown,
  Target,
  FileText,
  Upload,
  Globe,
} from 'lucide-react';
import { api } from '../services/api';
import { toast } from 'sonner';
import { HelpModal, useHelpModal } from '../components/HelpModal';
import { helpFinancial } from '../data/helpManuals';
import { ContactPickerGlobal } from '../components/contacts/ContactPickerGlobal';
import { PaymentConditions } from './PaymentConditions';
import { InlineTags } from '../components/ui/InlineTags';
import { AdvancedTagFilter } from '../components/ui/AdvancedTagFilter';
import { BankAccountDetails } from '../components/financial/BankAccountDetails';
import { FinancialParties } from '../components/financial/FinancialParties';
import { AttachmentPreview } from '../components/ui/AttachmentPreview';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from '../hooks/useHotkeys';

interface FinancialRecord {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  paymentDate?: string;
  status: string;
  type: string;
  category?: string;
  categoryId?: string;
  paymentMethod?: string;
  notes?: string;
  createdAt?: string;
  // Encargos
  fine?: number;
  interest?: number;
  monetaryCorrection?: number;
  discount?: number;
  discountType?: string;
  amountFinal?: number;
  amountPaid?: number;
  origin?: 'MANUAL' | 'NF' | 'COMPRA' | 'PROPOSTA' | 'JUDICIAL';
  metadata?: any;
  // Parcelamento
  parentId?: string;
  installmentNumber?: number;
  totalInstallments?: number;
  periodicity?: string;
  isResidual?: boolean;
  children?: FinancialRecord[];
  process?: {
    id: string;
    cnj: string;
  };
  bankAccount?: {
    id: string;
    bankName: string;
  };
  financialCategory?: FinancialCategory;
  parties?: {
    contactId: string;
    role: string;
    amount?: number;
    contact?: Contact;
  }[];
  splits?: TransactionSplit[];
  tags?: { tag: any }[];
}

interface TransactionSplit {
  id?: string;
  contactId: string;
  role: string;
  amount: number;
  percentage?: number;
  description?: string;
}

interface FinancialCategory {
  id: string;
  name: string;
  type?: string;
  color?: string;
  _count?: { records: number };
}

interface BankAccount {
  id: string;
  title: string;
  bankName: string;
  accountType: string;
  accountNumber?: string;
  agency?: string;
  balance: number;
  isActive: boolean;
  contact?: {
    id: string;
    name: string;
    personType: string;
    cpf?: string;
    cnpj?: string;
  };
}

interface Contact {
  id: string;
  name: string;
  personType: string;
  cpf?: string;
  cnpj?: string;
  category?: string;
}

interface Dashboard {
  summary: {
    totalIncome: number;
    totalExpense: number;
    balance: number;
    pendingIncome: number;
    pendingExpense: number;
    overdueCount: number;
    partialCount: number;
    totalBalance: number;
  };
  byCategory: Record<string, { income: number; expense: number }>;
  byMonth: Record<string, { income: number; expense: number }>;
  recentRecords: FinancialRecord[];
  overdueRecords: FinancialRecord[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const PARTY_ROLE_META: Record<string, { label: string; short: string; className: string; order: number }> = {
  CREDITOR: { label: 'Credor', short: 'C', className: 'bg-emerald-500/15 text-emerald-400', order: 1 },
  DEBTOR: { label: 'Devedor', short: 'D', className: 'bg-red-500/15 text-red-400', order: 2 },
  PAYER: { label: 'Pagador', short: 'P', className: 'bg-blue-500/15 text-blue-400', order: 3 },
  BENEFICIARY: { label: 'Beneficiario', short: 'B', className: 'bg-violet-500/15 text-violet-400', order: 4 },
  GUARANTOR: { label: 'Fiador', short: 'F', className: 'bg-amber-500/15 text-amber-400', order: 5 },
  WITNESS: { label: 'Testemunha', short: 'T', className: 'bg-slate-500/15 text-slate-300', order: 6 },
};

const getPartyRoleMeta = (role: string) => {
  return PARTY_ROLE_META[role] || {
    label: role || 'Parte',
    short: role?.slice(0, 1)?.toUpperCase() || '?',
    className: 'bg-slate-500/15 text-slate-300',
    order: 99,
  };
};

export function Financial() {
  const navigate = useNavigate();
  const { isHelpOpen, setIsHelpOpen } = useHelpModal();
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'records' | 'accounts' | 'conditions'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  
  useHotkeys({
    onNew: () => handleOpenModal(),
    onCancel: () => {
        if (showModal) setShowModal(false);
        if (showBankModal) setShowBankModal(false);
        if (showInstallmentModal) setShowInstallmentModal(false);
        if (showSettleModal) setShowSettleModal(false);
        if (showConditionSubModal) setShowConditionSubModal(false);
    },
    onPrint: () => window.print()
  });

  const [showModal, setShowModal] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [showInstallmentModal, setShowInstallmentModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [selectedBankAccount, setSelectedBankAccount] = useState<BankAccount | null>(null);
  const [settlingRecord, setSettlingRecord] = useState<FinancialRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<FinancialRecord | null>(null);
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [modalTab, setModalTab] = useState<'dados' | 'partes'>('dados');
  const [paymentConditions, setPaymentConditions] = useState<any[]>([]);
  const [installments, setInstallments] = useState<{ dueDate: string; amount: number; installmentNumber: number }[]>([]);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const [nxInput, setNxInput] = useState('');
  const [showConditionSubModal, setShowConditionSubModal] = useState(false);
  const [pastedImages, setPastedImages] = useState<{ url: string; file: File }[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [savedAttachmentUrls, setSavedAttachmentUrls] = useState<Record<string, string>>({});
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const [filters, setFilters] = useState({
    type: '',
    status: '',
    category: '',
  });

  const [activeCardFilter, setActiveCardFilter] = useState<'ALL' | 'INCOME_ALL' | 'INCOME_PENDING' | 'INCOME_OVERDUE' | 'EXPENSE_ALL' | 'EXPENSE_PENDING' | 'EXPENSE_OVERDUE'>('ALL');

  const revokeSavedAttachmentUrls = useCallback(() => {
    setSavedAttachmentUrls((current) => {
      Object.values(current).forEach((url) => URL.revokeObjectURL(url));
      return {};
    });
  }, []);

  const preloadSavedAttachments = useCallback(async (record: FinancialRecord) => {
    const savedAttachments = record.metadata?.attachments;

    revokeSavedAttachmentUrls();

    if (!Array.isArray(savedAttachments) || savedAttachments.length === 0) {
      return;
    }

    try {
      const entries = await Promise.all(
        savedAttachments.map(async (att: any) => {
          const response = await api.get(
            '/financial/records/' + record.id + '/attachments/' + encodeURIComponent(att.fileName),
            { responseType: 'blob' },
          );

          return [att.fileName, URL.createObjectURL(response.data)] as const;
        }),
      );

      setSavedAttachmentUrls(Object.fromEntries(entries));
    } catch (error) {
      console.error('Erro ao carregar anexos salvos:', error);
      toast.error('Erro ao carregar anexos salvos');
    }
  }, [revokeSavedAttachmentUrls]);

  useEffect(() => {
    if (!showModal) {
      revokeSavedAttachmentUrls();
    }
  }, [showModal, revokeSavedAttachmentUrls]);

  useEffect(() => () => {
    revokeSavedAttachmentUrls();
  }, [revokeSavedAttachmentUrls]);

  const [tagFilters, setTagFilters] = useState<{ included: string[], excluded: string[] }>({ included: [], excluded: [] });
  const [sortConfig, setSortConfig] = useState<{ key: string | null, direction: 'asc' | 'desc' | null }>({ key: null, direction: null });

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    dueDate: '',
    paymentDate: '',
    status: 'PENDING',
    type: 'INCOME',
    category: '',
    categoryId: '',
    paymentMethod: '',
    bankAccountId: '',
    notes: '',
    // Encargos
    fine: '',
    interest: '',
    monetaryCorrection: '',
    discount: '',
    discountType: 'VALUE' as 'VALUE' | 'PERCENTAGE',
    // Parcelamento
    totalInstallments: '1',
    periodicity: 'Mensal',
    paymentConditionId: '',
    origin: 'MANUAL',
    // Seções colapsáveis
    showCharges: false,
    parties: [] as { contactId: string; role: string; amount?: number }[],
    splits: [] as { contactId: string; role: string; amount: number; percentage?: number; description?: string }[],
  });

  const [installmentData, setInstallmentData] = useState({
    totalAmount: '',
    numInstallments: '2',
    periodicity: 'Mensal',
    type: 'INCOME' as 'INCOME' | 'EXPENSE',
    description: '',
    firstDueDate: new Date().toISOString().split('T')[0],
    category: '',
    categoryId: '',
    bankAccountId: '',
    paymentMethod: '',
    notes: '',
  });

  const [settleData, setSettleData] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    fine: '',
    finePercent: '',
    interest: '',
    interestPercent: '',
    monetaryCorrection: '',
    monetaryCorrectionPercent: '',
    discount: '',
    discountPercent: '',
    discountType: 'VALUE' as 'VALUE' | 'PERCENTAGE',
    paymentMethod: '',
    bankAccountId: '',
    notes: '',
  });

  const [settleFinalOverride, setSettleFinalOverride] = useState<string>('');
  const [settleAttachments, setSettleAttachments] = useState<File[]>([]);
  const [settlePastedImages, setSettlePastedImages] = useState<{ name: string; url: string }[]>([]);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [showCategoryInput, setShowCategoryInput] = useState(false);

  const [bankFormData, setBankFormData] = useState({
    title: '',
    bankName: '',
    accountType: 'CHECKING',
    accountNumber: '',
    agency: '',
    balance: '',
    contactId: '',
    notes: '',
  });

  const [newSplit, setNewSplit] = useState({
    contactId: '',
    role: 'CREDITOR' as 'CREDITOR' | 'DEBTOR',
    amount: '',
    percentage: '',
    description: '',
  });

  const handleAddSplit = () => {
    if (!newSplit.contactId) { toast.error('Selecione um contato'); return; }
    if (!newSplit.amount || parseFloat(newSplit.amount) <= 0) { toast.error('Informe o valor do rateio'); return; }
    setFormData({
      ...formData,
      splits: [...formData.splits, {
        contactId: newSplit.contactId,
        role: newSplit.role,
        amount: parseFloat(newSplit.amount),
        percentage: newSplit.percentage ? parseFloat(newSplit.percentage) : undefined,
        description: newSplit.description || undefined,
      }],
    });
    setNewSplit({ contactId: '', role: 'CREDITOR', amount: '', percentage: '', description: '' });
  };

  const handleRemoveSplit = (index: number) => {
    const s = [...formData.splits];
    s.splice(index, 1);
    setFormData({ ...formData, splits: s });
  };

  const splitsTotal = formData.splits.reduce((sum, s) => sum + s.amount, 0);

  const calculatePreviewFinal = () => {
    let total = parseFloat(formData.amount) || 0;
    if (formData.fine) total += parseFloat(formData.fine) || 0;
    if (formData.interest) total += parseFloat(formData.interest) || 0;
    if (formData.monetaryCorrection) total += parseFloat(formData.monetaryCorrection) || 0;
    if (formData.discount) {
      const d = parseFloat(formData.discount) || 0;
      if (formData.discountType === 'PERCENTAGE') total -= total * (d / 100);
      else total -= d;
    }
    return Math.max(0, Math.round(total * 100) / 100);
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const res = await api.post('/financial/categories', { name: newCategoryName.trim(), type: formData.type === 'INCOME' ? 'INCOME' : 'EXPENSE' });
      setCategories(prev => [...prev, res.data]);
      setFormData({ ...formData, categoryId: res.data.id, category: res.data.name });
      setNewCategoryName('');
      setShowCategoryInput(false);
      toast.success('Categoria criada');
    } catch { toast.error('Erro ao criar categoria'); }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/financial/categories');
      setCategories(res.data);
    } catch (e) { console.error('Erro ao carregar categorias:', e); }
  };

  const fetchPaymentConditions = async () => {
    try {
      const res = await api.get('/payment-conditions');
      setPaymentConditions(res.data);
    } catch (e) { console.error('Erro ao carregar condições de pagamento:', e); }
  };

  const generateInstallments = (conditionId: string, totalAmount: number, firstDueDate: string) => {
    const condition = paymentConditions.find(c => c.id === conditionId);
    if (!condition || !totalAmount || !firstDueDate) {
      setInstallments([]);
      return;
    }

    const insts: { dueDate: string; amount: number; installmentNumber: number }[] = [];
    const baseDate = new Date(firstDueDate);
    
    condition.installments.forEach((inst: any, idx: number) => {
      const dueDate = new Date(baseDate);
      dueDate.setDate(dueDate.getDate() + (inst.days || 0));
      
      insts.push({
        dueDate: dueDate.toISOString().split('T')[0],
        amount: Math.round((totalAmount * (inst.percentage / 100)) * 100) / 100,
        installmentNumber: inst.installmentNumber || (idx + 1),
      });
    });

    setInstallments(insts);
  };

  useEffect(() => {
    if (formData.paymentConditionId && formData.amount && formData.dueDate) {
      generateInstallments(formData.paymentConditionId, parseFloat(formData.amount), formData.dueDate);
    } else {
      setInstallments([]);
    }
  }, [formData.paymentConditionId, formData.amount, formData.dueDate, paymentConditions]);

  // === Nx Shortcut: digitar "3x" gera 3 parcelas iguais mensais ===
  const handleNxInput = (value: string) => {
    setNxInput(value);
    const match = value.match(/^(\d+)\s*[xX]$/);
    if (match && formData.amount && formData.dueDate) {
      const n = parseInt(match[1]);
      if (n >= 2 && n <= 120) {
        const totalAmount = parseFloat(formData.amount);
        const instAmount = Math.floor((totalAmount / n) * 100) / 100;
        const remainder = Math.round((totalAmount - instAmount * n) * 100) / 100;
        const baseDate = new Date(formData.dueDate);
        const insts: { dueDate: string; amount: number; installmentNumber: number }[] = [];
        for (let i = 0; i < n; i++) {
          const d = new Date(baseDate);
          d.setMonth(d.getMonth() + i);
          insts.push({
            dueDate: d.toISOString().split('T')[0],
            amount: i === n - 1 ? instAmount + remainder : instAmount,
            installmentNumber: i + 1,
          });
        }
        setInstallments(insts);
        setFormData(prev => ({ ...prev, paymentConditionId: '', totalInstallments: n.toString() }));
      }
    } else if (!value) {
      if (!formData.paymentConditionId) {
        setInstallments([]);
      }
    }
  };

  // === Paste de imagens no campo de observações ===
  const handleNotesPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          const url = URL.createObjectURL(file);
          setPastedImages(prev => [...prev, { url, file }]);
          toast.success('Imagem colada com sucesso!');
        }
        break;
      }
    }
  };

  const toggleRowExpand = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
      return newSet;
    });
  };

  // === HELPERS DE LIQUIDAÇÃO ===

  const calcSettleDaysLate = useMemo(() => {
    if (!settlingRecord || !settleData.paymentDate) return 0;
    const due = new Date(settlingRecord.dueDate);
    const pay = new Date(settleData.paymentDate);
    due.setHours(0, 0, 0, 0);
    pay.setHours(0, 0, 0, 0);
    return Math.floor((pay.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  }, [settlingRecord, settleData.paymentDate]);

  const calcSettleFinalAmount = useMemo(() => {
    // Se o operador sobrescreveu o valor, usar o override
    if (settleFinalOverride !== '') {
      return parseFloat(settleFinalOverride) || 0;
    }
    if (!settlingRecord) return 0;
    let total = Number(settlingRecord.amount);
    const fineVal = parseFloat(settleData.fine) || 0;
    const interestVal = parseFloat(settleData.interest) || 0;
    const corrVal = parseFloat(settleData.monetaryCorrection) || 0;
    total += fineVal + interestVal + corrVal;
    const discountVal = parseFloat(settleData.discount) || 0;
    if (discountVal > 0) {
      total -= discountVal;
    }
    return Math.max(0, Math.round(total * 100) / 100);
  }, [settlingRecord, settleData, settleFinalOverride]);

  const handleSettlePercentChange = (field: 'finePercent' | 'interestPercent' | 'monetaryCorrectionPercent' | 'discountPercent', value: string) => {
    if (!settlingRecord) return;
    const pct = parseFloat(value) || 0;
    const base = Number(settlingRecord.amount);
    const calcVal = Math.round(base * (pct / 100) * 100) / 100;
    const valueField = field.replace('Percent', '') as 'fine' | 'interest' | 'monetaryCorrection' | 'discount';
    setSettleFinalOverride(''); // Limpar override ao mudar encargos
    setSettleData({ ...settleData, [field]: value, [valueField]: calcVal > 0 ? calcVal.toString() : '' });
  };

  const handleSettleValueChange = (field: 'fine' | 'interest' | 'monetaryCorrection' | 'discount', value: string) => {
    if (!settlingRecord) return;
    const val = parseFloat(value) || 0;
    const base = Number(settlingRecord.amount);
    const pct = base > 0 ? Math.round((val / base) * 10000) / 100 : 0;
    const pctField = `${field}Percent` as 'finePercent' | 'interestPercent' | 'monetaryCorrectionPercent' | 'discountPercent';
    setSettleFinalOverride(''); // Limpar override ao mudar encargos
    setSettleData({ ...settleData, [field]: value, [pctField]: pct > 0 ? pct.toString() : '' });
  };

  const handleSettleFinalOverride = (value: string) => {
    setSettleFinalOverride(value);
  };

  const handleSettlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const url = URL.createObjectURL(file);
          const name = `imagem_colada_${settlePastedImages.length + 1}.png`;
          setSettlePastedImages(prev => [...prev, { name, url }]);
          // Também adicionar como anexo
          setSettleAttachments(prev => [...prev, new File([file], name, { type: file.type })]);
          toast.success('Imagem colada com sucesso!');
        }
      }
    }
  };

  const handleSettleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles = Array.from(files);
    setSettleAttachments(prev => [...prev, ...newFiles]);
    toast.success(`${newFiles.length} arquivo(s) anexado(s)`);
    e.target.value = ''; // Reset input
  };

  const removeSettleAttachment = (index: number) => {
    setSettleAttachments(prev => prev.filter((_, i) => i !== index));
    // Remover imagem colada correspondente se houver
    const file = settleAttachments[index];
    if (file) {
      setSettlePastedImages(prev => prev.filter(img => img.name !== file.name));
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isSettleFormValid = useMemo(() => {
    return (
      settleData.paymentDate !== '' &&
      settleData.paymentMethod !== '' &&
      settleData.bankAccountId !== '' &&
      calcSettleFinalAmount > 0
    );
  }, [settleData, calcSettleFinalAmount]);

  const handleOpenSettleModal = async (record: FinancialRecord) => {
    await fetchContacts();
    setSettlingRecord(record);

    const today = new Date().toISOString().split('T')[0];
    const due = new Date(record.dueDate);
    const todayDate = new Date(today);
    due.setHours(0, 0, 0, 0);
    todayDate.setHours(0, 0, 0, 0);
    const daysLate = Math.floor((todayDate.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));

    // Auto-aplicar multa 2% e juros 1%/mês se atrasado (pode ser editado)
    let autoFine = '';
    let autoFinePercent = '';
    let autoInterest = '';
    let autoInterestPercent = '';
    if (daysLate > 0) {
      const fineP = 2; // Multa padrão 2%
      autoFinePercent = fineP.toString();
      autoFine = (Number(record.amount) * fineP / 100).toFixed(2);
      const months = Math.max(1, Math.ceil(daysLate / 30));
      const interestP = months; // 1% ao mês
      autoInterestPercent = interestP.toString();
      autoInterest = (Number(record.amount) * interestP / 100).toFixed(2);
    }

    setSettleFinalOverride('');
    setSettleAttachments([]);
    setSettlePastedImages([]);
    setSettleData({
      paymentDate: today,
      fine: autoFine,
      finePercent: autoFinePercent,
      interest: autoInterest,
      interestPercent: autoInterestPercent,
      monetaryCorrection: '',
      monetaryCorrectionPercent: '',
      discount: '',
      discountPercent: '',
      discountType: 'VALUE',
      paymentMethod: record.paymentMethod || '',
      bankAccountId: record.bankAccount?.id || '',
      notes: '',
    });
    setShowSettleModal(true);
  };

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingRecord) return;

    // Validações obrigatórias com feedback
    if (!settleData.paymentDate) {
      toast.error('Data de Pagamento é obrigatória');
      return;
    }
    if (!settleData.paymentMethod) {
      toast.error('Forma de Pagamento é obrigatória');
      return;
    }
    if (!settleData.bankAccountId) {
      toast.error('Conta Bancária é obrigatória');
      return;
    }
    if (calcSettleFinalAmount <= 0) {
      toast.error('Valor Total deve ser maior que zero');
      return;
    }

    setSubmitting(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const tenantId = user.tenantId || 'default-tenant-id';

      const payload: any = {
        tenantId,
        paymentDate: settleData.paymentDate,
        amountFinal: calcSettleFinalAmount,
      };
      if (settleData.fine) payload.fine = parseFloat(settleData.fine);
      if (settleData.interest) payload.interest = parseFloat(settleData.interest);
      if (settleData.monetaryCorrection) payload.monetaryCorrection = parseFloat(settleData.monetaryCorrection);
      if (settleData.discount) {
        payload.discount = parseFloat(settleData.discount);
        payload.discountType = settleData.discountType;
      }
      payload.paymentMethod = settleData.paymentMethod;
      payload.bankAccountId = settleData.bankAccountId;
      if (settleData.notes) payload.notes = settleData.notes;

      // Se há anexos, enviar como FormData
      if (settleAttachments.length > 0) {
        const formData = new FormData();
        Object.keys(payload).forEach(key => {
          formData.append(key, String(payload[key]));
        });
        settleAttachments.forEach(file => {
          formData.append('attachments', file);
        });
        await api.post(`/financial/records/${settlingRecord.id}/settle`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await api.post(`/financial/records/${settlingRecord.id}/settle`, payload);
      }

      toast.success('Registro liquidado com sucesso!');
      setShowSettleModal(false);
      // Limpar URLs de imagens coladas
      settlePastedImages.forEach(img => URL.revokeObjectURL(img.url));
      await fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao liquidar');
    } finally { setSubmitting(false); }
  };

  const handleOpenInstallmentModal = async () => {
    await fetchContacts();
    await fetchCategories();
    setInstallmentData({
      totalAmount: '', numInstallments: '2', periodicity: 'Mensal', type: 'INCOME',
      description: '', firstDueDate: new Date().toISOString().split('T')[0],
      category: '', categoryId: '', bankAccountId: '', paymentMethod: '', notes: '',
    });
    setShowInstallmentModal(true);
  };

  const handleInstallmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const total = parseFloat(installmentData.totalAmount);
    if (isNaN(total) || total <= 0) { toast.error('Valor total inválido'); return; }
    const num = parseInt(installmentData.numInstallments);
    if (isNaN(num) || num < 2) { toast.error('Mínimo 2 parcelas'); return; }
    setSubmitting(true);
    try {
      await api.post('/financial/installments', {
        totalAmount: total,
        numInstallments: num,
        periodicity: installmentData.periodicity,
        type: installmentData.type,
        description: installmentData.description,
        firstDueDate: installmentData.firstDueDate,
        category: installmentData.category || undefined,
        categoryId: installmentData.categoryId || undefined,
        bankAccountId: installmentData.bankAccountId || undefined,
        paymentMethod: installmentData.paymentMethod || undefined,
        notes: installmentData.notes || undefined,
      });
      toast.success(`Parcelamento criado: ${num}x de R$ ${(total / num).toFixed(2)}`);
      setShowInstallmentModal(false);
      await fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao parcelar');
    } finally { setSubmitting(false); }
  };

  useEffect(() => {
    fetchData();
    fetchCategories();
  }, [view, filters]);

  const fetchData = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const tenantId = user.tenantId || 'default-tenant-id';

      if (view === 'dashboard' || view === 'records') {
        const [dashboardRes, recordsRes, accountsRes] = await Promise.all([
          api.get(`/financial/dashboard?tenantId=${tenantId}`),
          api.get(`/financial/records?tenantId=${tenantId}&type=${filters.type}&status=${filters.status}&category=${filters.category}`),
          api.get(`/financial/bank-accounts?tenantId=${tenantId}`),
        ]);
        setDashboard(dashboardRes.data);
        setRecords(recordsRes.data);
        setBankAccounts(accountsRes.data);
      } else if (view === 'accounts') {
        const accountsRes = await api.get(`/financial/bank-accounts?tenantId=${tenantId}`);
        setBankAccounts(accountsRes.data);
      }
    } catch (error) {
      toast.error('Erro ao carregar dados financeiros');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async () => {
    setLoadingContacts(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const tenantId = user.tenantId || 'default-tenant-id';
      const response = await api.get(`/financial/contacts?tenantId=${tenantId}`);
      setContacts(response.data);
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleOpenModal = async (record?: FinancialRecord) => {
    setModalTab('dados');
    await fetchContacts();
    await fetchCategories();

    if (record) {
      setEditingRecord(record);
      setFormData({
        description: record.description,
        amount: record.amount.toString(),
        dueDate: record.dueDate.split('T')[0],
        paymentDate: record.paymentDate ? record.paymentDate.split('T')[0] : '',
        status: record.status,
        type: record.type,
        category: record.category || '',
        categoryId: record.categoryId || '',
        paymentMethod: record.paymentMethod || '',
        bankAccountId: record.bankAccount?.id || '',
        notes: record.notes || '',
        fine: record.fine ? record.fine.toString() : '',
        interest: record.interest ? record.interest.toString() : '',
        monetaryCorrection: record.monetaryCorrection ? record.monetaryCorrection.toString() : '',
        discount: record.discount ? record.discount.toString() : '',
        discountType: (record.discountType as 'VALUE' | 'PERCENTAGE') || 'VALUE',
        totalInstallments: record.totalInstallments ? record.totalInstallments.toString() : '1',
        periodicity: record.periodicity || 'Mensal',
        paymentConditionId: '',
        origin: (record as any).origin || 'MANUAL',
        showCharges: !!(record.fine || record.interest || record.monetaryCorrection || record.discount),
        parties: record.parties?.map(p => ({
          contactId: p.contactId,
          role: p.role,
          amount: p.amount ? Number(p.amount) : undefined
        })) || [],
        splits: record.splits?.map(s => ({
          contactId: s.contactId,
          role: s.role,
          amount: Number(s.amount),
          percentage: s.percentage ? Number(s.percentage) : undefined,
          description: s.description,
        })) || [],
      });
      setInstallments([]);
      setNxInput('');
      await preloadSavedAttachments(record);
    } else {
      setEditingRecord(null);
      setFormData({
        description: '',
        amount: '',
        dueDate: new Date().toISOString().split('T')[0],
        paymentDate: '',
        status: 'PENDING',
        type: 'INCOME',
        category: '',
        categoryId: '',
        paymentMethod: '',
        bankAccountId: '',
        notes: '',
        fine: '',
        interest: '',
        monetaryCorrection: '',
        discount: '',
        discountType: 'VALUE',
        totalInstallments: '1',
        periodicity: 'Mensal',
        paymentConditionId: '',
        origin: 'MANUAL',
        showCharges: false,
        parties: [],
        splits: [],
      });
      setInstallments([]);
      setNxInput('');
      revokeSavedAttachmentUrls();
    }
    setPastedImages([]);
    setAttachments([]);
    setShowModal(true);
    fetchPaymentConditions();
    setTimeout(() => {
      amountInputRef.current?.focus();
    }, 100);
  };

  const handleOpenBankModal = async (account?: BankAccount) => {
    // Carregar contatos antes de abrir o modal
    await fetchContacts();
    
    if (account) {
      setEditingBank(account);
      setBankFormData({
        title: account.title,
        bankName: account.bankName,
        accountType: account.accountType,
        accountNumber: account.accountNumber || '',
        agency: account.agency || '',
        balance: account.balance.toString(),
        contactId: account.contact?.id || '',
        notes: '',
      });
    } else {
      setEditingBank(null);
      setBankFormData({
        title: '',
        bankName: '',
        accountType: 'CHECKING',
        accountNumber: '',
        agency: '',
        balance: '0',
        contactId: '',
        notes: '',
      });
    }
    setShowBankModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações
    if (!formData.description.trim()) {
      toast.error('Preencha a descrição');
      return;
    }

    if (formData.description.trim().length < 3) {
      toast.error('Descrição deve ter pelo menos 3 caracteres');
      return;
    }

    // Validação do amount
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Valor inválido. Digite um valor maior que zero');
      return;
    }

    if (!formData.dueDate) {
      toast.error('Preencha a data de vencimento');
      return;
    }

    if (installments.length > 0) {
      const sum = Math.round(installments.reduce((acc, inst) => acc + inst.amount, 0) * 100) / 100;
      const totalAmount = Math.round(amount * 100) / 100;
      if (Math.abs(sum - totalAmount) > 0.01) {
        toast.error(`A soma das parcelas (${formatCurrency(sum)}) deve ser igual ao valor total (${formatCurrency(amount)})`);
        return;
      }
    }

    /* Removido obrigatoriedade conforme pedido do usuário
    if (!formData.bankAccountId) {
      toast.error('Selecione uma conta bancária');
      return;
    }
    */

    setSubmitting(true);

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const tenantId = user.tenantId || 'default-tenant-id';

      const payload: any = {
        description: formData.description.trim(),
        amount: amount,
        dueDate: formData.dueDate,
        paymentDate: formData.paymentDate || undefined,
        status: formData.status,
        type: formData.type,
        category: formData.category.trim() || undefined,
        categoryId: formData.categoryId || undefined,
        paymentMethod: formData.paymentMethod || undefined,
        bankAccountId: formData.bankAccountId || undefined,
        notes: formData.notes.trim() || undefined,
        parties: !editingRecord && formData.parties.length > 0 ? formData.parties : undefined,
        splits: formData.splits.length > 0 ? formData.splits : undefined,
        totalInstallments: installments.length > 0 ? installments.length : (parseInt(formData.totalInstallments) || 1),
        installments: installments.length > 0 ? installments : undefined,
        paymentConditionId: formData.paymentConditionId || undefined,
        periodicity: formData.periodicity,
        origin: formData.origin || 'MANUAL',
        tenantId,
      };

      // Encargos
      if (formData.fine) payload.fine = parseFloat(formData.fine);
      if (formData.interest) payload.interest = parseFloat(formData.interest);
      if (formData.monetaryCorrection) payload.monetaryCorrection = parseFloat(formData.monetaryCorrection);
      if (formData.discount) {
        payload.discount = parseFloat(formData.discount);
        payload.discountType = formData.discountType;
      }

      let createdOrUpdatedRecordId = editingRecord?.id;

      if (editingRecord) {
        await api.put(`/financial/records/${editingRecord.id}?tenantId=${tenantId}`, payload);
        toast.success('Registro atualizado com sucesso');
      } else {
        const response = await api.post('/financial/records', payload);
        createdOrUpdatedRecordId = response.data.id;
        toast.success('Registro criado com sucesso');
      }

      // Se houver anexos novos listados no frontend ('attachments' state array)
      if (attachments.length > 0 && createdOrUpdatedRecordId) {
        const attachFormData = new FormData();
        attachments.forEach(file => attachFormData.append('attachments', file));
        await api.post(`/financial/records/${createdOrUpdatedRecordId}/attachments`, attachFormData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      // limpar state de anexos novos
      setAttachments([]);

      setShowModal(false);
      await fetchData();
    } catch (error: any) {
      console.error('Erro completo:', error);
      const backendMessage = error.response?.data?.message;
      const errorMessage = Array.isArray(backendMessage)
                            ? backendMessage.join(', ')
                            : (typeof backendMessage === 'string' ? backendMessage : 'Erro ao salvar registro');
      
      toast.error(errorMessage, {
        description: error.response?.data?.error || 'Verifique os dados informados'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validação do título
    if (!bankFormData.title.trim()) {
      toast.error('Preencha o título da conta');
      return;
    }

    if (bankFormData.title.trim().length < 3) {
      toast.error('Título deve ter pelo menos 3 caracteres');
      return;
    }

    // Validação do nome do banco
    if (!bankFormData.bankName.trim()) {
      toast.error('Preencha o nome do banco');
      return;
    }

    if (bankFormData.bankName.trim().length < 3) {
      toast.error('Nome do banco deve ter pelo menos 3 caracteres');
      return;
    }

    // Validação e conversão do balance
    const balanceStr = bankFormData.balance.trim();
    const balance = balanceStr === '' ? 0 : parseFloat(balanceStr);
    
    if (isNaN(balance)) {
      toast.error('Saldo inválido. Digite um número válido');
      return;
    }

    if (balance < 0) {
      toast.error('Saldo não pode ser negativo');
      return;
    }

    setSubmitting(true);

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const tenantId = user.tenantId || 'default-tenant-id';

      const payload = {
        title: bankFormData.title.trim(),
        bankName: bankFormData.bankName.trim(),
        accountType: bankFormData.accountType,
        accountNumber: bankFormData.accountNumber.trim() || undefined,
        agency: bankFormData.agency.trim() || undefined,
        balance: balance,
        contactId: bankFormData.contactId || undefined,
        notes: bankFormData.notes.trim() || undefined,
        tenantId,
      };

      if (editingBank) {
        await api.put(`/financial/bank-accounts/${editingBank.id}?tenantId=${tenantId}`, payload);
        toast.success('Conta atualizada com sucesso');
      } else {
        await api.post('/financial/bank-accounts', payload);
        toast.success('Conta criada com sucesso');
      }

      setShowBankModal(false);
      await fetchData();
    } catch (error: any) {
      // Melhor tratamento de erros com mensagem específica do backend
      const errorMessage = error.response?.data?.message || 
                          (Array.isArray(error.response?.data?.message) 
                            ? error.response.data.message.join(', ')
                            : 'Erro ao salvar conta bancária');
      toast.error(errorMessage);
      console.error('Erro completo:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este registro?')) return;

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const tenantId = user.tenantId || 'default-tenant-id';
      await api.delete(`/financial/records/${id}?tenantId=${tenantId}`);
      toast.success('Registro excluído com sucesso');
      fetchData();
    } catch (error) {
      toast.error('Erro ao excluir registro');
      console.error(error);
    }
  };

  const handleDeleteBank = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta conta bancária?')) return;

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const tenantId = user.tenantId || 'default-tenant-id';
      await api.delete(`/financial/bank-accounts/${id}?tenantId=${tenantId}`);
      toast.success('Conta excluída com sucesso');
      fetchData();
    } catch (error) {
      toast.error('Erro ao excluir conta');
      console.error(error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      PENDING: { label: 'Pendente', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
      PAID: { label: 'Pago', className: 'bg-green-500/10 text-green-400 border-green-500/20' },
      PARTIAL: { label: 'Parcial', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
      CANCELLED: { label: 'Cancelado', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
      OVERDUE: { label: 'Vencido', className: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
    };
    const statusInfo = statusMap[status] || { label: status, className: 'bg-gray-500/10 text-gray-400 border-gray-500/20' };
    return (
      <span className={`px-2 py-1 rounded-md text-xs font-medium border ${statusInfo.className}`}>
        {statusInfo.label}
      </span>
    );
  };

  const getTypeBadge = (type: string) => {
    return type === 'INCOME' ? (
      <span className="px-2 py-1 rounded-md text-xs font-medium border bg-green-500/10 text-green-400 border-green-500/20">
        Receita
      </span>
    ) : (
      <span className="px-2 py-1 rounded-md text-xs font-medium border bg-red-500/10 text-red-400 border-red-500/20">
        Despesa
      </span>
    );
  };

  const filteredRecords = records.filter((record) => {
    let matches = record.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filtro via cards
    if (activeCardFilter === 'INCOME_ALL') {
      if (record.type !== 'INCOME') matches = false;
    } else if (activeCardFilter === 'INCOME_PENDING') {
      if (record.type !== 'INCOME' || record.status !== 'PENDING') matches = false;
    } else if (activeCardFilter === 'INCOME_OVERDUE') {
      if (record.type !== 'INCOME' || record.status !== 'OVERDUE') matches = false;
    } else if (activeCardFilter === 'EXPENSE_ALL') {
      if (record.type !== 'EXPENSE') matches = false;
    } else if (activeCardFilter === 'EXPENSE_PENDING') {
      if (record.type !== 'EXPENSE' || record.status !== 'PENDING') matches = false;
    } else if (activeCardFilter === 'EXPENSE_OVERDUE') {
       if (record.type !== 'EXPENSE' || record.status !== 'OVERDUE') matches = false;
    }

    // Filtros manuais (selects) - se o usuário mudar o select, ele sobrescreve o card? 
    // Vamos fazer os selects serem filtros adicionais.
    if (filters.type && record.type !== filters.type) matches = false;
    if (filters.status && record.status !== filters.status) matches = false;
    if (filters.category) {
      const catId = record.financialCategory?.id || record.categoryId;
      if (catId !== filters.category) matches = false;
    }

    if (matches && tagFilters.included.length > 0) {
      const recordTagIds = record.tags?.map(t => t.tag.id) || [];
      const hasAllIncluded = tagFilters.included.every(id => recordTagIds.includes(id));
      if (!hasAllIncluded) matches = false;
    }

    if (matches && tagFilters.excluded.length > 0) {
      const recordTagIds = record.tags?.map(t => t.tag.id) || [];
      const hasAnyExcluded = tagFilters.excluded.some(id => recordTagIds.includes(id));
      if (hasAnyExcluded) matches = false;
    }

    return matches;
  });

  const sortedRecords = useMemo(() => {
    let sortableItems = [...filteredRecords];
    if (sortConfig.key && sortConfig.direction) {
      sortableItems.sort((a, b) => {
        const key = sortConfig.key as keyof FinancialRecord;
        let aValue: any = a[key] ?? '';
        let bValue: any = b[key] ?? '';
        
        if (key === 'amount' || key === 'amountFinal') {
          aValue = Number(aValue);
          bValue = Number(bValue);
        }
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredRecords, sortConfig]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <DollarSign className="text-indigo-400" size={32} />
            Módulo Financeiro
          </h1>
          <p className="text-slate-400 mt-1">
            Gestão completa de receitas, despesas e contas bancárias
          </p>
        </div>
        <div className="flex gap-2">
          {view === 'records' && (
            <>
              <button
                onClick={() => handleOpenInstallmentModal()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
              >
                <Repeat size={20} />
                Parcelar
              </button>
              <button
                onClick={() => handleOpenModal()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
              >
                <Plus size={20} />
                Nova Transação
              </button>
            </>
          )}
          {view === 'accounts' && (
            <button
              onClick={() => handleOpenBankModal()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <Plus size={20} />
              Nova Conta
            </button>
          )}
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 border-b border-slate-700">
        <button
          onClick={() => setView('dashboard')}
          className={`px-4 py-2 font-medium transition-colors ${
            view === 'dashboard'
              ? 'text-indigo-400 border-b-2 border-indigo-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setView('records')}
          className={`px-4 py-2 font-medium transition-colors ${
            view === 'records'
              ? 'text-indigo-400 border-b-2 border-indigo-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Transações
        </button>
        <button
          onClick={() => setView('accounts')}
          className={`px-4 py-2 font-medium transition-colors ${
            view === 'accounts'
              ? 'text-indigo-400 border-b-2 border-indigo-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Contas Bancárias
        </button>
        <button
          onClick={() => setView('conditions')}
          className={`px-4 py-2 font-medium transition-colors ${
            view === 'conditions'
              ? 'text-indigo-400 border-b-2 border-indigo-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Cond. Pagamento
        </button>
      </div>

      {/* Dashboard View */}
      {view === 'dashboard' && dashboard && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">Receitas</span>
                <TrendingUp className="text-green-400" size={20} />
              </div>
              <p className="text-2xl font-bold text-white">{formatCurrency(dashboard.summary.totalIncome)}</p>
              <p className="text-xs text-slate-500 mt-1">
                Pendente: {formatCurrency(dashboard.summary.pendingIncome)}
              </p>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">Despesas</span>
                <TrendingDown className="text-red-400" size={20} />
              </div>
              <p className="text-2xl font-bold text-white">{formatCurrency(dashboard.summary.totalExpense)}</p>
              <p className="text-xs text-slate-500 mt-1">
                Pendente: {formatCurrency(dashboard.summary.pendingExpense)}
              </p>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">Saldo</span>
                <DollarSign className="text-indigo-400" size={20} />
              </div>
              <p className={`text-2xl font-bold ${dashboard.summary.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(dashboard.summary.balance)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Saldo em contas: {formatCurrency(dashboard.summary.totalBalance)}
              </p>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">Vencidos</span>
                <Calendar className="text-orange-400" size={20} />
              </div>
              <p className="text-2xl font-bold text-white">{dashboard.summary.overdueCount}</p>
              <p className="text-xs text-slate-500 mt-1">Registros em atraso</p>
            </div>
          </div>

          {/* Recent Records */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Transações Recentes</h3>
            <div className="space-y-3">
              {dashboard.recentRecords.slice(0, 5).map((record) => (
                <div key={record.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                  <div className="flex-1">
                    <p className="text-white font-medium">{record.description}</p>
                    <p className="text-sm text-slate-400">{formatDate(record.dueDate)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {getTypeBadge(record.type)}
                    {getStatusBadge(record.status)}
                    <p className={`text-lg font-bold ${record.type === 'INCOME' ? 'text-green-400' : 'text-red-400'}`}>
                      {record.type === 'INCOME' ? '+' : '-'}{formatCurrency(record.amount)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Records View */}
      {view === 'records' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Buscar transações..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Todos os tipos</option>
              <option value="INCOME">Receitas</option>
              <option value="EXPENSE">Despesas</option>
            </select>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Todos os status</option>
              <option value="PENDING">Pendente</option>
              <option value="PAID">Pago</option>
              <option value="PARTIAL">Parcial</option>
              <option value="CANCELLED">Cancelado</option>
              <option value="OVERDUE">Vencido</option>
            </select>
          </div>

          {/* New Card Filters */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <button
              onClick={() => {
                setActiveCardFilter('INCOME_ALL');
                setFilters({ ...filters, type: 'INCOME', status: '' });
              }}
              className={`p-4 rounded-xl border transition-all duration-300 text-left relative overflow-hidden group ${
                activeCardFilter === 'INCOME_ALL' ? 'bg-green-500/10 border-green-500/50 shadow-lg' : 'bg-slate-900 border-slate-800 hover:bg-slate-800'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 rounded-lg bg-green-500/20 text-green-400">
                  <TrendingUp size={20} />
                </div>
                <div className="text-2xl font-bold text-white">
                  {dashboard?.summary.totalIncome ? formatCurrency(dashboard.summary.totalIncome) : 'R$ 0,00'}
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Receitas (Tudo)</span>
              {activeCardFilter === 'INCOME_ALL' && <div className="absolute bottom-0 left-0 h-1 bg-green-500 w-full" />}
            </button>

            <button
              onClick={() => {
                setActiveCardFilter('INCOME_PENDING');
                setFilters({ ...filters, type: 'INCOME', status: 'PENDING' });
              }}
              className={`p-4 rounded-xl border transition-all duration-300 text-left relative overflow-hidden group ${
                activeCardFilter === 'INCOME_PENDING' ? 'bg-blue-500/10 border-blue-500/50 shadow-lg' : 'bg-slate-900 border-slate-800 hover:bg-slate-800'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                  <Clock size={20} />
                </div>
                <div className="text-2xl font-bold text-white">
                  {dashboard?.summary.pendingIncome ? formatCurrency(dashboard.summary.pendingIncome) : 'R$ 0,00'}
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Receitas Abertas</span>
              {activeCardFilter === 'INCOME_PENDING' && <div className="absolute bottom-0 left-0 h-1 bg-blue-500 w-full" />}
            </button>

            <button
              onClick={() => {
                setActiveCardFilter('INCOME_OVERDUE');
                setFilters({ ...filters, type: 'INCOME', status: 'OVERDUE' });
              }}
              className={`p-4 rounded-xl border transition-all duration-300 text-left relative overflow-hidden group ${
                activeCardFilter === 'INCOME_OVERDUE' ? 'bg-orange-500/10 border-orange-500/50 shadow-lg' : 'bg-slate-900 border-slate-800 hover:bg-slate-800'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 rounded-lg bg-orange-500/20 text-orange-400">
                  <AlertTriangle size={20} />
                </div>
                <div className="text-2xl font-bold text-white">
                  {/* Simplificação: dashboard.summary não separa atraso por tipo, mas vamos estimar ou usar o count */}
                  {dashboard?.summary.overdueCount || 0} items
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Receitas em Atraso</span>
              {activeCardFilter === 'INCOME_OVERDUE' && <div className="absolute bottom-0 left-0 h-1 bg-orange-500 w-full" />}
            </button>

            <button
              onClick={() => {
                setActiveCardFilter('EXPENSE_ALL');
                setFilters({ ...filters, type: 'EXPENSE', status: '' });
              }}
              className={`p-4 rounded-xl border transition-all duration-300 text-left relative overflow-hidden group ${
                activeCardFilter === 'EXPENSE_ALL' ? 'bg-red-500/10 border-red-500/50 shadow-lg' : 'bg-slate-900 border-slate-800 hover:bg-slate-800'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 rounded-lg bg-red-500/20 text-red-400">
                  <TrendingDown size={20} />
                </div>
                <div className="text-2xl font-bold text-white">
                  {dashboard?.summary.totalExpense ? formatCurrency(dashboard.summary.totalExpense) : 'R$ 0,00'}
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Despesas (Tudo)</span>
              {activeCardFilter === 'EXPENSE_ALL' && <div className="absolute bottom-0 left-0 h-1 bg-red-500 w-full" />}
            </button>

            <button
              onClick={() => {
                setActiveCardFilter('EXPENSE_PENDING');
                setFilters({ ...filters, type: 'EXPENSE', status: 'PENDING' });
              }}
              className={`p-4 rounded-xl border transition-all duration-300 text-left relative overflow-hidden group ${
                activeCardFilter === 'EXPENSE_PENDING' ? 'bg-purple-500/10 border-purple-500/50 shadow-lg' : 'bg-slate-900 border-slate-800 hover:bg-slate-800'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                  <Clock size={20} />
                </div>
                <div className="text-2xl font-bold text-white">
                  {dashboard?.summary.pendingExpense ? formatCurrency(dashboard.summary.pendingExpense) : 'R$ 0,00'}
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Despesas Abertas</span>
              {activeCardFilter === 'EXPENSE_PENDING' && <div className="absolute bottom-0 left-0 h-1 bg-purple-500 w-full" />}
            </button>

            <button
              onClick={() => {
                setActiveCardFilter('ALL');
                setFilters({ type: '', status: '', category: '' });
              }}
              className={`p-4 rounded-xl border transition-all duration-300 text-left relative overflow-hidden group ${
                activeCardFilter === 'ALL' ? 'bg-indigo-500/10 border-indigo-500/50 shadow-lg' : 'bg-slate-900 border-slate-800 hover:bg-slate-800'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                  <DollarSign size={20} />
                </div>
                <div className="text-2xl font-bold text-white">
                  {records.length}
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Todas Transações</span>
              {activeCardFilter === 'ALL' && <div className="absolute bottom-0 left-0 h-1 bg-indigo-500 w-full" />}
            </button>
          </div>
          
          <AdvancedTagFilter 
            scope="FINANCE"
            onFilterChange={(inc, exc) => setTagFilters({ included: inc, excluded: exc })} 
          />

          {/* Records Table */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Contatos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Etiquetas
                  </th>
                  <th 
                    onClick={() => handleSort('description')}
                    className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white"
                  >
                    <div className="flex items-center gap-1">
                      Descrição
                      {sortConfig.key === 'description' && (sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Datas
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th 
                    onClick={() => handleSort('amount')}
                    className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white"
                  >
                    <div className="flex items-center gap-1">
                      Valor
                      {sortConfig.key === 'amount' && (sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider text-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {sortedRecords.map((record) => (
                  <Fragment key={record.id}>
                    <tr 
                      className="hover:bg-slate-700/30 transition-colors cursor-pointer"
                      onClick={(e) => { 
                         // To avoid issues with click on row vs double click, keeping only double click as standard behavior based on plan.
                         // But the current interaction uses click to expand if there are children or open modal. Let's make single click select or expand and double click open modal.
                         // Wait, ProcessList and ContactList used onRowClick which intercepts single clicks. The plan says "Duplo clique na Grid". I will implement onDoubleClick here and keep onClick for expand or selection if needed, but for now just replace onClick with onDoubleClick.
                      }}
                      onDoubleClick={() => handleOpenModal(record)}
                    >
                    <td className="px-5 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col gap-1">
                        {record.parties
                          ?.filter((party) => party.contact)
                          .sort((a, b) => getPartyRoleMeta(a.role).order - getPartyRoleMeta(b.role).order)
                          .map((party) => {
                            const roleMeta = getPartyRoleMeta(party.role);
                    
                            return (
                              <div key={`${record.id}-${party.contactId}-${party.role}`} className="flex items-center gap-1.5">
                                <span className={`text-[9px] font-bold px-1 py-0.5 rounded shrink-0 ${roleMeta.className}`}>
                                  {roleMeta.short}
                                </span>
                                <span
                                  className="text-xs text-slate-200 hover:text-indigo-400 cursor-pointer transition-colors truncate max-w-[140px]"
                                  onClick={() => navigate(`/contacts/${party.contact!.id}`)}
                                  title={`${roleMeta.label}: ${party.contact!.name}`}
                                >
                                  {party.contact!.name}
                                </span>
                                {party.amount && (
                                  <span className="text-[10px] text-slate-500 shrink-0">
                                    {formatCurrency(Number(party.amount))}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                    
                        {record.bankAccount && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-blue-500/15 text-blue-400 shrink-0">BC</span>
                            <span
                              className="text-[10px] text-slate-400 truncate max-w-[140px] flex items-center gap-1"
                              title={record.bankAccount.bankName}
                            >
                              <Building2 size={10} />
                              {record.bankAccount.bankName}
                            </span>
                          </div>
                        )}
                    
                        {(!record.parties || record.parties.length === 0) && !record.bankAccount && (
                          <span className="text-[10px] text-slate-600 italic">Sem partes</span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <InlineTags
                        tags={record.tags || []}
                        entityId={record.id}
                        entityType="financial"
                        onRefresh={fetchData}
                      />
                    </td>

                    <td className="px-6 py-4 min-w-[200px]">
                      <div className="flex items-center gap-2">
                        {record.children && record.children.length > 0 && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); toggleRowExpand(record.id); }} 
                            className="text-slate-400 hover:text-white shrink-0"
                          >
                            {expandedRows.has(record.id) ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                          </button>
                        )}
                        <div className="flex flex-col">
                          <p className="text-sm font-medium text-white line-clamp-3 leading-tight mb-1">
                            {record.description}
                          </p>
                          <div className="flex gap-1 items-center">
                            {record.financialCategory && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded border border-slate-700 bg-slate-800 text-slate-400">
                                {record.financialCategory.name}
                              </span>
                            )}
                            {record.totalInstallments && record.totalInstallments > 1 && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded border border-purple-500/20">
                                {record.totalInstallments}x
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-500 w-12 shrink-0 uppercase">Lanç:</span>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {record.createdAt ? formatDate(record.createdAt) : '-'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-500 w-12 shrink-0 uppercase">Venc:</span>
                          <span className="text-[11px] text-orange-400 font-bold">
                            {formatDate(record.dueDate)}
                          </span>
                        </div>
                        {record.paymentDate && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-500 w-12 shrink-0 uppercase">Pagto:</span>
                            <span className="text-[11px] text-green-400 font-bold">
                              {formatDate(record.paymentDate)}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(record.status)}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-right">
                        <span className={`text-sm font-bold ${record.type === 'INCOME' ? 'text-green-400' : 'text-red-400'}`}>
                          {record.type === 'INCOME' ? '+' : '-'}{formatCurrency(record.amountFinal ? Number(record.amountFinal) : record.amount)}
                        </span>
                        {record.amountFinal && Number(record.amountFinal) !== record.amount && (
                          <p className="text-[10px] text-slate-500 line-through">{formatCurrency(record.amount)}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1 justify-end">
                        {(record.status === 'PENDING' || record.status === 'OVERDUE') && (
                          <button
                            onClick={() => handleOpenSettleModal(record)}
                            className="p-2 text-green-400 hover:bg-green-500/10 rounded transition-colors"
                            title="Liquidar"
                          >
                            <Calculator size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenModal(record)}
                          className="p-2 text-indigo-400 hover:bg-indigo-500/10 rounded transition-colors"
                          title="Editar"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(record.id)}
                          className="p-2 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* Parcelas expandidas */}
                  {expandedRows.has(record.id) && record.children?.map((child) => (
                    <tr 
                      key={child.id} 
                      className="bg-slate-700/20 border-l-2 border-purple-500/40 hover:bg-slate-700/40 transition-colors cursor-pointer"
                      onDoubleClick={() => handleOpenModal(child as FinancialRecord)}
                    >
                      <td className="px-6 py-2 pl-14 whitespace-nowrap text-[10px] text-slate-500 italic">
                        Parcela {child.installmentNumber}/{record.totalInstallments}
                      </td>
                      <td className="px-6 py-2" onClick={(e) => e.stopPropagation()}>
                        <InlineTags
                          tags={child.tags || []}
                          entityId={child.id}
                          entityType="financial"
                          onRefresh={fetchData}
                        />
                      </td>
                      <td className="px-6 py-2">
                        <p className="text-xs text-slate-300 truncate max-w-[200px]">{child.description}</p>
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap">
                        <div className="flex flex-col">
                           <span className="text-[10px] text-orange-400 font-bold">V: {formatDate(child.dueDate)}</span>
                           {child.paymentDate && <span className="text-[10px] text-green-400 font-bold">P: {formatDate(child.paymentDate)}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap text-xs">
                        {getStatusBadge(child.status)}
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap text-right">
                        <span className="text-xs font-bold text-slate-300">{formatCurrency(Number(child.amount))}</span>
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                        {(child.status === 'PENDING' || child.status === 'OVERDUE') && (
                          <button onClick={() => handleOpenSettleModal(child as FinancialRecord)} className="p-1.5 text-green-400 hover:bg-green-500/10 rounded transition-colors" title="Liquidar parcela">
                            <Calculator size={14} />
                          </button>
                        )}
                        <button onClick={() => handleDelete(child.id)} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded transition-colors ml-1" title="Excluir parcela">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* AI & Open Finance Preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border border-indigo-500/30 rounded-xl p-6 relative overflow-hidden group shadow-lg shadow-indigo-500/5 transition-all hover:border-indigo-500/50">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Target size={80} className="text-indigo-400" />
              </div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
                <Target className="text-indigo-400" size={20} />
                IA Financial Insights (Em Breve)
              </h3>
              <p className="text-sm text-slate-400 mb-4">
                O Dr.X está analisando seu fluxo de caixa. Em breve você terá previsões de inadimplência e sugestões de redução de custos automáticas.
              </p>
              <div className="flex gap-2">
                <span className="px-2 py-1 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold rounded border border-indigo-500/20 uppercase">Projeção 2026</span>
                <span className="px-2 py-1 bg-purple-500/10 text-purple-400 text-[10px] font-bold rounded border border-purple-500/20 uppercase">Risk Analysis</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-900/20 to-teal-900/20 border border-emerald-500/30 rounded-xl p-6 relative overflow-hidden group shadow-lg shadow-emerald-500/5 transition-all hover:border-emerald-500/50">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Building2 size={80} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
                <Building2 className="text-emerald-400" size={20} />
                Open Finance Hub
              </h3>
              <p className="text-sm text-slate-400 mb-4">
                Conecte suas contas bancárias reais para conciliação automática via Open Finance. Sincronização em tempo real com os principais bancos.
              </p>
              <button className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2">
                <Plus size={14} /> Conectar Banco
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bank Accounts View */}
      {view === 'accounts' && !selectedBankAccount && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bankAccounts.map((account) => (
            <div 
              key={account.id} 
              onClick={() => setSelectedBankAccount(account)}
              className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-indigo-500/50 transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-3 bg-indigo-500/10 rounded-lg group-hover:bg-indigo-500/20 transition-colors">
                    <Building2 className="text-indigo-400" size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">{account.title}</h3>
                    <p className="text-sm text-slate-400">{account.bankName}</p>
                    <p className="text-xs text-slate-500">
                      {account.accountType === 'CHECKING' ? 'Conta Corrente' : 'Poupança'}
                    </p>
                    
                    {account.contact && (
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span className="text-xs px-2 py-1 bg-blue-500/10 text-blue-400 rounded inline-flex items-center gap-1">
                          <User size={12} />
                          {account.contact.name}
                        </span>
                        <span className="text-xs text-slate-500">
                          {account.contact.personType === 'PF' 
                            ? account.contact.cpf 
                            : account.contact.cnpj}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleOpenBankModal(account)}
                    className="p-2 text-indigo-400 hover:bg-indigo-500/10 rounded transition-colors"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteBank(account.id)}
                    className="p-2 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {account.accountNumber && (
                <div className="mb-4 space-y-1">
                  <p className="text-xs text-slate-500">Agência: {account.agency || '-'}</p>
                  <p className="text-xs text-slate-500">Conta: {account.accountNumber}</p>
                </div>
              )}

              <div className="pt-4 border-t border-slate-700">
                <p className="text-sm text-slate-400 mb-1">Saldo</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(account.balance)}</p>
              </div>

              <div className="mt-4">
                <span
                  className={`px-2 py-1 rounded-md text-xs font-medium ${
                    account.isActive
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-gray-500/10 text-gray-400'
                  }`}
                >
                  {account.isActive ? 'Ativa' : 'Inativa'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'accounts' && selectedBankAccount && (
        <BankAccountDetails 
          account={selectedBankAccount} 
          onBack={() => {
            setSelectedBankAccount(null);
            fetchData();
          }} 
        />
      )}

      {/* Conditions View */}
      {view === 'conditions' && (
        <PaymentConditions />
      )}

      {/* Modal de Transação */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">
                  {editingRecord ? 'Editar Transação' : 'Nova Transação'}
                </h2>
                <button
                  onClick={() => { setShowModal(false); setModalTab('dados'); }}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              
              {/* Tabs */}
              <div className="flex gap-1 bg-slate-900 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setModalTab('dados')}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    modalTab === 'dados' 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <DollarSign size={14} className="inline mr-1.5" />
                  Dados Gerais
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('partes')}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    modalTab === 'partes' 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <User size={14} className="inline mr-1.5" />
                  Partes da Transação
                  {editingRecord?.parties && editingRecord.parties.length > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 bg-indigo-500/30 rounded text-[10px] font-bold">
                      {editingRecord.parties.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Tab: Partes da Transação */}
            {modalTab === 'partes' && (
              <div className="p-6">
                {editingRecord ? (
                  <FinancialParties 
                    recordId={editingRecord.id}
                    recordType={editingRecord.type as 'INCOME' | 'EXPENSE'}
                    bankAccounts={bankAccounts}
                    currentBankAccountId={editingRecord.bankAccount?.id}
                    onBankAccountChange={(id) => {
                      setFormData(prev => ({ ...prev, bankAccountId: id }));
                    }}
                    onUpdate={fetchData}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-4 bg-slate-900/30 rounded-xl border border-slate-700/50">
                    <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 flex-none">
                      <User size={32} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-white">Gerenciamento de Partes</h3>
                      <p className="text-sm text-slate-400 max-w-sm">
                        Para gerenciar detalhadamente os credores, devedores e pagadores desta transação, primeiro você precisa **salvar** os dados básicos.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setModalTab('dados')}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Voltar para Dados Gerais e Salvar
                    </button>
                  </div>
                )}
              </div>
            )}

             {/* Tab: Dados Gerais (formulário refatorado) */}
            {modalTab === 'dados' && (
            <form onSubmit={handleSubmit} className="p-6 space-y-4">

              {/* LINHA 1: Tipo | Categoria | Status */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Tipo *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="INCOME">Receita</option>
                    <option value="EXPENSE">Despesa</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Categoria</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      list="category-list-modal"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Honorários..."
                    />
                    <datalist id="category-list-modal">
                      {categories.map((c) => (
                        <option key={c.id} value={c.name} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Status *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="PENDING">Pendente</option>
                    <option value="PAID">Pago / Recebido</option>
                    <option value="CANCELLED">Cancelado</option>
                    <option value="OVERDUE">Vencido</option>
                  </select>
                </div>
              </div>

              {/* LINHA 2: Valor | Parcelas (Select + Nx) | Vencimento */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Valor *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-500 text-sm">R$</span>
                    <input
                      ref={amountInputRef}
                      autoFocus
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-lg"
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-indigo-400 mb-1 uppercase tracking-wider">Parcelas</label>
                  <div className="flex gap-1">
                    <select
                      value={formData.paymentConditionId}
                      onChange={(e) => {
                        setFormData({ ...formData, paymentConditionId: e.target.value });
                        if (e.target.value) setNxInput('');
                      }}
                      className="flex-1 px-2 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-0"
                    >
                      <option value="">À Vista</option>
                      {paymentConditions.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={nxInput}
                      onChange={(e) => handleNxInput(e.target.value)}
                      className="w-14 px-2 py-2 bg-slate-700 border border-indigo-500/30 rounded-lg text-indigo-300 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-500"
                      placeholder="Nx"
                      title="Digite ex: 3x para dividir em 3 parcelas"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowConditionSubModal(true)}
                      className="p-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg hover:bg-indigo-500/20 transition-colors shrink-0"
                      title="Criar nova Condição de Pagamento"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Vencimento *</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              {/* Grid de Parcelas Geradas */}
              {installments.length > 0 && (
                <div className="bg-slate-900/50 rounded-xl border border-indigo-500/20 p-4 space-y-3">
                  <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                    <Calendar size={14} />
                    Parcelas Geradas (Confira e Ajuste se necessário)
                  </h3>
                  <div className="max-h-[200px] overflow-y-auto rounded-lg border border-slate-700">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-800 text-[10px] text-slate-400 font-bold uppercase">
                          <th className="px-3 py-2 border-b border-slate-700">Parcela</th>
                          <th className="px-3 py-2 border-b border-slate-700">Vencimento</th>
                          <th className="px-3 py-2 border-b border-slate-700 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs">
                        {installments.map((inst, idx) => (
                          <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                            <td className="px-3 py-2 text-slate-300 font-medium">{inst.installmentNumber}ª</td>
                            <td className="px-3 py-2">
                              <input 
                                type="date" 
                                value={inst.dueDate}
                                onChange={(e) => {
                                  const newInsts = [...installments];
                                  newInsts[idx].dueDate = e.target.value;
                                  setInstallments(newInsts);
                                }}
                                className="bg-transparent border-none p-0 text-white focus:ring-0 w-full"
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-slate-500 text-[10px]">R$</span>
                                <input 
                                  type="number" 
                                  step="0.01"
                                  value={inst.amount}
                                  onChange={(e) => {
                                    const newInsts = [...installments];
                                    newInsts[idx].amount = parseFloat(e.target.value) || 0;
                                    setInstallments(newInsts);
                                  }}
                                  className="bg-transparent border-none p-0 text-white text-right focus:ring-0 w-20 font-bold"
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-800/50">
                        <tr>
                          <td colSpan={2} className="px-3 py-2 text-[11px] font-bold text-slate-400">TOTAL CONFERIDO:</td>
                          <td className="px-3 py-2 text-right text-white font-bold">
                            {formatCurrency(installments.reduce((sum, i) => sum + i.amount, 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* LINHA 3: Descrição */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Descrição *</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex: Honorários processo X"
                  required
                />
              </div>

              {/* LINHA 4: Data Pagamento | Forma Pagamento | Conta Bancária */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Data Pagamento</label>
                  <input
                    type="date"
                    value={formData.paymentDate}
                    onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Forma Pagamento</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Selecione...</option>
                    <option value="PIX">PIX</option>
                    <option value="BOLETO">Boleto</option>
                    <option value="TED">TED</option>
                    <option value="DINHEIRO">Dinheiro</option>
                    <option value="CARTAO">Cartão</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Conta Bancária</label>
                  <select
                    value={formData.bankAccountId}
                    onChange={(e) => setFormData({ ...formData, bankAccountId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Selecione...</option>
                    {bankAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.bankName || account.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* LINHA 5: Origem | Tags */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
                    <Globe size={10} className="inline mr-1" />
                    Origem
                  </label>
                  <select
                    value={formData.origin}
                    onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="MANUAL">✏️ Manual</option>
                    <option value="NF">📄 Nota Fiscal</option>
                    <option value="COMPRA">🛒 Compra</option>
                    <option value="PROPOSTA">📋 Proposta</option>
                    <option value="JUDICIAL">⚖️ Judicial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
                    <Tag size={10} className="inline mr-1" />
                    Tags
                  </label>
                  {editingRecord ? (
                    <InlineTags
                      tags={editingRecord.tags || []}
                      entityId={editingRecord.id}
                      entityType="financial"
                      onRefresh={fetchData}
                    />
                  ) : (
                    <p className="text-[10px] text-slate-500 italic py-2">
                      Tags disponíveis após salvar
                    </p>
                  )}
                </div>
              </div>

              {/* LINHA 6: Observações (com paste de imagens) */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
                  Observações
                  <span className="text-slate-600 font-normal ml-2">(Cole imagens com Ctrl+V)</span>
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  onPaste={handleNotesPaste}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px] text-sm"
                  placeholder="Observações adicionais..."
                />
                {/* Preview de imagens coladas */}
                {pastedImages.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {pastedImages.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <img src={img.url} alt={`Colada ${idx + 1}`} className="w-20 h-20 object-cover rounded-lg border border-slate-600" />
                        <button
                          type="button"
                          onClick={() => {
                            URL.revokeObjectURL(img.url);
                            setPastedImages(prev => prev.filter((_, i) => i !== idx));
                          }}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={10} className="text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Anexos */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
                  <Paperclip size={10} className="inline mr-1" />
                  Anexos
                </label>
                 <div className="flex items-center gap-2">
                  <input 
                    ref={attachmentInputRef}
                    type="file" 
                    multiple 
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      if (e.target.files) {
                        setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
                      }
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => attachmentInputRef.current?.click()}
                    className="px-3 py-1.5 bg-slate-700 border border-dashed border-slate-500 rounded-lg text-xs text-slate-400 hover:text-white hover:border-indigo-500 transition-colors flex items-center gap-1.5"
                  >
                    <Upload size={12} />
                    Adicionar Arquivo
                  </button>
                  {attachments.length > 0 && (
                    <span className="text-[10px] text-indigo-400 font-bold">{attachments.length} novo(s) arquivo(s) para salvar</span>
                  )}
                </div>

                {/* Anexos já salvos */}
                {editingRecord?.metadata?.attachments?.length > 0 && (
                  <div className="mt-4 border-t border-slate-800 pt-3">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Anexos Salvos</h4>
                    <div className="flex flex-col gap-1.5">
                      {editingRecord!.metadata.attachments.map((att: any, attIdx: number) => {
                        const docUrl = savedAttachmentUrls[att.fileName];

                        return (
                          <div key={'saved-' + attIdx} className="relative group/doc flex bg-slate-800/50 hover:bg-slate-800 rounded p-1.5 transition-colors">
                            {docUrl ? (
                              <AttachmentPreview url={docUrl} title={att.originalName}>
                                <a
                                  href={docUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 hover:underline group/link py-0.5"
                                  title={att.originalName}
                                >
                                  <FileText size={14} className="text-blue-500 group-hover/link:text-blue-400" />
                                  <span className="truncate max-w-[300px]">{att.originalName}</span>
                                </a>
                              </AttachmentPreview>
                            ) : (
                              <div className="flex items-center gap-1.5 py-0.5 text-xs text-slate-500">
                                <FileText size={14} className="text-slate-600" />
                                <span className="truncate max-w-[300px]">Carregando {att.originalName}...</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Novos Anexos */}
                {attachments.length > 0 && (
                  <div className="mt-4 border-t border-slate-800 pt-3">
                    <h4 className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-2">Novos Anexos</h4>
                    <div className="space-y-1">
                      {attachments.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900/30 px-2 py-1 rounded">
                          <FileText size={12} className="text-slate-500" />
                          <span className="flex-1 truncate">{file.name}</span>
                          <span className="text-slate-600">{(file.size / 1024).toFixed(0)} KB</span>
                          <button
                            type="button"
                            onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                            className="text-red-400 hover:text-red-300"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-6 border-t border-slate-700 mt-6 bg-slate-900 -mx-6 -mb-6 p-6 rounded-b-lg">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition-colors"
                >
                  Cancelar (ESC)
                </button>
                <div className="flex-1 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); handleSubmit(e); }}
                      disabled={submitting}
                      className={`px-6 py-2 bg-indigo-600/90 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors shadow-lg shadow-indigo-500/20 ${
                        submitting ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {submitting ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); handleSubmit(e); }}
                      disabled={submitting}
                      className={`px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-emerald-500/20 ${
                        submitting ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {submitting ? 'Salvando...' : 'Salvar e Sair'}
                    </button>
                </div>
              </div>
            </form>
            )}

            {/* Sub-Modal: Criar Condição de Pagamento */}
            {showConditionSubModal && (
              <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
                <div className="bg-slate-800 rounded-lg w-full max-w-3xl max-h-[85vh] overflow-y-auto border border-slate-700 shadow-2xl">
                  <div className="p-4 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-800 z-10">
                    <h3 className="text-lg font-bold text-white">Condições de Pagamento</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setShowConditionSubModal(false);
                        fetchPaymentConditions();
                      }}
                      className="text-slate-400 hover:text-white transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div className="p-2">
                    <PaymentConditions />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Conta Bancária */}
      {showBankModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg w-full max-w-lg">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                {editingBank ? 'Editar Conta Bancária' : 'Nova Conta Bancária'}
              </h2>
              <button
                onClick={() => setShowBankModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleBankSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Título da Conta <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={bankFormData.title}
                  onChange={(e) => setBankFormData({ ...bankFormData, title: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex: Conta Empresa - Operacional"
                  required
                />
                <p className="text-xs text-slate-400 mt-1">
                  Nome para identificar esta conta
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Nome do Banco *</label>
                <input
                  type="text"
                  value={bankFormData.bankName}
                  onChange={(e) => setBankFormData({ ...bankFormData, bankName: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex: Banco do Brasil"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de Conta *</label>
                <select
                  value={bankFormData.accountType}
                  onChange={(e) => setBankFormData({ ...bankFormData, accountType: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="CHECKING">Conta Corrente</option>
                  <option value="SAVINGS">Poupança</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Agência</label>
                  <input
                    type="text"
                    value={bankFormData.agency}
                    onChange={(e) => setBankFormData({ ...bankFormData, agency: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="0000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Número da Conta</label>
                  <input
                    type="text"
                    value={bankFormData.accountNumber}
                    onChange={(e) => setBankFormData({ ...bankFormData, accountNumber: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="00000-0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Saldo Inicial</label>
                <input
                  type="number"
                  step="0.01"
                  value={bankFormData.balance}
                  onChange={(e) => setBankFormData({ ...bankFormData, balance: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Titular da Conta (Opcional)
                </label>
                <ContactPickerGlobal 
                  onAdd={async () => {}} // Campo único, não usa onAdd
                  onSelectContact={(id) => setBankFormData({ ...bankFormData, contactId: id })}
                  hideRole={true}
                  hideQualification={true}
                  showAction={false}
                  className="!bg-transparent !p-0 !border-0 !shadow-none"
                  context="financial"
                />
                {bankFormData.contactId && (
                   <p className="text-xs text-indigo-400 mt-2 flex items-center gap-1">
                     <User size={12}/> Selecionado: {contacts.find(c => c.id === bankFormData.contactId)?.name || 'ID: ' + bankFormData.contactId}
                   </p>
                )}
                {loadingContacts && (
                  <p className="text-xs text-slate-400 mt-1">Carregando contatos...</p>
                )}
                <p className="text-xs text-slate-400 mt-1">
                  Selecione o contato titular desta conta (CPF ou CNPJ)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Observações</label>
                <textarea
                  value={bankFormData.notes}
                  onChange={(e) => setBankFormData({ ...bankFormData, notes: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
                  placeholder="Observações adicionais..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBankModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                >
                  Cancelar (ESC)
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors ${
                    submitting ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {submitting ? 'Salvando...' : (editingBank ? 'Atualizar' : 'Criar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal de Parcelamento */}
      {showInstallmentModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Repeat className="text-purple-400" size={24} />
                Criar Parcelamento
              </h2>
              <button onClick={() => setShowInstallmentModal(false)} className="text-slate-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleInstallmentSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Descrição *</label>
                <input type="text" value={installmentData.description} onChange={e => setInstallmentData({...installmentData, description: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500" required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Valor Total *</label>
                  <input type="number" step="0.01" min="0.01" value={installmentData.totalAmount} onChange={e => setInstallmentData({...installmentData, totalAmount: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Nº Parcelas *</label>
                  <input type="number" min="2" max="120" value={installmentData.numInstallments} onChange={e => setInstallmentData({...installmentData, numInstallments: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500" required />
                </div>
              </div>

              {installmentData.totalAmount && installmentData.numInstallments && (
                <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg text-center">
                  <p className="text-purple-400 text-sm">
                    {installmentData.numInstallments}x de <strong>{formatCurrency(parseFloat(installmentData.totalAmount) / parseInt(installmentData.numInstallments || '1'))}</strong>
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Tipo</label>
                  <select value={installmentData.type} onChange={e => setInstallmentData({...installmentData, type: e.target.value as 'INCOME' | 'EXPENSE'})}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                    <option value="INCOME">Receita</option>
                    <option value="EXPENSE">Despesa</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Periodicidade</label>
                  <input
                    type="text"
                    list="installment-periodicity-list"
                    value={installmentData.periodicity}
                    onChange={e => setInstallmentData({...installmentData, periodicity: e.target.value as any})}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Ex: Mensal, Anual"
                  />
                  <datalist id="installment-periodicity-list">
                    <option value="Mensal" />
                    <option value="Quinzenal" />
                    <option value="Semanal" />
                    <option value="Anual" />
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">1º Vencimento *</label>
                <input type="date" value={installmentData.firstDueDate} onChange={e => setInstallmentData({...installmentData, firstDueDate: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500" required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Conta Bancária</label>
                  <select value={installmentData.bankAccountId} onChange={e => setInstallmentData({...installmentData, bankAccountId: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                    <option value="">Nenhuma</option>
                    {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Forma Pgto</label>
                  <select value={installmentData.paymentMethod} onChange={e => setInstallmentData({...installmentData, paymentMethod: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                    <option value="">Selecione</option>
                    <option value="PIX">PIX</option>
                    <option value="BOLETO">Boleto</option>
                    <option value="TED">TED</option>
                    <option value="DINHEIRO">Dinheiro</option>
                    <option value="CARTAO">Cartão</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowInstallmentModal(false)} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors">Cancelar (ESC)</button>
                <button type="submit" disabled={submitting} className={`flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  {submitting ? 'Criando...' : 'Criar Parcelamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Liquidação - REDESENHADO */}
      {showSettleModal && settlingRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Calculator className="text-green-400" size={24} />
                Liquidar / Baixa de Título
              </h2>
              <button onClick={() => setShowSettleModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            {/* Resumo do registro */}
            <div className="p-4 bg-gradient-to-r from-slate-700/60 to-slate-700/30 rounded-lg mb-5 border border-slate-600/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Descrição</p>
                  <p className="text-base font-semibold text-white">{settlingRecord.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-400">Valor Original</p>
                  <p className="text-xl font-bold text-white">{formatCurrency(settlingRecord.amount)}</p>
                </div>
              </div>
            </div>

            {/* ===  LINHA TEMPORAL DE DATAS === */}
            <div className="p-4 bg-slate-700/30 rounded-lg mb-5 border border-slate-600/30">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Clock size={14} /> Linha Temporal
              </h3>
              <div className="flex items-center gap-2">
                {/* Data de Lançamento */}
                <div className="flex-1 p-3 bg-slate-800/60 rounded-lg border border-slate-600/40">
                  <p className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">Lançamento</p>
                  <p className="text-sm font-medium text-slate-300 mt-0.5">
                    {settlingRecord.createdAt ? formatDate(settlingRecord.createdAt) : formatDate(settlingRecord.dueDate)}
                  </p>
                </div>

                <ArrowRight size={16} className="text-slate-500 shrink-0" />

                {/* Data de Vencimento */}
                <div className="flex-1 p-3 bg-slate-800/60 rounded-lg border border-slate-600/40">
                  <p className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">Vencimento</p>
                  <p className="text-sm font-medium text-slate-300 mt-0.5">{formatDate(settlingRecord.dueDate)}</p>
                </div>

                <ArrowRight size={16} className="text-slate-500 shrink-0" />

                {/* Data de Pagamento (editável + badge atraso) */}
                <div className="flex-1">
                  <div className="p-3 bg-slate-800/60 rounded-lg border-2 border-green-500/40">
                    <label className="text-[10px] uppercase text-green-400 font-semibold tracking-wider flex items-center gap-1">
                      Pagamento <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="date"
                      value={settleData.paymentDate}
                      onChange={e => setSettleData({...settleData, paymentDate: e.target.value})}
                      className="w-full bg-transparent text-sm font-medium text-white mt-0.5 focus:outline-none"
                      required
                    />
                  </div>
                  {/* Badge de dias de atraso */}
                  {settleData.paymentDate && (
                    <div className="mt-1.5 flex justify-center">
                      {calcSettleDaysLate > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/15 text-red-400 border border-red-500/25">
                          <XCircle size={12} />
                          {calcSettleDaysLate} {calcSettleDaysLate === 1 ? 'dia' : 'dias'} de atraso
                        </span>
                      ) : calcSettleDaysLate === 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-500/15 text-green-400 border border-green-500/25">
                          <CheckCircle2 size={12} />
                          Em dia
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/25">
                          <CheckCircle2 size={12} />
                          {Math.abs(calcSettleDaysLate)} {Math.abs(calcSettleDaysLate) === 1 ? 'dia' : 'dias'} antecipado
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <form onSubmit={handleSettle} className="space-y-5">
              {/* === ENCARGOS (Multa + Juros + Correção) === */}
              <div className="border border-yellow-500/20 rounded-lg p-4 space-y-3 bg-yellow-500/5">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-yellow-400"/>
                  Encargos
                  {calcSettleDaysLate > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-red-500/15 text-red-400 rounded ml-auto">Auto-aplicado por atraso</span>
                  )}
                </h3>

                {/* Multa */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Multa</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <input type="number" step="0.01" min="0" value={settleData.finePercent}
                        onChange={e => handleSettlePercentChange('finePercent', e.target.value)}
                        className="w-full px-3 py-1.5 pr-7 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500" placeholder="0"/>
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
                    </div>
                    <div className="relative">
                      <input type="number" step="0.01" min="0" value={settleData.fine}
                        onChange={e => handleSettleValueChange('fine', e.target.value)}
                        className="w-full px-3 py-1.5 pr-7 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500" placeholder="0,00"/>
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">R$</span>
                    </div>
                  </div>
                </div>

                {/* Juros */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Juros</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <input type="number" step="0.01" min="0" value={settleData.interestPercent}
                        onChange={e => handleSettlePercentChange('interestPercent', e.target.value)}
                        className="w-full px-3 py-1.5 pr-7 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500" placeholder="0"/>
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
                    </div>
                    <div className="relative">
                      <input type="number" step="0.01" min="0" value={settleData.interest}
                        onChange={e => handleSettleValueChange('interest', e.target.value)}
                        className="w-full px-3 py-1.5 pr-7 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500" placeholder="0,00"/>
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">R$</span>
                    </div>
                  </div>
                </div>

                {/* Correção Monetária */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Correção Monetária</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <input type="number" step="0.01" min="0" value={settleData.monetaryCorrectionPercent}
                        onChange={e => handleSettlePercentChange('monetaryCorrectionPercent', e.target.value)}
                        className="w-full px-3 py-1.5 pr-7 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500" placeholder="0"/>
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
                    </div>
                    <div className="relative">
                      <input type="number" step="0.01" min="0" value={settleData.monetaryCorrection}
                        onChange={e => handleSettleValueChange('monetaryCorrection', e.target.value)}
                        className="w-full px-3 py-1.5 pr-7 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500" placeholder="0,00"/>
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">R$</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* === ACRÉSCIMOS/DESCONTO === */}
              <div className="border border-blue-500/20 rounded-lg p-4 space-y-3 bg-blue-500/5">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Percent size={16} className="text-blue-400"/> Acréscimos/Desconto
                </h3>
                <div className="grid grid-cols-2 gap-2 items-end">
                  <div className="relative">
                    <label className="block text-xs text-slate-400 mb-1">%</label>
                    <input type="number" step="0.01" value={settleData.discountPercent}
                      onChange={e => handleSettlePercentChange('discountPercent', e.target.value)}
                      className="w-full px-3 py-1.5 pr-7 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="0"/>
                    <span className="absolute right-2.5 bottom-[7px] text-xs text-slate-500">%</span>
                  </div>
                  <div className="relative">
                    <label className="block text-xs text-slate-400 mb-1">Valor (R$)</label>
                    <input type="number" step="0.01" value={settleData.discount}
                      onChange={e => handleSettleValueChange('discount', e.target.value)}
                      className="w-full px-3 py-1.5 pr-7 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="0,00"/>
                    <span className="absolute right-2.5 bottom-[7px] text-xs text-slate-500">R$</span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">Use valor positivo para acréscimo, negativo para desconto</p>
              </div>

              {/* === VALOR FINAL EDITÁVEL === */}
              <div className="p-4 rounded-lg border-2 border-green-500/30 bg-green-500/5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <label className="text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      Valor Total a Pagar <span className="text-red-400">*</span>
                    </label>
                    <div className="flex items-baseline gap-2 mt-1">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-400 font-bold text-sm">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={settleFinalOverride !== '' ? settleFinalOverride : calcSettleFinalAmount.toFixed(2)}
                          onChange={e => handleSettleFinalOverride(e.target.value)}
                          className="w-full pl-10 pr-3 py-2 bg-slate-700/60 border border-green-500/30 rounded-lg text-2xl font-bold text-green-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                      {calcSettleFinalAmount !== settlingRecord.amount && (
                        <span className="text-sm text-slate-500 line-through shrink-0">{formatCurrency(settlingRecord.amount)}</span>
                      )}
                    </div>
                    {settleFinalOverride !== '' && (
                      <button
                        type="button"
                        onClick={() => setSettleFinalOverride('')}
                        className="text-[10px] text-blue-400 hover:text-blue-300 mt-1 underline"
                      >
                        Restaurar valor calculado ({formatCurrency((() => {
                          if (!settlingRecord) return 0;
                          let t = Number(settlingRecord.amount);
                          t += (parseFloat(settleData.fine) || 0) + (parseFloat(settleData.interest) || 0) + (parseFloat(settleData.monetaryCorrection) || 0);
                          t -= (parseFloat(settleData.discount) || 0);
                          return Math.max(0, Math.round(t * 100) / 100);
                        })())})
                      </button>
                    )}
                  </div>
                  <div className="shrink-0">
                    {settlingRecord && calcSettleFinalAmount > settlingRecord.amount && (
                      <span className="text-xs px-2 py-1 bg-red-500/10 text-red-400 rounded-full border border-red-500/20">
                        +{formatCurrency(calcSettleFinalAmount - settlingRecord.amount)}
                      </span>
                    )}
                    {settlingRecord && calcSettleFinalAmount < settlingRecord.amount && (
                      <span className="text-xs px-2 py-1 bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20">
                        -{formatCurrency(settlingRecord.amount - calcSettleFinalAmount)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* === CAMPOS OBRIGATÓRIOS: Forma Pgto + Conta === */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Forma de Pagamento <span className="text-red-400">*</span>
                  </label>
                  <select value={settleData.paymentMethod} onChange={e => setSettleData({...settleData, paymentMethod: e.target.value})}
                    className={`w-full px-4 py-2 bg-slate-700 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 ${
                      !settleData.paymentMethod ? 'border-red-500/40' : 'border-slate-600'
                    }`}
                    required>
                    <option value="">Selecione</option>
                    <option value="PIX">PIX</option>
                    <option value="BOLETO">Boleto</option>
                    <option value="TED">TED</option>
                    <option value="DINHEIRO">Dinheiro</option>
                    <option value="CARTAO">Cartão</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Conta Bancária <span className="text-red-400">*</span>
                  </label>
                  <select value={settleData.bankAccountId} onChange={e => setSettleData({...settleData, bankAccountId: e.target.value})}
                    className={`w-full px-4 py-2 bg-slate-700 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 ${
                      !settleData.bankAccountId ? 'border-red-500/40' : 'border-slate-600'
                    }`}
                    required>
                    <option value="">Selecione</option>
                    {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                  </select>
                </div>
              </div>

              {/* Observações (com suporte a paste de imagem) */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-1.5">
                  Observações
                  <span className="text-[10px] text-slate-500 font-normal">(Cole imagens com Ctrl+V)</span>
                </label>
                <textarea
                  value={settleData.notes}
                  onChange={e => setSettleData({...settleData, notes: e.target.value})}
                  onPaste={handleSettlePaste}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[60px] text-sm"
                  placeholder="Observações sobre a liquidação... (Ctrl+V para colar imagens)"
                />
                {/* Preview de imagens coladas */}
                {settlePastedImages.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {settlePastedImages.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <img src={img.url} alt={img.name} className="h-16 w-16 object-cover rounded-lg border border-slate-600" />
                        <button
                          type="button"
                          onClick={() => {
                            URL.revokeObjectURL(img.url);
                            setSettlePastedImages(prev => prev.filter((_, i) => i !== idx));
                            setSettleAttachments(prev => prev.filter(f => f.name !== img.name));
                          }}
                          className="absolute -top-1.5 -right-1.5 bg-red-500 rounded-full p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* === ANEXOS (Comprovantes, Recibos) === */}
              <div className="border border-slate-600/50 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Paperclip size={16} className="text-slate-400" />
                  Anexos
                  <span className="text-[10px] text-slate-500 font-normal">(Comprovantes, Recibos, etc.)</span>
                </h3>

                {/* Botão de upload */}
                <label className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-700/50 border-2 border-dashed border-slate-600 rounded-lg text-slate-400 hover:text-white hover:border-indigo-500/50 hover:bg-slate-700 cursor-pointer transition-all">
                  <Image size={18} />
                  <span className="text-sm">Clique para anexar arquivos</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                    onChange={handleSettleFileChange}
                    className="hidden"
                  />
                </label>

                {/* Lista de arquivos anexados */}
                {settleAttachments.length > 0 && (
                  <div className="space-y-1.5">
                    {settleAttachments.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-slate-700/40 rounded-lg border border-slate-600/30">
                        <Paperclip size={14} className="text-indigo-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white truncate">{file.name}</p>
                          <p className="text-[10px] text-slate-500">{formatFileSize(file.size)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSettleAttachment(idx)}
                          className="p-1 text-red-400 hover:bg-red-500/10 rounded transition-colors shrink-0"
                          title="Remover"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowSettleModal(false)} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors">
                  Cancelar (ESC)
                </button>
                <button
                  type="submit"
                  disabled={submitting || !isSettleFormValid}
                  className={`flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                    (submitting || !isSettleFormValid) ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  title={!isSettleFormValid ? 'Preencha todos os campos obrigatórios' : ''}
                >
                  <CheckCircle2 size={18} />
                  {submitting ? 'Liquidando...' : `Liquidar ${formatCurrency(calcSettleFinalAmount)}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} title="Financeiro" sections={helpFinancial} />
    </div>
  );
}
