import { useState, useEffect, useCallback, useMemo } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../services/api';

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
    role: 'CREDITOR' | 'DEBTOR';
    amount?: number;
    contact?: Contact;
  }[];
  splits?: TransactionSplit[];
}

interface TransactionSplit {
  id?: string;
  contactId: string;
  role: 'CREDITOR' | 'DEBTOR';
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

export function Financial() {
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'records' | 'accounts'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [showInstallmentModal, setShowInstallmentModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settlingRecord, setSettlingRecord] = useState<FinancialRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<FinancialRecord | null>(null);
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const [filters, setFilters] = useState({
    type: '',
    status: '',
    category: '',
  });

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
    periodicity: 'MONTHLY' as 'MONTHLY' | 'BIWEEKLY' | 'WEEKLY' | 'CUSTOM',
    // Seções colapsáveis
    showCharges: false,
    parties: [] as { contactId: string; role: 'CREDITOR' | 'DEBTOR'; amount?: number }[],
    splits: [] as { contactId: string; role: 'CREDITOR' | 'DEBTOR'; amount: number; percentage?: number; description?: string }[],
  });

  const [installmentData, setInstallmentData] = useState({
    totalAmount: '',
    numInstallments: '2',
    periodicity: 'MONTHLY' as 'MONTHLY' | 'BIWEEKLY' | 'WEEKLY',
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

  const [newParty, setNewParty] = useState({
    contactId: '',
    role: 'CREDITOR' as 'CREDITOR' | 'DEBTOR',
    amount: '',
  });

  const [newSplit, setNewSplit] = useState({
    contactId: '',
    role: 'CREDITOR' as 'CREDITOR' | 'DEBTOR',
    amount: '',
    percentage: '',
    description: '',
  });

  const handleAddParty = () => {
    if (!newParty.contactId) {
      toast.error('Selecione um contato');
      return;
    }
    
    // Check if contact already added with same role
    const exists = formData.parties.some(
      p => p.contactId === newParty.contactId && p.role === newParty.role
    );
    
    if (exists) {
      toast.error('Este contato já foi adicionado com este papel');
      return;
    }

    setFormData({
      ...formData,
      parties: [
        ...formData.parties,
        {
          contactId: newParty.contactId,
          role: newParty.role,
          amount: newParty.amount ? parseFloat(newParty.amount) : undefined,
        },
      ],
    });
    
    setNewParty({ ...newParty, contactId: '', amount: '' });
  };

  const handleRemoveParty = (index: number) => {
    const newParties = [...formData.parties];
    newParties.splice(index, 1);
    setFormData({ ...formData, parties: newParties });
  };

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
      const payload: any = {
        paymentDate: settleData.paymentDate,
        amountFinal: calcSettleFinalAmount,
      };
      if (settleData.fine) payload.fine = parseFloat(settleData.fine);
      if (settleData.interest) payload.interest = parseFloat(settleData.interest);
      if (settleData.monetaryCorrection) payload.monetaryCorrection = parseFloat(settleData.monetaryCorrection);
      if (settleData.discount) {
        payload.discount = parseFloat(settleData.discount);
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
      totalAmount: '', numInstallments: '2', periodicity: 'MONTHLY', type: 'INCOME',
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
        periodicity: (record.periodicity as 'MONTHLY' | 'BIWEEKLY' | 'WEEKLY' | 'CUSTOM') || 'MONTHLY',
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
        periodicity: 'MONTHLY',
        showCharges: false,
        parties: [],
        splits: [],
      });
    }
    setShowModal(true);
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
        parties: formData.parties.length > 0 ? formData.parties : undefined,
        splits: formData.splits.length > 0 ? formData.splits : undefined,
        totalInstallments: parseInt(formData.totalInstallments) || 1,
        periodicity: formData.periodicity,
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

      if (editingRecord) {
        await api.put(`/financial/records/${editingRecord.id}?tenantId=${tenantId}`, payload);
        toast.success('Registro atualizado com sucesso');
      } else {
        await api.post('/financial/records', payload);
        toast.success('Registro criado com sucesso');
      }

      setShowModal(false);
      await fetchData();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message ||
                          (Array.isArray(error.response?.data?.message)
                            ? error.response.data.message.join(', ')
                            : 'Erro ao salvar registro');
      toast.error(errorMessage);
      console.error('Erro completo:', error);
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

  const filteredRecords = records.filter((record) =>
    record.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

          {/* Records Table */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Descrição
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Categoria
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Vencimento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Valor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredRecords.map((record) => (
                  <>
                    <tr key={record.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {record.children && record.children.length > 0 && (
                          <button onClick={() => toggleRowExpand(record.id)} className="text-slate-400 hover:text-white">
                            {expandedRows.has(record.id) ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                          </button>
                        )}
                        <div>
                          <p className="text-sm font-medium text-white">{record.description}</p>
                          <div className="flex gap-1 items-center">
                            {record.bankAccount && (
                              <span className="text-xs text-slate-400">{record.bankAccount.bankName}</span>
                            )}
                            {record.totalInstallments && record.totalInstallments > 1 && (
                              <span className="text-xs px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded border border-purple-500/20">
                                {record.totalInstallments}x
                              </span>
                            )}
                            {record.isResidual && (
                              <span className="text-xs px-1.5 py-0.5 bg-orange-500/10 text-orange-400 rounded border border-orange-500/20">
                                Residual
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getTypeBadge(record.type)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {record.financialCategory?.name || record.category || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {formatDate(record.dueDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(record.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <span className={`text-sm font-bold ${record.type === 'INCOME' ? 'text-green-400' : 'text-red-400'}`}>
                          {record.type === 'INCOME' ? '+' : '-'}{formatCurrency(record.amountFinal ? Number(record.amountFinal) : record.amount)}
                        </span>
                        {record.amountFinal && Number(record.amountFinal) !== record.amount && (
                          <p className="text-xs text-slate-500 line-through">{formatCurrency(record.amount)}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-1">
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
                    <tr key={child.id} className="bg-slate-700/20 border-l-2 border-purple-500/40">
                      <td className="px-6 py-2 pl-14 whitespace-nowrap">
                        <p className="text-xs text-slate-300">{child.description}</p>
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap"></td>
                      <td className="px-6 py-2 whitespace-nowrap"></td>
                      <td className="px-6 py-2 whitespace-nowrap text-xs text-slate-400">{formatDate(child.dueDate)}</td>
                      <td className="px-6 py-2 whitespace-nowrap">{getStatusBadge(child.status)}</td>
                      <td className="px-6 py-2 whitespace-nowrap">
                        <span className="text-xs font-bold text-slate-300">{formatCurrency(Number(child.amount))}</span>
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap">
                        {(child.status === 'PENDING' || child.status === 'OVERDUE') && (
                          <button onClick={() => handleOpenSettleModal(child as FinancialRecord)} className="p-1 text-green-400 hover:bg-green-500/10 rounded" title="Liquidar parcela">
                            <Calculator size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bank Accounts View */}
      {view === 'accounts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bankAccounts.map((account) => (
            <div key={account.id} className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-3 bg-indigo-500/10 rounded-lg">
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
                <div className="flex gap-2">
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

      {/* Modal de Transação */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-800">
              <h2 className="text-xl font-bold text-white">
                {editingRecord ? 'Editar Transação' : 'Nova Transação'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Tipo *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="INCOME">Receita (Contas a Receber)</option>
                    <option value="EXPENSE">Despesa (Contas a Pagar)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Status *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="PENDING">Pendente</option>
                    <option value="PAID">Pago / Recebido</option>
                    <option value="CANCELLED">Cancelado</option>
                    <option value="OVERDUE">Vencido</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Nº Parcelas</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.totalInstallments}
                    onChange={(e) => setFormData({ ...formData, totalInstallments: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="1"
                  />
                  {!editingRecord && parseInt(formData.totalInstallments) > 1 && (
                    <p className="text-[10px] text-indigo-400 mt-1">
                      Serão criadas {formData.totalInstallments} parcelas de R$ {(parseFloat(formData.amount) / parseInt(formData.totalInstallments) || 0).toFixed(2)}
                    </p>
                  )}
                  {editingRecord && (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Alterar aqui apenas atualiza este registro.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Periodicidade</label>
                  <select
                    value={formData.periodicity}
                    onChange={(e) => setFormData({ ...formData, periodicity: e.target.value as any })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="MONTHLY">Mensal</option>
                    <option value="BIWEEKLY">Quinzenal</option>
                    <option value="WEEKLY">Semanal</option>
                    <option value="CUSTOM">Personalizada</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Descrição *</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex: Honorários processo X"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Valor *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Categoria</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ex: Honorários"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Vencimento *</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Data de Pagamento</label>
                  <input
                    type="date"
                    value={formData.paymentDate}
                    onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Conta Bancária</label>
                  <select
                    value={formData.bankAccountId}
                    onChange={(e) => setFormData({ ...formData, bankAccountId: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Selecione...</option>
                    {bankAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.bankName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Forma de Pagamento</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Selecione...</option>
                    <option value="PIX">PIX</option>
                    <option value="BOLETO">Boleto</option>
                    <option value="TED">TED</option>
                    <option value="DINHEIRO">Dinheiro</option>
                    <option value="CARTAO">Cartão</option>
                  </select>
                </div>
              </div>

              {/* Partes Envolvidas */}
              <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-700 space-y-4">
                <h3 className="text-sm font-medium text-slate-300">Partes Envolvidas (Credores/Devedores)</h3>
                
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-xs text-slate-400 mb-1">Contato</label>
                    <select
                      value={newParty.contactId}
                      onChange={(e) => setNewParty({ ...newParty, contactId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">Selecione...</option>
                      {contacts.map((contact) => (
                        <option key={contact.id} value={contact.id}>
                          {contact.name} ({contact.personType === 'PF' ? contact.cpf : contact.cnpj})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="w-32">
                    <label className="block text-xs text-slate-400 mb-1">Papel</label>
                    <select
                      value={newParty.role}
                      onChange={(e) => setNewParty({ ...newParty, role: e.target.value as 'CREDITOR' | 'DEBTOR' })}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="CREDITOR">Credor</option>
                      <option value="DEBTOR">Devedor</option>
                    </select>
                  </div>

                  <div className="w-24">
                    <label className="block text-xs text-slate-400 mb-1">Valor (Opc)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newParty.amount}
                      onChange={(e) => setNewParty({ ...newParty, amount: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="0.00"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddParty}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium text-sm transition-colors mb-0.5 h-[38px]"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {/* Lista de Partes */}
                {formData.parties.length > 0 && (
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                    {formData.parties.map((party, index) => {
                      const contact = contacts.find(c => c.id === party.contactId);
                      return (
                        <div key={index} className="flex items-center justify-between p-2 bg-slate-800 rounded border border-slate-700">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded font-bold border ${
                              party.role === 'CREDITOR' 
                                ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}>
                              {party.role === 'CREDITOR' ? 'Credor' : 'Devedor'}
                            </span>
                            <span className="text-sm text-slate-200 font-medium">
                              {contact?.name || 'Carregando...'}
                            </span>
                            {party.amount && (
                              <span className="text-xs text-slate-400 ml-1">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(party.amount))}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveParty(index)}
                            className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Observações</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px]"
                  placeholder="Observações adicionais..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors ${
                    submitting ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {submitting ? 'Salvando...' : (editingRecord ? 'Atualizar' : 'Criar')}
                </button>
              </div>
            </form>
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
                <select
                  value={bankFormData.contactId}
                  onChange={(e) => setBankFormData({ ...bankFormData, contactId: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={loadingContacts}
                >
                  <option value="">Nenhum titular</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name} ({contact.personType === 'PF' ? contact.cpf : contact.cnpj})
                    </option>
                  ))}
                </select>
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
                  Cancelar
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
                  <select value={installmentData.periodicity} onChange={e => setInstallmentData({...installmentData, periodicity: e.target.value as any})}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                    <option value="MONTHLY">Mensal</option>
                    <option value="BIWEEKLY">Quinzenal</option>
                    <option value="WEEKLY">Semanal</option>
                  </select>
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
                <button type="button" onClick={() => setShowInstallmentModal(false)} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors">Cancelar</button>
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
                    {calcSettleFinalAmount > settlingRecord.amount && (
                      <span className="text-xs px-2 py-1 bg-red-500/10 text-red-400 rounded-full border border-red-500/20">
                        +{formatCurrency(calcSettleFinalAmount - settlingRecord.amount)}
                      </span>
                    )}
                    {calcSettleFinalAmount < settlingRecord.amount && (
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

              {/* Botões */}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowSettleModal(false)} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors">
                  Cancelar
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
    </div>
  );
}
