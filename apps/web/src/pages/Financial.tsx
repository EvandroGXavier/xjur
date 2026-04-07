import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  Fragment,
} from "react";
import {
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfMonth,
  startOfWeek,
  isPast,
} from "date-fns";
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
  Percent,
  Calculator,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Scale,
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
  Bookmark,
  RefreshCw,
} from "lucide-react";
import { api } from "../services/api";
import { toast } from "sonner";
import { HelpModal, useHelpModal } from "../components/HelpModal";
import { helpFinancialBankingHubDetailed } from "../data/helpFinancialBankingHubDetailed";
import { ContactPickerGlobal } from "../components/contacts/ContactPickerGlobal";
import { PaymentConditions } from "./PaymentConditions";
import { InlineTags } from "../components/ui/InlineTags";
import { AdvancedTagFilter } from "../components/ui/AdvancedTagFilter";
import { BankAccountDetails } from "../components/financial/BankAccountDetails";
import { FinancialParties } from "../components/financial/FinancialParties";
import { AttachmentPreview } from "../components/ui/AttachmentPreview";
import { DateRangePicker } from "../components/ui/DateRangePicker";
import { useNavigate } from "react-router-dom";
import { useHotkeys } from "../hooks/useHotkeys";
import { clsx } from "clsx";

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
  origin?: "MANUAL" | "NF" | "COMPRA" | "PROPOSTA" | "JUDICIAL";
  metadata?: any;
  // Parcelamento
  parentId?: string;
  installmentNumber?: number;
  totalInstallments?: number;
  periodicity?: string;
  isResidual?: boolean;
  children?: FinancialRecord[];
  processId?: string;
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

interface ProcessOption {
  id: string;
  code?: string | null;
  title?: string | null;
  cnj?: string | null;
  status?: string | null;
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

interface BankIntegration {
  id: string;
  displayName: string;
  provider: "INTER";
  environment: "SANDBOX" | "PRODUCTION";
  status: string;
  isActive: boolean;
  webhookEnabled: boolean;
  webhookUrl?: string | null;
  externalAccountId?: string | null;
  accountHolderDocument?: string | null;
  accountHolderName?: string | null;
  branchCode?: string | null;
  accountNumber?: string | null;
  metadata?: Record<string, any> | null;
  lastSyncAt?: string | null;
  lastHealthcheckAt?: string | null;
  lastHealthcheckStatus?: string | null;
  lastHealthcheckError?: string | null;
  bankAccountId?: string | null;
  bankAccount?: {
    id: string;
    title: string;
    bankName: string;
    balance: number;
  } | null;
  syncJobs?: Array<{
    id: string;
    jobType: string;
    status: string;
    startedAt?: string | null;
    finishedAt?: string | null;
  }>;
  _count?: {
    bankTransactions: number;
    reconciliations: number;
    webhookEvents: number;
  };
}

interface BankTransaction {
  id: string;
  bankIntegrationId: string;
  externalTransactionId: string;
  direction: "IN" | "OUT";
  entryType: string;
  status: string;
  occurredAt: string;
  postedAt?: string | null;
  amount: number;
  feeAmount?: number | null;
  description: string;
  counterpartyName?: string | null;
  counterpartyDocument?: string | null;
  txid?: string | null;
  endToEndId?: string | null;
  bankAccount?: {
    id: string;
    title: string;
    bankName: string;
  } | null;
  reconciliations?: Array<{
    id: string;
    matchType: string;
    financialRecord?: {
      id: string;
      description: string;
      amount: number;
      dueDate: string;
      status: string;
      type: string;
    } | null;
  }>;
}

interface BankingHealthcheckResult {
  success: boolean;
  mode: "MOCK" | "LIVE";
  configured: boolean;
  checks: Array<{
    key: string;
    label: string;
    status: "success" | "warning" | "error";
    details: string;
  }>;
  message: string;
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

interface AdvancedFinancialFilters {
  categoryId: string;
  bankAccountId: string;
  contactId: string;
  origin: string;
  paymentMethod: string;
  amountMin: string;
  amountMax: string;
  createdFrom: string;
  createdTo: string;
  dueFrom: string;
  dueTo: string;
  paymentFrom: string;
  paymentTo: string;
  onlyWithAttachments: boolean;
  onlyWithSplits: boolean;
}

interface CardMetric {
  amount: number;
  count: number;
}

type CardFilter =
  | "ALL"
  | "INCOME_ALL"
  | "INCOME_PENDING"
  | "INCOME_OVERDUE"
  | "EXPENSE_ALL"
  | "EXPENSE_PENDING"
  | "EXPENSE_OVERDUE";

const EMPTY_ADVANCED_FILTERS: AdvancedFinancialFilters = {
  categoryId: "",
  bankAccountId: "",
  contactId: "",
  origin: "",
  paymentMethod: "",
  amountMin: "",
  amountMax: "",
  createdFrom: "",
  createdTo: "",
  dueFrom: "",
  dueTo: "",
  paymentFrom: "",
  paymentTo: "",
  onlyWithAttachments: false,
  onlyWithSplits: false,
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const PARTY_ROLE_META: Record<
  string,
  { label: string; short: string; className: string; order: number }
> = {
  CREDITOR: {
    label: "Credor",
    short: "C",
    className: "bg-emerald-500/15 text-emerald-400",
    order: 1,
  },
  DEBTOR: {
    label: "Devedor",
    short: "D",
    className: "bg-red-500/15 text-red-400",
    order: 2,
  },
  PAYER: {
    label: "Pagador",
    short: "P",
    className: "bg-blue-500/15 text-blue-400",
    order: 3,
  },
  BENEFICIARY: {
    label: "Beneficiario",
    short: "B",
    className: "bg-violet-500/15 text-violet-400",
    order: 4,
  },
  GUARANTOR: {
    label: "Fiador",
    short: "F",
    className: "bg-amber-500/15 text-amber-400",
    order: 5,
  },
  WITNESS: {
    label: "Testemunha",
    short: "T",
    className: "bg-slate-500/15 text-slate-300",
    order: 6,
  },
};

const getPartyRoleMeta = (role: string) => {
  return (
    PARTY_ROLE_META[role] || {
      label: role || "Parte",
      short: role?.slice(0, 1)?.toUpperCase() || "?",
      className: "bg-slate-500/15 text-slate-300",
      order: 99,
    }
  );
};

const getRecordAmount = (record: FinancialRecord) =>
  Number(record.amountFinal ?? record.amount ?? 0);

const getNormalizedDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

const getEffectiveRecordStatus = (
  record: FinancialRecord,
  referenceDate = new Date(),
) => {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  if (record.status === "PAID" || record.status === "CANCELLED") {
    return record.status;
  }

  const dueDate = getNormalizedDate(record.dueDate);

  if (dueDate && dueDate.getTime() < today.getTime()) {
    return "OVERDUE";
  }

  return record.status === "PARTIAL" ? "PARTIAL" : "PENDING";
};

const isOpenRecord = (record: FinancialRecord, referenceDate = new Date()) => {
  const effectiveStatus = getEffectiveRecordStatus(record, referenceDate);
  return (
    effectiveStatus === "PENDING" ||
    effectiveStatus === "PARTIAL" ||
    effectiveStatus === "OVERDUE"
  );
};

const hasPartiesToSettle = (record: FinancialRecord) => {
  const hasCreditor = record.parties?.some((p) => p.role === "CREDITOR");
  const hasDebtor = record.parties?.some((p) => p.role === "DEBTOR");
  return !!(hasCreditor && hasDebtor);
};

const matchesDateRange = (
  value: string | undefined,
  from?: string,
  to?: string,
) => {
  if (!from && !to) {
    return true;
  }

  const targetDate = getNormalizedDate(value);
  if (!targetDate) {
    return false;
  }

  const start = from ? getNormalizedDate(from) : null;
  const end = to ? getNormalizedDate(to) : null;

  if (start && isBefore(targetDate, start)) {
    return false;
  }

  if (end && isAfter(targetDate, end)) {
    return false;
  }

  return true;
};

const matchesCardFilter = (
  record: FinancialRecord,
  cardFilter: CardFilter,
  referenceDate = new Date(),
) => {
  const effectiveStatus = getEffectiveRecordStatus(record, referenceDate);

  switch (cardFilter) {
    case "INCOME_ALL":
      return record.type === "INCOME";
    case "INCOME_PENDING":
      return (
        record.type === "INCOME" &&
        (effectiveStatus === "PENDING" || effectiveStatus === "PARTIAL")
      );
    case "INCOME_OVERDUE":
      return record.type === "INCOME" && effectiveStatus === "OVERDUE";
    case "EXPENSE_ALL":
      return record.type === "EXPENSE";
    case "EXPENSE_PENDING":
      return (
        record.type === "EXPENSE" &&
        (effectiveStatus === "PENDING" || effectiveStatus === "PARTIAL")
      );
    case "EXPENSE_OVERDUE":
      return record.type === "EXPENSE" && effectiveStatus === "OVERDUE";
    case "ALL":
    default:
      return true;
  }
};

type FinancialProcessContext = {
  id: string;
  code?: string;
  title?: string;
  cnj?: string;
};

type FinancialProps = {
  processContext?: FinancialProcessContext;
};

export function Financial(props: FinancialProps = {}) {
  const navigate = useNavigate();
  const { isHelpOpen, setIsHelpOpen } = useHelpModal();
  const containerRef = useRef<HTMLDivElement>(null);
  const lockedProcessId = props.processContext?.id;
  const isEmbeddedInProcess = Boolean(lockedProcessId);
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankIntegrations, setBankIntegrations] = useState<BankIntegration[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [reconcileRecords, setReconcileRecords] = useState<FinancialRecord[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<
    "dashboard" | "records" | "accounts" | "conditions" | "banking"
  >("records");
  const [searchTerm, setSearchTerm] = useState("");

  useHotkeys({
    onNew: () => handleOpenModal(),
    onCancel: () => {
      if (showModal) setShowModal(false);
      if (showBankModal) setShowBankModal(false);
      if (showIntegrationModal) setShowIntegrationModal(false);
      if (showReconcileModal) setShowReconcileModal(false);
      if (showSettleModal) setShowSettleModal(false);
      if (showConditionSubModal) setShowConditionSubModal(false);
    },
    onPrint: () => window.print(),
  });

  const [showModal, setShowModal] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [showIntegrationModal, setShowIntegrationModal] = useState(false);
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [selectedBankAccount, setSelectedBankAccount] =
    useState<BankAccount | null>(null);
  const [editingIntegration, setEditingIntegration] =
    useState<BankIntegration | null>(null);
  const [selectedBankTransaction, setSelectedBankTransaction] =
    useState<BankTransaction | null>(null);
  const [lastHealthcheck, setLastHealthcheck] =
    useState<BankingHealthcheckResult | null>(null);
  const [settlingRecord, setSettlingRecord] = useState<FinancialRecord | null>(
    null,
  );
  const [editingRecord, setEditingRecord] = useState<FinancialRecord | null>(
    null,
  );
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const parseAmountPtBr = (raw: string) => {
    const normalized = String(raw || "")
      .trim()
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : NaN;
  };

  const formatAmountPtBr = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [processOptions, setProcessOptions] = useState<ProcessOption[]>([]);
  const [processSearch, setProcessSearch] = useState("");
  const [loadingProcesses, setLoadingProcesses] = useState(false);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [modalTab, setModalTab] = useState<"dados" | "partes">("dados");
  const [paymentConditions, setPaymentConditions] = useState<any[]>([]);
  const [installments, setInstallments] = useState<
    { dueDate: string; amount: number; installmentNumber: number }[]
  >([]);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const [nxInput, setNxInput] = useState("");
  const [showConditionSubModal, setShowConditionSubModal] = useState(false);
  const [pastedImages, setPastedImages] = useState<
    { url: string; file: File }[]
  >([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [savedAttachmentUrls, setSavedAttachmentUrls] = useState<
    Record<string, string>
  >({});
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const [filters, setFilters] = useState({
    type: "",
    status: "",
    category: "",
  });

  const [advancedFilters, setAdvancedFilters] =
    useState<AdvancedFinancialFilters>(EMPTY_ADVANCED_FILTERS);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [activeCardFilter, setActiveCardFilter] = useState<CardFilter>("ALL");

  const revokeSavedAttachmentUrls = useCallback(() => {
    setSavedAttachmentUrls((current) => {
      Object.values(current).forEach((url) => URL.revokeObjectURL(url));
      return {};
    });
  }, []);

  const preloadSavedAttachments = useCallback(
    async (record: FinancialRecord) => {
      const savedAttachments = record.metadata?.attachments;

      revokeSavedAttachmentUrls();

      if (!Array.isArray(savedAttachments) || savedAttachments.length === 0) {
        return;
      }

      try {
        const entries = await Promise.all(
          savedAttachments.map(async (att: any) => {
            const response = await api.get(
              "/financial/records/" +
                record.id +
                "/attachments/" +
                encodeURIComponent(att.fileName),
              { responseType: "blob" },
            );

            return [att.fileName, URL.createObjectURL(response.data)] as const;
          }),
        );

        setSavedAttachmentUrls(Object.fromEntries(entries));
      } catch (error) {
        console.error("Erro ao carregar anexos salvos:", error);
        toast.error("Erro ao carregar anexos salvos");
      }
    },
    [revokeSavedAttachmentUrls],
  );

  useEffect(() => {
    if (!showModal) {
      revokeSavedAttachmentUrls();
    }
  }, [showModal, revokeSavedAttachmentUrls]);

  useEffect(
    () => () => {
      revokeSavedAttachmentUrls();
    },
    [revokeSavedAttachmentUrls],
  );

  const [tagFilters, setTagFilters] = useState<{
    included: string[];
    excluded: string[];
  }>({ included: [], excluded: [] });
  const [sortConfig, setSortConfig] = useState<{
    key: string | null;
    direction: "asc" | "desc" | null;
  }>({ key: null, direction: null });

  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    dueDate: "",
    paymentDate: "",
    status: "PENDING",
    type: "INCOME",
    category: "",
    categoryId: "",
    paymentMethod: "",
    bankAccountId: "",
    processId: "",
    notes: "",
    // Encargos
    fine: "",
    interest: "",
    monetaryCorrection: "",
    discount: "",
    discountType: "VALUE" as "VALUE" | "PERCENTAGE",
    // Parcelamento
    totalInstallments: "1",
    periodicity: "Mensal",
    paymentConditionId: "",
    origin: "MANUAL",
    // Seções colapsáveis
    showCharges: false,
    parties: [] as { contactId: string; role: string; amount?: number }[],
    splits: [] as {
      contactId: string;
      role: string;
      amount: number;
      percentage?: number;
      description?: string;
    }[],
  });

  const [settleData, setSettleData] = useState({
    paymentDate: new Date().toISOString().split("T")[0],
    fine: "",
    finePercent: "",
    interest: "",
    interestPercent: "",
    monetaryCorrection: "",
    monetaryCorrectionPercent: "",
    discount: "",
    discountPercent: "",
    discountType: "VALUE" as "VALUE" | "PERCENTAGE",
    paymentMethod: "",
    bankAccountId: "",
    notes: "",
  });

  const [settleFinalOverride, setSettleFinalOverride] = useState<string>("");
  const [settleAttachments, setSettleAttachments] = useState<File[]>([]);
  const [settlePastedImages, setSettlePastedImages] = useState<
    { name: string; url: string }[]
  >([]);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [showCategoryInput, setShowCategoryInput] = useState(false);

  const [bankFormData, setBankFormData] = useState({
    title: "",
    bankName: "",
    accountType: "CHECKING",
    accountNumber: "",
    agency: "",
    balance: "",
    contactId: "",
    notes: "",
  });

  const [integrationFormData, setIntegrationFormData] = useState({
    displayName: "",
    environment: "SANDBOX" as "SANDBOX" | "PRODUCTION",
    bankAccountId: "",
    externalAccountId: "",
    accountHolderDocument: "",
    accountHolderName: "",
    branchCode: "",
    accountNumber: "",
    webhookEnabled: false,
    webhookUrl: "",
    clientId: "",
    clientSecret: "",
    certificatePassword: "",
    certificateBase64: "",
    webhookSecret: "",
    tokenUrl: "",
  });

  const [reconcileFormData, setReconcileFormData] = useState({
    financialRecordId: "",
    matchType: "MANUAL",
    notes: "",
  });

  const [newSplit, setNewSplit] = useState({
    contactId: "",
    role: "CREDITOR" as "CREDITOR" | "DEBTOR",
    amount: "",
    percentage: "",
    description: "",
  });

  const handleAddSplit = () => {
    if (!newSplit.contactId) {
      toast.error("Selecione um contato");
      return;
    }
    if (!newSplit.amount || parseFloat(newSplit.amount) <= 0) {
      toast.error("Informe o valor do rateio");
      return;
    }
    setFormData({
      ...formData,
      splits: [
        ...formData.splits,
        {
          contactId: newSplit.contactId,
          role: newSplit.role,
          amount: parseFloat(newSplit.amount),
          percentage: newSplit.percentage
            ? parseFloat(newSplit.percentage)
            : undefined,
          description: newSplit.description || undefined,
        },
      ],
    });
    setNewSplit({
      contactId: "",
      role: "CREDITOR",
      amount: "",
      percentage: "",
      description: "",
    });
  };

  const handleRemoveSplit = (index: number) => {
    const s = [...formData.splits];
    s.splice(index, 1);
    setFormData({ ...formData, splits: s });
  };

  const splitsTotal = formData.splits.reduce((sum, s) => sum + s.amount, 0);

  const calculatePreviewFinal = () => {
    let total = parseAmountPtBr(formData.amount) || 0;
    if (formData.fine) total += parseFloat(formData.fine) || 0;
    if (formData.interest) total += parseFloat(formData.interest) || 0;
    if (formData.monetaryCorrection)
      total += parseFloat(formData.monetaryCorrection) || 0;
    if (formData.discount) {
      const d = parseFloat(formData.discount) || 0;
      if (formData.discountType === "PERCENTAGE") total -= total * (d / 100);
      else total -= d;
    }
    return Math.max(0, Math.round(total * 100) / 100);
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const res = await api.post("/financial/categories", {
        name: newCategoryName.trim(),
        type: formData.type === "INCOME" ? "INCOME" : "EXPENSE",
      });
      setCategories((prev) => [...prev, res.data]);
      setFormData({
        ...formData,
        categoryId: res.data.id,
        category: res.data.name,
      });
      setNewCategoryName("");
      setShowCategoryInput(false);
      toast.success("Categoria criada");
    } catch {
      toast.error("Erro ao criar categoria");
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get("/financial/categories");
      setCategories(res.data);
    } catch (e) {
      console.error("Erro ao carregar categorias:", e);
    }
  };

  const fetchPaymentConditions = async () => {
    try {
      const res = await api.get("/payment-conditions");
      setPaymentConditions(res.data);
    } catch (e) {
      console.error("Erro ao carregar condições de pagamento:", e);
    }
  };

  const generateInstallments = (
    conditionId: string,
    totalAmount: number,
    firstDueDate: string,
  ) => {
    const condition = paymentConditions.find((c) => c.id === conditionId);
    if (!condition || !totalAmount || !firstDueDate) {
      setInstallments([]);
      return;
    }

    const insts: {
      dueDate: string;
      amount: number;
      installmentNumber: number;
    }[] = [];
    const baseDate = new Date(firstDueDate);

    condition.installments.forEach((inst: any, idx: number) => {
      const dueDate = new Date(baseDate);
      dueDate.setDate(dueDate.getDate() + (inst.days || 0));

      insts.push({
        dueDate: dueDate.toISOString().split("T")[0],
        amount: Math.round(totalAmount * (inst.percentage / 100) * 100) / 100,
        installmentNumber: inst.installmentNumber || idx + 1,
      });
    });

    setInstallments(insts);
  };

  useEffect(() => {
    if (formData.paymentConditionId && formData.amount && formData.dueDate) {
      generateInstallments(
        formData.paymentConditionId,
        parseAmountPtBr(formData.amount),
        formData.dueDate,
      );
    } else {
      setInstallments([]);
    }
  }, [
    formData.paymentConditionId,
    formData.amount,
    formData.dueDate,
    paymentConditions,
  ]);

  // === Nx Shortcut: digitar "3x" gera 3 parcelas iguais mensais ===
  const handleNxInput = (value: string) => {
    setNxInput(value);
    const match = value.match(/^(\d+)\s*[xX]$/);
    if (match && formData.amount && formData.dueDate) {
      const n = parseInt(match[1]);
      if (n >= 2 && n <= 120) {
        const totalAmount = parseAmountPtBr(formData.amount);
        const instAmount = Math.floor((totalAmount / n) * 100) / 100;
        const remainder =
          Math.round((totalAmount - instAmount * n) * 100) / 100;
        const baseDate = new Date(formData.dueDate);
        const insts: {
          dueDate: string;
          amount: number;
          installmentNumber: number;
        }[] = [];
        for (let i = 0; i < n; i++) {
          const d = new Date(baseDate);
          d.setMonth(d.getMonth() + i);
          insts.push({
            dueDate: d.toISOString().split("T")[0],
            amount: i === n - 1 ? instAmount + remainder : instAmount,
            installmentNumber: i + 1,
          });
        }
        setInstallments(insts);
        setFormData((prev) => ({
          ...prev,
          paymentConditionId: "",
          totalInstallments: n.toString(),
        }));
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
      if (items[i].type.startsWith("image/")) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          const url = URL.createObjectURL(file);
          setPastedImages((prev) => [...prev, { url, file }]);
          toast.success("Imagem colada com sucesso!");
        }
        break;
      }
    }
  };

  const toggleRowExpand = (id: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
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
    if (settleFinalOverride !== "") {
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

  const handleSettlePercentChange = (
    field:
      | "finePercent"
      | "interestPercent"
      | "monetaryCorrectionPercent"
      | "discountPercent",
    value: string,
  ) => {
    if (!settlingRecord) return;
    const pct = parseFloat(value) || 0;
    const base = Number(settlingRecord.amount);
    const calcVal = Math.round(base * (pct / 100) * 100) / 100;
    const valueField = field.replace("Percent", "") as
      | "fine"
      | "interest"
      | "monetaryCorrection"
      | "discount";
    setSettleFinalOverride(""); // Limpar override ao mudar encargos
    setSettleData({
      ...settleData,
      [field]: value,
      [valueField]: calcVal > 0 ? calcVal.toString() : "",
    });
  };

  const handleSettleValueChange = (
    field: "fine" | "interest" | "monetaryCorrection" | "discount",
    value: string,
  ) => {
    if (!settlingRecord) return;
    const val = parseFloat(value) || 0;
    const base = Number(settlingRecord.amount);
    const pct = base > 0 ? Math.round((val / base) * 10000) / 100 : 0;
    const pctField = `${field}Percent` as
      | "finePercent"
      | "interestPercent"
      | "monetaryCorrectionPercent"
      | "discountPercent";
    setSettleFinalOverride(""); // Limpar override ao mudar encargos
    setSettleData({
      ...settleData,
      [field]: value,
      [pctField]: pct > 0 ? pct.toString() : "",
    });
  };

  const handleSettleFinalOverride = (value: string) => {
    setSettleFinalOverride(value);
  };

  const handleSettlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const url = URL.createObjectURL(file);
          const name = `imagem_colada_${settlePastedImages.length + 1}.png`;
          setSettlePastedImages((prev) => [...prev, { name, url }]);
          // Também adicionar como anexo
          setSettleAttachments((prev) => [
            ...prev,
            new File([file], name, { type: file.type }),
          ]);
          toast.success("Imagem colada com sucesso!");
        }
      }
    }
  };

  const handleSettleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles = Array.from(files);
    setSettleAttachments((prev) => [...prev, ...newFiles]);
    toast.success(`${newFiles.length} arquivo(s) anexado(s)`);
    e.target.value = ""; // Reset input
  };

  const removeSettleAttachment = (index: number) => {
    setSettleAttachments((prev) => prev.filter((_, i) => i !== index));
    // Remover imagem colada correspondente se houver
    const file = settleAttachments[index];
    if (file) {
      setSettlePastedImages((prev) =>
        prev.filter((img) => img.name !== file.name),
      );
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isSettleFormValid = useMemo(() => {
    const hasParties = settlingRecord ? hasPartiesToSettle(settlingRecord) : false;
    return (
      settleData.paymentDate !== "" &&
      settleData.paymentMethod !== "" &&
      settleData.bankAccountId !== "" &&
      calcSettleFinalAmount > 0 &&
      hasParties
    );
  }, [settleData, calcSettleFinalAmount, settlingRecord]);

  const handleOpenSettleModal = async (record: FinancialRecord) => {

    let fullRecord: FinancialRecord = record;
    try {
      const response = await api.get(`/financial/records/${record.id}`);
      fullRecord = response.data;
    } catch (error) {
      console.error("Erro ao carregar registro financeiro para liquidação:", error);
    }

    setSettlingRecord(fullRecord);

    const today = new Date().toISOString().split("T")[0];
    const due = new Date(fullRecord.dueDate);
    const todayDate = new Date(today);
    due.setHours(0, 0, 0, 0);
    todayDate.setHours(0, 0, 0, 0);
    const daysLate = Math.floor(
      (todayDate.getTime() - due.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Auto-aplicar multa 2% e juros 1%/mês se atrasado (pode ser editado)
    let autoFine = "";
    let autoFinePercent = "";
    let autoInterest = "";
    let autoInterestPercent = "";
    if (daysLate > 0) {
      const fineP = 2; // Multa padrão 2%
      autoFinePercent = fineP.toString();
      autoFine = ((Number(fullRecord.amount) * fineP) / 100).toFixed(2);
      const months = Math.max(1, Math.ceil(daysLate / 30));
      const interestP = months; // 1% ao mês
      autoInterestPercent = interestP.toString();
      autoInterest = ((Number(fullRecord.amount) * interestP) / 100).toFixed(2);
    }

    setSettleFinalOverride("");
    setSettleAttachments([]);
    setSettlePastedImages([]);
    setSettleData({
      paymentDate: today,
      fine: autoFine,
      finePercent: autoFinePercent,
      interest: autoInterest,
      interestPercent: autoInterestPercent,
      monetaryCorrection: "",
      monetaryCorrectionPercent: "",
      discount: "",
      discountPercent: "",
      discountType: "VALUE",
      paymentMethod: fullRecord.paymentMethod || "",
      bankAccountId: fullRecord.bankAccount?.id || "",
      notes: "",
    });
    setShowSettleModal(true);
  };

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingRecord) return;

    // Validações obrigatórias com feedback
    if (!settleData.paymentDate) {
      toast.error("Data de Pagamento é obrigatória");
      return;
    }
    if (!settleData.paymentMethod) {
      toast.error("Forma de Pagamento é obrigatória");
      return;
    }
    if (!settleData.bankAccountId) {
      toast.error("Conta Bancária é obrigatória");
      return;
    }
    if (calcSettleFinalAmount <= 0) {
      toast.error("Valor Total deve ser maior que zero");
      return;
    }

    setSubmitting(true);
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const tenantId = user.tenantId || "default-tenant-id";

      const payload: any = {
        tenantId,
        paymentDate: settleData.paymentDate,
        amountFinal: calcSettleFinalAmount,
      };
      if (settleData.fine) payload.fine = parseFloat(settleData.fine);
      if (settleData.interest)
        payload.interest = parseFloat(settleData.interest);
      if (settleData.monetaryCorrection)
        payload.monetaryCorrection = parseFloat(settleData.monetaryCorrection);
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
        Object.keys(payload).forEach((key) => {
          formData.append(key, String(payload[key]));
        });
        settleAttachments.forEach((file) => {
          formData.append("attachments", file);
        });
        await api.post(
          `/financial/records/${settlingRecord.id}/settle`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          },
        );
      } else {
        await api.post(
          `/financial/records/${settlingRecord.id}/settle`,
          payload,
        );
      }

      toast.success("Registro liquidado com sucesso!");
      setShowSettleModal(false);
      // Limpar URLs de imagens coladas
      settlePastedImages.forEach((img) => URL.revokeObjectURL(img.url));
      await fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Erro ao liquidar");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchCategories();
  }, [view]);

  useEffect(() => {
    if (!showModal) return;
    if (isEmbeddedInProcess) return;
    const handle = window.setTimeout(() => {
      fetchProcesses(processSearch);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [showModal, processSearch, isEmbeddedInProcess]);

  const fetchData = async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const tenantId = user.tenantId || "default-tenant-id";
      const processId = lockedProcessId;

      if (view === "dashboard" || view === "records") {
        const [dashboardRes, recordsRes, accountsRes] = await Promise.all([
          api.get(`/financial/dashboard?tenantId=${tenantId}${processId ? `&processId=${processId}` : ""}`),
          api.get(`/financial/records?tenantId=${tenantId}${processId ? `&processId=${processId}` : ""}`),
          api.get(`/financial/bank-accounts?tenantId=${tenantId}`),
        ]);
        setDashboard(dashboardRes.data);
        setRecords(recordsRes.data);
        setBankAccounts(accountsRes.data);
      } else if (view === "accounts") {
        const accountsRes = await api.get(
          `/financial/bank-accounts?tenantId=${tenantId}`,
        );
        setBankAccounts(accountsRes.data);
      } else if (view === "banking") {
        const [accountsRes, integrationsRes, transactionsRes, recordsRes] =
          await Promise.all([
            api.get(`/financial/bank-accounts?tenantId=${tenantId}`),
            api.get("/banking/integrations"),
            api.get("/banking/transactions"),
            api.get(
              `/financial/records?tenantId=${tenantId}&showInstallments=false`,
            ),
          ]);

        setBankAccounts(accountsRes.data);
        setBankIntegrations(integrationsRes.data);
        setBankTransactions(transactionsRes.data);
        setReconcileRecords(
          Array.isArray(recordsRes.data)
            ? recordsRes.data.filter((record: FinancialRecord) =>
                ["PENDING", "PARTIAL", "OVERDUE"].includes(record.status),
              )
            : [],
        );
      }
    } catch (error) {
      toast.error("Erro ao carregar dados financeiros");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async () => {
    setLoadingContacts(true);
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const tenantId = user.tenantId || "default-tenant-id";
      const response = await api.get(
        `/financial/contacts?tenantId=${tenantId}`,
      );
      setContacts(response.data);
    } catch (error) {
      console.error("Erro ao carregar contatos:", error);
    } finally {
      setLoadingContacts(false);
    }
  };

  const fetchProcesses = async (search?: string) => {
    setLoadingProcesses(true);
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const tenantId = user.tenantId || "default-tenant-id";
      const response = await api.get(`/financial/processes?tenantId=${tenantId}`, {
        params: { search: search?.trim() || undefined },
      });
      setProcessOptions(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Erro ao carregar processos:", error);
    } finally {
      setLoadingProcesses(false);
    }
  };

  const handleOpenModal = async (record?: FinancialRecord) => {
    setModalTab("dados");
    await fetchContacts();
    await fetchCategories();

    if (record) {
      let fullRecord: FinancialRecord = record;
      try {
        const response = await api.get(`/financial/records/${record.id}`);
        fullRecord = response.data;
      } catch (error) {
        console.error("Erro ao carregar registro financeiro:", error);
      }

      setEditingRecord(fullRecord);
      setFormData({
        description: fullRecord.description,
        amount: fullRecord.amount.toString(),
        dueDate: fullRecord.dueDate.split("T")[0],
        paymentDate: fullRecord.paymentDate ? fullRecord.paymentDate.split("T")[0] : "",
        status: fullRecord.status,
        type: fullRecord.type,
        category: fullRecord.category || "",
        categoryId: fullRecord.categoryId || "",
        paymentMethod: fullRecord.paymentMethod || "",
        bankAccountId: fullRecord.bankAccount?.id || "",
        processId: lockedProcessId || fullRecord.processId || fullRecord.process?.id || "",
        notes: fullRecord.notes || "",
        fine: fullRecord.fine ? fullRecord.fine.toString() : "",
        interest: fullRecord.interest ? fullRecord.interest.toString() : "",
        monetaryCorrection: fullRecord.monetaryCorrection
          ? fullRecord.monetaryCorrection.toString()
          : "",
        discount: fullRecord.discount ? fullRecord.discount.toString() : "",
        discountType:
          (fullRecord.discountType as "VALUE" | "PERCENTAGE") || "VALUE",
        totalInstallments: fullRecord.totalInstallments
          ? fullRecord.totalInstallments.toString()
          : "1",
        periodicity: fullRecord.periodicity || "Mensal",
        paymentConditionId: "",
        origin: (fullRecord as any).origin || "MANUAL",
        showCharges: !!(
          fullRecord.fine ||
          fullRecord.interest ||
          fullRecord.monetaryCorrection ||
          fullRecord.discount
        ),
        parties:
          fullRecord.parties?.map((p) => ({
            contactId: p.contactId,
            role: p.role,
            amount: p.amount ? Number(p.amount) : undefined,
          })) || [],
        splits:
          fullRecord.splits?.map((s) => ({
            contactId: s.contactId,
            role: s.role,
            amount: Number(s.amount),
            percentage: s.percentage ? Number(s.percentage) : undefined,
            description: s.description,
          })) || [],
      });
      setInstallments([]);
      setNxInput("");
      await preloadSavedAttachments(fullRecord);
    } else {
      setEditingRecord(null);
      setFormData({
        description: "",
        amount: "",
        dueDate: new Date().toISOString().split("T")[0],
        paymentDate: "",
        status: "PENDING",
        type: "INCOME",
        category: "",
        categoryId: "",
        paymentMethod: "",
        bankAccountId: "",
        processId: lockedProcessId || "",
        notes: "",
        fine: "",
        interest: "",
        monetaryCorrection: "",
        discount: "",
        discountType: "VALUE",
        totalInstallments: "1",
        periodicity: "Mensal",
        paymentConditionId: "",
        origin: "MANUAL",
        showCharges: false,
        parties: [],
        splits: [],
      });
      setInstallments([]);
      setNxInput("");
      revokeSavedAttachmentUrls();
    }
    setPastedImages([]);
    setAttachments([]);
    setProcessSearch("");
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
        accountNumber: account.accountNumber || "",
        agency: account.agency || "",
        balance: account.balance.toString(),
        contactId: account.contact?.id || "",
        notes: "",
      });
    } else {
      setEditingBank(null);
      setBankFormData({
        title: "",
        bankName: "",
        accountType: "CHECKING",
        accountNumber: "",
        agency: "",
        balance: "0",
        contactId: "",
        notes: "",
      });
    }
    setShowBankModal(true);
  };

  const handleOpenIntegrationModal = (integration?: BankIntegration) => {
    setLastHealthcheck(null);

    if (integration) {
      setEditingIntegration(integration);
      setIntegrationFormData({
        displayName: integration.displayName,
        environment: integration.environment || "SANDBOX",
        bankAccountId: integration.bankAccountId || "",
        externalAccountId: integration.externalAccountId || "",
        accountHolderDocument: integration.accountHolderDocument || "",
        accountHolderName: integration.accountHolderName || "",
        branchCode: integration.branchCode || "",
        accountNumber: integration.accountNumber || "",
        webhookEnabled: Boolean(integration.webhookEnabled),
        webhookUrl: integration.webhookUrl || "",
        clientId: "",
        clientSecret: "",
        certificatePassword: "",
        certificateBase64: "",
        webhookSecret: "",
        tokenUrl: "",
      });
    } else {
      setEditingIntegration(null);
      setIntegrationFormData({
        displayName: "Banco Inter",
        environment: "SANDBOX",
        bankAccountId: "",
        externalAccountId: "",
        accountHolderDocument: "",
        accountHolderName: "",
        branchCode: "",
        accountNumber: "",
        webhookEnabled: false,
        webhookUrl: "",
        clientId: "",
        clientSecret: "",
        certificatePassword: "",
        certificateBase64: "",
        webhookSecret: "",
        tokenUrl: "",
      });
    }

    setShowIntegrationModal(true);
  };

  const handleSubmitIntegration = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!integrationFormData.displayName.trim()) {
      toast.error("Informe o nome da integração bancária");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        displayName: integrationFormData.displayName.trim(),
        provider: "INTER",
        environment: integrationFormData.environment,
        bankAccountId: integrationFormData.bankAccountId || undefined,
        externalAccountId: integrationFormData.externalAccountId || undefined,
        accountHolderDocument:
          integrationFormData.accountHolderDocument || undefined,
        accountHolderName: integrationFormData.accountHolderName || undefined,
        branchCode: integrationFormData.branchCode || undefined,
        accountNumber: integrationFormData.accountNumber || undefined,
        webhookEnabled: integrationFormData.webhookEnabled,
        webhookUrl: integrationFormData.webhookUrl || undefined,
        credentials: {
          clientId: integrationFormData.clientId || undefined,
          clientSecret: integrationFormData.clientSecret || undefined,
          certificatePassword:
            integrationFormData.certificatePassword || undefined,
          certificateBase64: integrationFormData.certificateBase64 || undefined,
          webhookSecret: integrationFormData.webhookSecret || undefined,
          tokenUrl: integrationFormData.tokenUrl || undefined,
        },
      };

      if (editingIntegration) {
        await api.patch(`/banking/integrations/${editingIntegration.id}`, payload);
        toast.success("Integração bancária atualizada");
      } else {
        await api.post("/banking/integrations", payload);
        toast.success("Integração bancária criada");
      }

      setShowIntegrationModal(false);
      await fetchData();
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Erro ao salvar integração bancária",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleHealthcheckIntegration = async (integration: BankIntegration) => {
    try {
      const response = await api.post(
        `/banking/integrations/${integration.id}/health`,
      );
      setLastHealthcheck(response.data);
      toast.success("Healthcheck executado");
      await fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao testar integração");
    }
  };

  const handleSyncIntegration = async (integration: BankIntegration) => {
    try {
      const response = await api.post(`/banking/integrations/${integration.id}/sync`, {
        forceMockData: integration.environment === "SANDBOX",
      });

      if (response.data?.success) {
        toast.success(response.data.message || "Sincronização concluída");
      } else {
        toast.error(response.data?.message || "Sincronização não concluída");
      }

      await fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao sincronizar banco");
    }
  };

  const handleDeleteIntegration = async (id: string) => {
    if (!confirm("Deseja realmente excluir esta integração bancária?")) return;

    try {
      await api.delete(`/banking/integrations/${id}`);
      toast.success("Integração bancária excluída");
      await fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao excluir integração");
    }
  };

  const getSuggestedRecords = (transaction: BankTransaction) => {
    const expectedType = transaction.direction === "IN" ? "INCOME" : "EXPENSE";
    const transactionAmount = Math.abs(transaction.amount);
    const transactionDate = parseISO(transaction.occurredAt);

    return reconcileRecords
      .filter(
        (record) =>
          record.type === expectedType &&
          Math.abs(record.amount - transactionAmount) < 0.01,
      )
      .sort((a, b) => {
        const aDiff = Math.abs(
          new Date(a.dueDate).getTime() - transactionDate.getTime(),
        );
        const bDiff = Math.abs(
          new Date(b.dueDate).getTime() - transactionDate.getTime(),
        );
        return aDiff - bDiff;
      })
      .slice(0, 5);
  };

  const handleOpenReconcileModal = (transaction: BankTransaction) => {
    const suggested = getSuggestedRecords(transaction);
    setSelectedBankTransaction(transaction);
    setReconcileFormData({
      financialRecordId: suggested[0]?.id || "",
      matchType: suggested.length > 0 ? "SUGGESTED" : "MANUAL",
      notes: "",
    });
    setShowReconcileModal(true);
  };

  const handleSubmitReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBankTransaction) return;

    if (!reconcileFormData.financialRecordId) {
      toast.error("Selecione um lançamento financeiro para conciliar");
      return;
    }

    setSubmitting(true);
    try {
      await api.post(
        `/banking/transactions/${selectedBankTransaction.id}/reconcile`,
        reconcileFormData,
      );
      toast.success("Transação conciliada");
      setShowReconcileModal(false);
      setSelectedBankTransaction(null);
      await fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao conciliar transação");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (
    e: React.SyntheticEvent,
    opts?: { closeAfterSave?: boolean },
  ) => {
    e.preventDefault();
    const closeAfterSave = opts?.closeAfterSave ?? true;

    // Validações
    if (!formData.description.trim()) {
      toast.error("Preencha a descrição");
      return;
    }

    if (formData.description.trim().length < 3) {
      toast.error("Descrição deve ter pelo menos 3 caracteres");
      return;
    }

    // Validação do amount
    const amount = parseAmountPtBr(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Valor inválido. Digite um valor maior que zero");
      return;
    }

    if (!formData.dueDate) {
      toast.error("Preencha a data de vencimento");
      return;
    }

    if (installments.length > 0) {
      const sum =
        Math.round(
          installments.reduce((acc, inst) => acc + inst.amount, 0) * 100,
        ) / 100;
      const totalAmount = Math.round(amount * 100) / 100;
      if (Math.abs(sum - totalAmount) > 0.01) {
        toast.error(
          `A soma das parcelas (${formatCurrency(sum)}) deve ser igual ao valor total (${formatCurrency(amount)})`,
        );
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
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const tenantId = user.tenantId || "default-tenant-id";

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
        processId: formData.processId,
        notes: formData.notes.trim() || undefined,
        parties:
          !editingRecord && formData.parties.length > 0
            ? formData.parties
            : undefined,
        splits: formData.splits.length > 0 ? formData.splits : undefined,
        totalInstallments:
          installments.length > 0
            ? installments.length
            : parseInt(formData.totalInstallments) || 1,
        installments: installments.length > 0 ? installments : undefined,
        paymentConditionId: formData.paymentConditionId || undefined,
        periodicity: formData.periodicity,
        origin: formData.origin || "MANUAL",
        tenantId,
      };

      // Encargos
      if (formData.fine) payload.fine = parseFloat(formData.fine);
      if (formData.interest) payload.interest = parseFloat(formData.interest);
      if (formData.monetaryCorrection)
        payload.monetaryCorrection = parseFloat(formData.monetaryCorrection);
      if (formData.discount) {
        payload.discount = parseFloat(formData.discount);
        payload.discountType = formData.discountType;
      }

      let createdOrUpdatedRecordId = editingRecord?.id;

      if (editingRecord) {
        await api.put(
          `/financial/records/${editingRecord.id}?tenantId=${tenantId}`,
          payload,
        );
        toast.success("Registro atualizado com sucesso");
      } else {
        const response = await api.post("/financial/records", payload);
        createdOrUpdatedRecordId = response.data.id;
        toast.success("Registro criado com sucesso");
      }

      // Se houver anexos novos listados no frontend ('attachments' state array)
      if (attachments.length > 0 && createdOrUpdatedRecordId) {
        const attachFormData = new FormData();
        attachments.forEach((file) =>
          attachFormData.append("attachments", file),
        );
        await api.post(
          `/financial/records/${createdOrUpdatedRecordId}/attachments`,
          attachFormData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          },
        );
      }

      // limpar state de anexos novos
      setAttachments([]);

      await fetchData();
      if (closeAfterSave) setShowModal(false);
    } catch (error: any) {
      console.error("Erro completo:", error);
      const backendMessage = error.response?.data?.message;
      const errorMessage = Array.isArray(backendMessage)
        ? backendMessage.join(", ")
        : typeof backendMessage === "string"
          ? backendMessage
          : "Erro ao salvar registro";

      toast.error(errorMessage, {
        description:
          error.response?.data?.error || "Verifique os dados informados",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validação do título
    if (!bankFormData.title.trim()) {
      toast.error("Preencha o título da conta");
      return;
    }

    if (bankFormData.title.trim().length < 3) {
      toast.error("Título deve ter pelo menos 3 caracteres");
      return;
    }

    // Validação do nome do banco
    if (!bankFormData.bankName.trim()) {
      toast.error("Preencha o nome do banco");
      return;
    }

    if (bankFormData.bankName.trim().length < 3) {
      toast.error("Nome do banco deve ter pelo menos 3 caracteres");
      return;
    }

    // Validação e conversão do balance
    const balanceStr = bankFormData.balance.trim();
    const balance = balanceStr === "" ? 0 : parseFloat(balanceStr);

    if (isNaN(balance)) {
      toast.error("Saldo inválido. Digite um número válido");
      return;
    }

    if (balance < 0) {
      toast.error("Saldo não pode ser negativo");
      return;
    }

    setSubmitting(true);

    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const tenantId = user.tenantId || "default-tenant-id";

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
        await api.put(
          `/financial/bank-accounts/${editingBank.id}?tenantId=${tenantId}`,
          payload,
        );
        toast.success("Conta atualizada com sucesso");
      } else {
        await api.post("/financial/bank-accounts", payload);
        toast.success("Conta criada com sucesso");
      }

      setShowBankModal(false);
      await fetchData();
    } catch (error: any) {
      // Melhor tratamento de erros com mensagem específica do backend
      const errorMessage =
        error.response?.data?.message ||
        (Array.isArray(error.response?.data?.message)
          ? error.response.data.message.join(", ")
          : "Erro ao salvar conta bancária");
      toast.error(errorMessage);
      console.error("Erro completo:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir este registro?")) return;

    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const tenantId = user.tenantId || "default-tenant-id";
      await api.delete(`/financial/records/${id}?tenantId=${tenantId}`);
      toast.success("Registro excluído com sucesso");
      fetchData();
    } catch (error) {
      toast.error("Erro ao excluir registro");
      console.error(error);
    }
  };

  const handleDeleteBank = async (id: string) => {
    if (!confirm("Deseja realmente excluir esta conta bancária?")) return;

    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const tenantId = user.tenantId || "default-tenant-id";
      await api.delete(`/financial/bank-accounts/${id}?tenantId=${tenantId}`);
      toast.success("Conta excluída com sucesso");
      fetchData();
    } catch (error) {
      toast.error("Erro ao excluir conta");
      console.error(error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      PENDING: {
        label: "Pendente",
        className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
      },
      PAID: {
        label: "Pago",
        className: "bg-green-500/10 text-green-400 border-green-500/20",
      },
      PARTIAL: {
        label: "Parcial",
        className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      },
      CANCELLED: {
        label: "Cancelado",
        className: "bg-red-500/10 text-red-400 border-red-500/20",
      },
      OVERDUE: {
        label: "Vencido",
        className: "bg-orange-500/10 text-orange-400 border-orange-500/20",
      },
    };
    const statusInfo = statusMap[status] || {
      label: status,
      className: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    };
    return (
      <span
        className={`px-2 py-1 rounded-md text-xs font-medium border ${statusInfo.className}`}
      >
        {statusInfo.label}
      </span>
    );
  };

  const getTypeBadge = (type: string) => {
    return type === "INCOME" ? (
      <span className="px-2 py-1 rounded-md text-xs font-medium border bg-green-500/10 text-green-400 border-green-500/20">
        Receita
      </span>
    ) : (
      <span className="px-2 py-1 rounded-md text-xs font-medium border bg-red-500/10 text-red-400 border-red-500/20">
        Despesa
      </span>
    );
  };



  const paymentMethods = useMemo(
    () =>
      Array.from(
        new Set(
          records
            .map((record) => record.paymentMethod)
            .filter(Boolean) as string[],
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [records],
  );

  const originOptions = useMemo(
    () =>
      Array.from(
        new Set(
          records.map((record) => record.origin).filter(Boolean) as string[],
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [records],
  );

  const cardMetrics = useMemo(() => {
    const metrics: Record<CardFilter, CardMetric> = {
      ALL: { amount: 0, count: records.length },
      INCOME_ALL: { amount: 0, count: 0 },
      INCOME_PENDING: { amount: 0, count: 0 },
      INCOME_OVERDUE: { amount: 0, count: 0 },
      EXPENSE_ALL: { amount: 0, count: 0 },
      EXPENSE_PENDING: { amount: 0, count: 0 },
      EXPENSE_OVERDUE: { amount: 0, count: 0 },
    };

    records.forEach((record) => {
      const amount = getRecordAmount(record);
      const effectiveStatus = getEffectiveRecordStatus(record);

      metrics.ALL.amount += amount;

      if (record.type === "INCOME") {
        metrics.INCOME_ALL.amount += amount;
        metrics.INCOME_ALL.count += 1;

        if (effectiveStatus === "PENDING" || effectiveStatus === "PARTIAL") {
          metrics.INCOME_PENDING.amount += amount;
          metrics.INCOME_PENDING.count += 1;
        }

        if (effectiveStatus === "OVERDUE") {
          metrics.INCOME_OVERDUE.amount += amount;
          metrics.INCOME_OVERDUE.count += 1;
        }
      }

      if (record.type === "EXPENSE") {
        metrics.EXPENSE_ALL.amount += amount;
        metrics.EXPENSE_ALL.count += 1;

        if (effectiveStatus === "PENDING" || effectiveStatus === "PARTIAL") {
          metrics.EXPENSE_PENDING.amount += amount;
          metrics.EXPENSE_PENDING.count += 1;
        }

        if (effectiveStatus === "OVERDUE") {
          metrics.EXPENSE_OVERDUE.amount += amount;
          metrics.EXPENSE_OVERDUE.count += 1;
        }
      }
    });

    return metrics;
  }, [records]);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return records.filter((record) => {
      const effectiveStatus = getEffectiveRecordStatus(record);
      const recordTagIds = record.tags?.map((tag) => tag.tag?.id) || [];
      const categoryId =
        record.financialCategory?.id || record.categoryId || "";
      const amount = getRecordAmount(record);
      const searchableText = [
        record.description,
        record.notes,
        record.category,
        record.financialCategory?.name,
        record.paymentMethod,
        record.bankAccount?.bankName,
        ...(record.parties?.map((party) => party.contact?.name || "") || []),
        ...(record.tags?.map((tag) => tag.tag?.name || "") || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (normalizedSearch && !searchableText.includes(normalizedSearch)) {
        return false;
      }

      if (!matchesCardFilter(record, activeCardFilter)) {
        return false;
      }

      if (filters.type && record.type !== filters.type) {
        return false;
      }

      if (filters.status && effectiveStatus !== filters.status) {
        return false;
      }

      if (filters.category && categoryId !== filters.category) {
        return false;
      }

      if (
        advancedFilters.categoryId &&
        categoryId !== advancedFilters.categoryId
      ) {
        return false;
      }

      if (
        advancedFilters.bankAccountId &&
        record.bankAccount?.id !== advancedFilters.bankAccountId
      ) {
        return false;
      }

      if (
        advancedFilters.contactId &&
        !record.parties?.some(
          (party) => party.contactId === advancedFilters.contactId,
        )
      ) {
        return false;
      }

      if (advancedFilters.origin && record.origin !== advancedFilters.origin) {
        return false;
      }

      if (
        advancedFilters.paymentMethod &&
        record.paymentMethod !== advancedFilters.paymentMethod
      ) {
        return false;
      }

      if (
        advancedFilters.amountMin &&
        amount < Number(advancedFilters.amountMin)
      ) {
        return false;
      }

      if (
        advancedFilters.amountMax &&
        amount > Number(advancedFilters.amountMax)
      ) {
        return false;
      }

      if (
        !matchesDateRange(
          record.createdAt,
          advancedFilters.createdFrom,
          advancedFilters.createdTo,
        )
      ) {
        return false;
      }

      if (
        !matchesDateRange(
          record.dueDate,
          advancedFilters.dueFrom,
          advancedFilters.dueTo,
        )
      ) {
        return false;
      }

      if (
        !matchesDateRange(
          record.paymentDate,
          advancedFilters.paymentFrom,
          advancedFilters.paymentTo,
        )
      ) {
        return false;
      }

      if (advancedFilters.onlyWithAttachments) {
        const attachments = record.metadata?.attachments;
        if (!Array.isArray(attachments) || attachments.length === 0) {
          return false;
        }
      }

      if (
        advancedFilters.onlyWithSplits &&
        (!record.splits || record.splits.length === 0)
      ) {
        return false;
      }

      if (tagFilters.included.length > 0) {
        const hasAllIncluded = tagFilters.included.every((id) =>
          recordTagIds.includes(id),
        );
        if (!hasAllIncluded) {
          return false;
        }
      }

      if (tagFilters.excluded.length > 0) {
        const hasAnyExcluded = tagFilters.excluded.some((id) =>
          recordTagIds.includes(id),
        );
        if (hasAnyExcluded) {
          return false;
        }
      }

      return true;
    });
  }, [
    activeCardFilter,
    advancedFilters,
    filters,
    records,
    searchTerm,
    tagFilters,
  ]);

  const sortedRecords = useMemo(() => {
    let sortableItems = [...filteredRecords];
    if (sortConfig.key && sortConfig.direction) {
      sortableItems.sort((a, b) => {
        const key = sortConfig.key as keyof FinancialRecord;
        let aValue: any = a[key] ?? "";
        let bValue: any = b[key] ?? "";

        if (key === "amount" || key === "amountFinal") {
          aValue = getRecordAmount(a);
          bValue = getRecordAmount(b);
        }

        if (key === "status") {
          aValue = getEffectiveRecordStatus(a);
          bValue = getEffectiveRecordStatus(b);
        }

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredRecords, sortConfig]);

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const filteredSummary = useMemo(
    () =>
      filteredRecords.reduce(
        (acc, record) => {
          const amount = getRecordAmount(record);

          if (record.type === "INCOME") {
            acc.income += amount;
          } else {
            acc.expense += amount;
          }

          if (getEffectiveRecordStatus(record) === "OVERDUE") {
            acc.overdueCount += 1;
          }

          return acc;
        },
        { income: 0, expense: 0, overdueCount: 0 },
      ),
    [filteredRecords],
  );

  const activeAdvancedFilterCount = useMemo(
    () =>
      Object.values(advancedFilters).filter((value) => {
        if (typeof value === "boolean") {
          return value;
        }
        return Boolean(value);
      }).length,
    [advancedFilters],
  );

  const totalActiveFilterCount =
    activeAdvancedFilterCount +
    (searchTerm ? 1 : 0) +
    (filters.type ? 1 : 0) +
    (filters.status ? 1 : 0) +
    (filters.category ? 1 : 0) +
    (tagFilters.included.length > 0 ? 1 : 0) +
    (tagFilters.excluded.length > 0 ? 1 : 0) +
    (activeCardFilter !== "ALL" ? 1 : 0);

  const openAdvancedFilterModal = async () => {
    if (contacts.length === 0 && !loadingContacts) {
      await fetchContacts();
    }
    setShowAdvancedFilters(true);
  };

  const resetAllFilters = () => {
    setSearchTerm("");
    setFilters({ type: "", status: "", category: "" });
    setAdvancedFilters(EMPTY_ADVANCED_FILTERS);
    setTagFilters({ included: [], excluded: [] });
    setActiveCardFilter("ALL");
  };

  const applyAdvancedPreset = (
    preset:
      | "OVERDUE_THIS_WEEK"
      | "DUE_THIS_MONTH"
      | "CREATED_THIS_WEEK"
      | "CLEAR_DATES",
  ) => {
    if (preset === "CLEAR_DATES") {
      setAdvancedFilters((current) => ({
        ...current,
        createdFrom: "",
        createdTo: "",
        dueFrom: "",
        dueTo: "",
        paymentFrom: "",
        paymentTo: "",
      }));
      return;
    }

    const today = new Date();
    const range =
      preset === "DUE_THIS_MONTH"
        ? { start: startOfMonth(today), end: endOfMonth(today) }
        : {
            start: startOfWeek(today, { weekStartsOn: 1 }),
            end: endOfWeek(today, { weekStartsOn: 1 }),
          };

    const start = format(range.start, "yyyy-MM-dd");
    const end = format(range.end, "yyyy-MM-dd");

    if (preset === "OVERDUE_THIS_WEEK") {
      setFilters((current) => ({ ...current, status: "OVERDUE" }));
      setAdvancedFilters((current) => ({
        ...current,
        dueFrom: start,
        dueTo: end,
        paymentFrom: "",
        paymentTo: "",
      }));
      return;
    }

    if (preset === "CREATED_THIS_WEEK") {
      setAdvancedFilters((current) => ({
        ...current,
        createdFrom: start,
        createdTo: end,
      }));
      return;
    }

    setAdvancedFilters((current) => ({
      ...current,
      dueFrom: start,
      dueTo: end,
    }));
  };

  const handleCardFilterChange = (cardFilter: CardFilter) => {
    setActiveCardFilter(cardFilter);

    if (cardFilter === "INCOME_ALL") {
      setFilters((current) => ({ ...current, type: "INCOME", status: "" }));
      return;
    }

    if (cardFilter === "INCOME_PENDING") {
      setFilters((current) => ({
        ...current,
        type: "INCOME",
        status: "PENDING",
      }));
      return;
    }

    if (cardFilter === "INCOME_OVERDUE") {
      setFilters((current) => ({
        ...current,
        type: "INCOME",
        status: "OVERDUE",
      }));
      return;
    }

    if (cardFilter === "EXPENSE_ALL") {
      setFilters((current) => ({ ...current, type: "EXPENSE", status: "" }));
      return;
    }

    if (cardFilter === "EXPENSE_PENDING") {
      setFilters((current) => ({
        ...current,
        type: "EXPENSE",
        status: "PENDING",
      }));
      return;
    }

    if (cardFilter === "EXPENSE_OVERDUE") {
      setFilters((current) => ({
        ...current,
        type: "EXPENSE",
        status: "OVERDUE",
      }));
      return;
    }

    setFilters({ type: "", status: "", category: "" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className={clsx("flex flex-col h-full space-y-6 antialiased text-rendering-optimizeLegibility selection:bg-indigo-500/30 animate-in fade-in duration-700", isEmbeddedInProcess ? "p-4" : "p-6 md:p-10")}>
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3 tracking-tight">
            <DollarSign className="text-emerald-500" size={32} />
            {isEmbeddedInProcess ? "Financeiro do Processo" : "Módulo Financeiro"}
          </h1>
          {isEmbeddedInProcess ? (
            <p className="text-slate-400 mt-1">
              {props.processContext?.title ||
                "Lançamentos vinculados ao processo em tela"}
              {props.processContext?.cnj ? ` • ${props.processContext.cnj}` : ""}
              {props.processContext?.code ? ` • ${props.processContext.code}` : ""}
            </p>
          ) : (
            <p className="text-slate-400 mt-1">
              Gestão completa de receitas, despesas e contas bancárias
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => setView("records")}
            className={`min-h-[44px] px-4 py-2.5 sm:py-2 font-bold transition-all text-base sm:text-sm rounded-lg flex items-center gap-2 ${
              view === "records"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <FileText size={16} />
            Transações
          </button>
          {!isEmbeddedInProcess && (
            <>
              <button
                onClick={() => setView("accounts")}
                className={`min-h-[44px] px-4 py-2.5 sm:py-2 font-bold transition-all text-base sm:text-sm rounded-lg flex items-center gap-2 ${
                  view === "accounts"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <Building2 size={16} />
                Contas Bancárias
              </button>
              <button
                onClick={() => setView("banking")}
                className={`min-h-[44px] px-4 py-2.5 sm:py-2 font-bold transition-all text-base sm:text-sm rounded-lg flex items-center gap-2 ${
                  view === "banking"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <Globe size={16} />
                Banking Hub
              </button>
              <button
                onClick={() => setView("conditions")}
                className={`min-h-[44px] px-4 py-2.5 sm:py-2 font-bold transition-all text-base sm:text-sm rounded-lg flex items-center gap-2 ${
                  view === "conditions"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <CreditCard size={16} />
                Cond. Pagamento
              </button>
            </>
          )}
          <div className="w-px h-6 bg-slate-800 mx-1 hidden sm:block" />
          <button
            onClick={() =>
              view === "accounts"
                ? handleOpenBankModal()
                : view === "banking"
                  ? handleOpenIntegrationModal()
                  : handleOpenModal()
            }
            className="min-h-[44px] px-4 py-2.5 sm:py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-base sm:text-sm font-bold transition-colors flex items-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            <Plus size={20} />
            <span>{view === "banking" ? "Nova Integração" : "Novo"}</span>
          </button>
        </div>
      </div>

      {/* Dashboard View */}
      {view === "dashboard" && dashboard && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-black/5 hover:border-emerald-500/30 transition-all group">
              <div className="flex items-center justify-between mb-4">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">Receitas</span>
                <div className="p-2 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
                  <TrendingUp className="text-emerald-400" size={20} />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight tabular-nums break-words">
                {formatCurrency(dashboard.summary.totalIncome)}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 uppercase">Pendente</span>
                <span className="text-sm font-medium text-slate-400">
                  {formatCurrency(dashboard.summary.pendingIncome)}
                </span>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-black/5 hover:border-red-500/30 transition-all group">
              <div className="flex items-center justify-between mb-4">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">Despesas</span>
                <div className="p-2 bg-red-500/10 rounded-lg group-hover:bg-red-500/20 transition-colors">
                  <TrendingDown className="text-red-400" size={20} />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight tabular-nums break-words">
                {formatCurrency(dashboard.summary.totalExpense)}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 uppercase">Pendente</span>
                <span className="text-sm font-medium text-slate-400">
                  {formatCurrency(dashboard.summary.pendingExpense)}
                </span>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-black/5 hover:border-indigo-500/30 transition-all group">
              <div className="flex items-center justify-between mb-4">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">Fluxo</span>
                <div className="p-2 bg-indigo-500/10 rounded-lg group-hover:bg-indigo-500/20 transition-colors">
                  <DollarSign className="text-indigo-400" size={20} />
                </div>
              </div>
              <p
                className={`text-2xl sm:text-3xl font-bold tracking-tight tabular-nums break-words ${dashboard.summary.balance >= 0 ? "text-white" : "text-red-400"}`}
              >
                {formatCurrency(dashboard.summary.balance)}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 uppercase">Contas</span>
                <span className="text-sm font-medium text-slate-400">
                  {formatCurrency(dashboard.summary.totalBalance)}
                </span>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-black/5 hover:border-orange-500/30 transition-all group">
              <div className="flex items-center justify-between mb-4">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">Alertas</span>
                <div className="p-2 bg-orange-500/10 rounded-lg group-hover:bg-orange-500/20 transition-colors">
                  <Calendar className="text-orange-400" size={20} />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight tabular-nums break-words">
                {dashboard.summary.overdueCount}
              </p>
              <div className="flex items-center gap-2 mt-2 font-medium text-slate-400 text-sm">
                <AlertTriangle size={14} className="text-orange-400" />
                Registros Vencidos
              </div>
            </div>
          </div>

          {/* Recent Records */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              Transações Recentes
            </h3>
            <div className="space-y-3">
              {dashboard.recentRecords.slice(0, 5).map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="text-white font-medium">
                      {record.description}
                    </p>
                    <p className="text-sm text-slate-400">
                      {formatDate(record.dueDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {getTypeBadge(record.type)}
                    {getStatusBadge(getEffectiveRecordStatus(record))}
                    <p
                      className={`text-lg font-bold ${record.type === "INCOME" ? "text-green-400" : "text-red-400"}`}
                    >
                      {record.type === "INCOME" ? "+" : "-"}
                      {formatCurrency(record.amount)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Records View */}
      {view === "records" && (
        <div className="space-y-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl shadow-black/5 flex flex-col gap-6 antialiased">
            <div className="flex flex-col lg:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full">
                <Search
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500"
                  size={20}
                />
                <input
                  type="text"
                  placeholder="Buscar por descrição, contato, conta, categoria ou etiqueta..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-base sm:text-sm"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                <select
                  value={filters.type}
                  onChange={(e) =>
                    setFilters((current) => ({
                      ...current,
                      type: e.target.value,
                    }))
                  }
                  className="min-h-[44px] px-4 py-3.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-base sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[140px] appearance-none cursor-pointer hover:border-slate-600 transition-all"
                >
                  <option value="">Todos os tipos</option>
                  <option value="INCOME">Receitas</option>
                  <option value="EXPENSE">Despesas</option>
                </select>
                <select
                  value={filters.status}
                  onChange={(e) =>
                    setFilters((current) => ({
                      ...current,
                      status: e.target.value,
                    }))
                  }
                  className="min-h-[44px] px-4 py-3.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-base sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[140px] appearance-none cursor-pointer hover:border-slate-600 transition-all"
                >
                  <option value="">Todos os status</option>
                  <option value="PENDING">Pendente</option>
                  <option value="PAID">Pago</option>
                  <option value="PARTIAL">Parcial</option>
                  <option value="CANCELLED">Cancelado</option>
                  <option value="OVERDUE">Vencido</option>
                </select>
                <button
                  onClick={openAdvancedFilterModal}
                  className="min-h-[44px] px-5 py-3.5 bg-slate-900 border border-indigo-500/30 text-indigo-300 rounded-xl font-bold text-base sm:text-sm flex items-center justify-center gap-2 hover:bg-slate-800 hover:border-indigo-500 transition-all shadow-lg shadow-indigo-500/5 group"
                >
                  <Filter size={20} className="group-hover:scale-110 transition-transform" />
                  <span>Filtros Avançados</span>
                  {activeAdvancedFilterCount > 0 && (
                    <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-black rounded-full bg-indigo-500 text-white shadow-sm">
                      {activeAdvancedFilterCount}
                    </span>
                  )}
                </button>
                {totalActiveFilterCount > 0 && (
                  <button
                    onClick={resetAllFilters}
                    className="min-h-[44px] min-w-[44px] grid place-items-center bg-slate-900 border border-slate-800 text-slate-400 rounded-xl font-bold hover:bg-slate-800 hover:text-white transition-all"
                    title="Limpar filtros"
                  >
                    <RefreshCw size={20} />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                  Resultados Filtro
                </p>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xl sm:text-2xl font-bold text-white tracking-tighter tabular-nums break-words">
                    {filteredRecords.length}
                  </span>
                  <span className="text-xs font-bold text-slate-500 uppercase">
                    registros
                  </span>
                </div>
              </div>
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/70 mb-2">
                  Receitas Filtradas
                </p>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xl sm:text-2xl font-bold text-emerald-400 tracking-tighter tabular-nums break-words">
                    {formatCurrency(filteredSummary.income)}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-500/50 uppercase">parcial</span>
                </div>
              </div>
              <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500/70 mb-2">
                  Despesas Filtradas
                </p>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xl sm:text-2xl font-bold text-red-400 tracking-tighter tabular-nums break-words">
                    {formatCurrency(filteredSummary.expense)}
                  </span>
                  <span className="text-[10px] font-bold text-red-500/50 uppercase">
                    {filteredSummary.overdueCount} atrasadas
                  </span>
                </div>
              </div>
            </div>
          </div>
          

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
              <button
                onClick={() => handleCardFilterChange("INCOME_ALL")}
                className={`p-3.5 rounded-xl border transition-all duration-300 text-left relative overflow-hidden group h-full flex flex-col justify-between ${
                  activeCardFilter === "INCOME_ALL"
                    ? "bg-green-500/10 border-green-500/50 shadow-lg"
                    : "bg-slate-900 border-slate-800 hover:bg-slate-800"
                }`}
              >
                <div className="flex justify-between items-center mb-3">
                  <div className="p-1.5 rounded-lg bg-green-500/20 text-green-400 shrink-0">
                    <TrendingUp size={16} />
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                    {cardMetrics.INCOME_ALL.count} registros
                  </div>
                </div>
                <div className="mb-1">
                  <div className="text-base sm:text-lg font-black text-white tracking-tighter tabular-nums leading-none">
                    {formatCurrency(cardMetrics.INCOME_ALL.amount)}
                  </div>
                </div>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">
                  Receitas (Tudo)
                </span>
                {activeCardFilter === "INCOME_ALL" && (
                  <div className="absolute bottom-0 left-0 h-1 bg-green-500 w-full" />
                )}
              </button>

              <button
                onClick={() => handleCardFilterChange("INCOME_PENDING")}
                className={`p-3.5 rounded-xl border transition-all duration-300 text-left relative overflow-hidden group h-full flex flex-col justify-between ${
                  activeCardFilter === "INCOME_PENDING"
                    ? "bg-blue-500/10 border-blue-500/50 shadow-lg"
                    : "bg-slate-900 border-slate-800 hover:bg-slate-800"
                }`}
              >
                <div className="flex justify-between items-center mb-3">
                  <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 shrink-0">
                    <Clock size={16} />
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                    {cardMetrics.INCOME_PENDING.count} pendentes
                  </div>
                </div>
                <div className="mb-1">
                  <div className="text-base sm:text-lg font-black text-white tracking-tighter tabular-nums leading-none">
                    {formatCurrency(cardMetrics.INCOME_PENDING.amount)}
                  </div>
                </div>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">
                  Receitas Abertas
                </span>
                {activeCardFilter === "INCOME_PENDING" && (
                  <div className="absolute bottom-0 left-0 h-1 bg-blue-500 w-full" />
                )}
              </button>

              <button
                onClick={() => handleCardFilterChange("INCOME_OVERDUE")}
                className={`p-3.5 rounded-xl border transition-all duration-300 text-left relative overflow-hidden group h-full flex flex-col justify-between ${
                  activeCardFilter === "INCOME_OVERDUE"
                    ? "bg-orange-500/10 border-orange-500/50 shadow-lg"
                    : "bg-slate-900 border-slate-800 hover:bg-slate-800"
                }`}
              >
                <div className="flex justify-between items-center mb-3">
                  <div className="p-1.5 rounded-lg bg-orange-500/20 text-orange-400 shrink-0">
                    <AlertTriangle size={16} />
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                    {cardMetrics.INCOME_OVERDUE.count} vencidas
                  </div>
                </div>
                <div className="mb-1">
                  <div className="text-base sm:text-lg font-black text-white tracking-tighter tabular-nums leading-none">
                    {formatCurrency(cardMetrics.INCOME_OVERDUE.amount)}
                  </div>
                </div>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">
                  Receitas em Atraso
                </span>
                {activeCardFilter === "INCOME_OVERDUE" && (
                  <div className="absolute bottom-0 left-0 h-1 bg-orange-500 w-full" />
                )}
              </button>

              <button
                onClick={() => handleCardFilterChange("EXPENSE_ALL")}
                className={`p-3.5 rounded-xl border transition-all duration-300 text-left relative overflow-hidden group h-full flex flex-col justify-between ${
                  activeCardFilter === "EXPENSE_ALL"
                    ? "bg-red-500/10 border-red-500/50 shadow-lg"
                    : "bg-slate-900 border-slate-800 hover:bg-slate-800"
                }`}
              >
                <div className="flex justify-between items-center mb-3">
                  <div className="p-1.5 rounded-lg bg-red-500/20 text-red-400 shrink-0">
                    <TrendingDown size={16} />
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                    {cardMetrics.EXPENSE_ALL.count} registros
                  </div>
                </div>
                <div className="mb-1">
                  <div className="text-base sm:text-lg font-black text-white tracking-tighter tabular-nums leading-none">
                    {formatCurrency(cardMetrics.EXPENSE_ALL.amount)}
                  </div>
                </div>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">
                  Despesas (Tudo)
                </span>
                {activeCardFilter === "EXPENSE_ALL" && (
                  <div className="absolute bottom-0 left-0 h-1 bg-red-500 w-full" />
                )}
              </button>

              <button
                onClick={() => handleCardFilterChange("EXPENSE_PENDING")}
                className={`p-3.5 rounded-xl border transition-all duration-300 text-left relative overflow-hidden group h-full flex flex-col justify-between ${
                  activeCardFilter === "EXPENSE_PENDING"
                    ? "bg-purple-500/10 border-purple-500/50 shadow-lg"
                    : "bg-slate-900 border-slate-800 hover:bg-slate-800"
                }`}
              >
                <div className="flex justify-between items-center mb-3">
                  <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400 shrink-0">
                    <Clock size={16} />
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                    {cardMetrics.EXPENSE_PENDING.count} pendentes
                  </div>
                </div>
                <div className="mb-1">
                  <div className="text-base sm:text-lg font-black text-white tracking-tighter tabular-nums leading-none">
                    {formatCurrency(cardMetrics.EXPENSE_PENDING.amount)}
                  </div>
                </div>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">
                  Despesas Abertas
                </span>
                {activeCardFilter === "EXPENSE_PENDING" && (
                  <div className="absolute bottom-0 left-0 h-1 bg-purple-500 w-full" />
                )}
              </button>

              <button
                onClick={() => handleCardFilterChange("ALL")}
                className={`p-3.5 rounded-xl border transition-all duration-300 text-left relative overflow-hidden group h-full flex flex-col justify-between ${
                  activeCardFilter === "ALL"
                    ? "bg-indigo-500/10 border-indigo-500/50 shadow-lg"
                    : "bg-slate-900 border-slate-800 hover:bg-slate-800"
                }`}
              >
                <div className="flex justify-between items-center mb-3">
                  <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 shrink-0">
                    <DollarSign size={16} />
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                    {cardMetrics.ALL.count} registros
                  </div>
                </div>
                <div className="mb-1">
                  <div className="text-base sm:text-lg font-black text-white tracking-tighter tabular-nums leading-none">
                    {formatCurrency(cardMetrics.ALL.amount)}
                  </div>
                </div>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">
                  Todas Transações
                </span>
                {activeCardFilter === "ALL" && (
                  <div className="absolute bottom-0 left-0 h-1 bg-indigo-500 w-full" />
                )}
              </button>
            </div>

            {totalActiveFilterCount > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <span className="px-2 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-200">
                  {totalActiveFilterCount} filtro(s) ativo(s)
                </span>
                {filters.status === "OVERDUE" && (
                  <span className="px-2 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-200">
                    Status efetivo: vencido
                  </span>
                )}
                {advancedFilters.createdFrom && advancedFilters.createdTo && (
                  <span className="px-2 py-1 rounded-full bg-slate-900 border border-slate-700">
                    Lançamento: {formatDate(advancedFilters.createdFrom)} a{" "}
                    {formatDate(advancedFilters.createdTo)}
                  </span>
                )}
                {advancedFilters.dueFrom && advancedFilters.dueTo && (
                  <span className="px-2 py-1 rounded-full bg-slate-900 border border-slate-700">
                    Vencimento: {formatDate(advancedFilters.dueFrom)} a{" "}
                    {formatDate(advancedFilters.dueTo)}
                  </span>
                )}
              </div>
            )}

          

          <AdvancedTagFilter
            scope="FINANCE"
            onFilterChange={(inc, exc) =>
              setTagFilters({ included: inc, excluded: exc })
            }
          />

          {showAdvancedFilters && (
            <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-6xl max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl">
                <div className="sticky top-0 z-10 px-6 py-5 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                        <Filter size={18} className="text-indigo-300" />
                        Filtros Avançados
                      </h3>
                      <p className="text-sm text-slate-400 mt-1">
                        Combine períodos, status efetivo, valores, contato,
                        conta, origem e forma de pagamento sem perder o clique
                        dos cards.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowAdvancedFilters(false)}
                      className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => applyAdvancedPreset("OVERDUE_THIS_WEEK")}
                      className="px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-200 text-sm hover:bg-orange-500/15 transition-colors"
                    >
                      Vencidos esta semana
                    </button>
                    <button
                      onClick={() => applyAdvancedPreset("CREATED_THIS_WEEK")}
                      className="px-3 py-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-200 text-sm hover:bg-sky-500/15 transition-colors"
                    >
                      Lançados esta semana
                    </button>
                    <button
                      onClick={() => applyAdvancedPreset("DUE_THIS_MONTH")}
                      className="px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-200 text-sm hover:bg-indigo-500/15 transition-colors"
                    >
                      Vencimento neste mês
                    </button>
                    <button
                      onClick={() => applyAdvancedPreset("CLEAR_DATES")}
                      className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm hover:bg-slate-700 transition-colors"
                    >
                      Limpar datas
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-wider text-slate-400">
                        Categoria
                      </span>
                      <select
                        value={advancedFilters.categoryId}
                        onChange={(e) =>
                          setAdvancedFilters((current) => ({
                            ...current,
                            categoryId: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-3 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Todas</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-wider text-slate-400">
                        Conta bancária
                      </span>
                      <select
                        value={advancedFilters.bankAccountId}
                        onChange={(e) =>
                          setAdvancedFilters((current) => ({
                            ...current,
                            bankAccountId: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-3 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Todas</option>
                        {bankAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.title}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-wider text-slate-400">
                        Contato vinculado
                      </span>
                      <select
                        value={advancedFilters.contactId}
                        onChange={(e) =>
                          setAdvancedFilters((current) => ({
                            ...current,
                            contactId: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-3 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Todos</option>
                        {contacts.map((contact) => (
                          <option key={contact.id} value={contact.id}>
                            {contact.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-wider text-slate-400">
                        Origem
                      </span>
                      <select
                        value={advancedFilters.origin}
                        onChange={(e) =>
                          setAdvancedFilters((current) => ({
                            ...current,
                            origin: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-3 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Todas</option>
                        {originOptions.map((origin) => (
                          <option key={origin} value={origin}>
                            {origin}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-wider text-slate-400">
                        Forma de pagamento
                      </span>
                      <select
                        value={advancedFilters.paymentMethod}
                        onChange={(e) =>
                          setAdvancedFilters((current) => ({
                            ...current,
                            paymentMethod: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-3 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Todas</option>
                        {paymentMethods.map((paymentMethod) => (
                          <option key={paymentMethod} value={paymentMethod}>
                            {paymentMethod}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-wider text-slate-400">
                        Valor mínimo
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={advancedFilters.amountMin}
                        onChange={(e) =>
                          setAdvancedFilters((current) => ({
                            ...current,
                            amountMin: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-3 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-wider text-slate-400">
                        Valor máximo
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={advancedFilters.amountMax}
                        onChange={(e) =>
                          setAdvancedFilters((current) => ({
                            ...current,
                            amountMax: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-3 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </label>

                    <div className="space-y-2">
                      <span className="text-xs uppercase tracking-wider text-slate-400">
                        Filtros Adicionais
                      </span>
                      <div className="grid grid-cols-1 gap-2">
                        <label className="flex items-center gap-2 px-3 py-3 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-200">
                          <input
                            type="checkbox"
                            checked={advancedFilters.onlyWithAttachments}
                            onChange={(e) =>
                              setAdvancedFilters((current) => ({
                                ...current,
                                onlyWithAttachments: e.target.checked,
                              }))
                            }
                            className="rounded border-slate-600 bg-slate-900 text-indigo-500"
                          />
                          Somente com anexos
                        </label>
                        <label className="flex items-center gap-2 px-3 py-3 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-200">
                          <input
                            type="checkbox"
                            checked={advancedFilters.onlyWithSplits}
                            onChange={(e) =>
                              setAdvancedFilters((current) => ({
                                ...current,
                                onlyWithSplits: e.target.checked,
                              }))
                            }
                            className="rounded border-slate-600 bg-slate-900 text-indigo-500"
                          />
                          Somente com rateio
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="space-y-3 p-4 bg-slate-950/80 border border-slate-800 rounded-xl">
                      <div>
                        <h4 className="text-sm font-semibold text-white">
                          Período de lançamento
                        </h4>
                        <p className="text-xs text-slate-500">
                          Ex.: tudo que foi lançado entre X e Y.
                        </p>
                      </div>
                      <DateRangePicker
                        value={{
                          from: advancedFilters.createdFrom,
                          to: advancedFilters.createdTo,
                        }}
                        onChange={(next) =>
                          setAdvancedFilters((current) => ({
                            ...current,
                            createdFrom: String(next.from || ""),
                            createdTo: String(next.to || ""),
                          }))
                        }
                        placeholder="Selecionar período"
                        align="left"
                      />
                    </div>

                    <div className="space-y-3 p-4 bg-slate-950/80 border border-slate-800 rounded-xl">
                      <div>
                        <h4 className="text-sm font-semibold text-white">
                          Período de vencimento
                        </h4>
                        <p className="text-xs text-slate-500">
                          Ideal para cobranças vencidas na semana ou mês.
                        </p>
                      </div>
                      <DateRangePicker
                        value={{ from: advancedFilters.dueFrom, to: advancedFilters.dueTo }}
                        onChange={(next) =>
                          setAdvancedFilters((current) => ({
                            ...current,
                            dueFrom: String(next.from || ""),
                            dueTo: String(next.to || ""),
                          }))
                        }
                        placeholder="Selecionar período"
                        align="left"
                      />
                    </div>

                    <div className="space-y-3 p-4 bg-slate-950/80 border border-slate-800 rounded-xl">
                      <div>
                        <h4 className="text-sm font-semibold text-white">
                          Período de pagamento
                        </h4>
                        <p className="text-xs text-slate-500">
                          Use para conciliação e auditoria de liquidações.
                        </p>
                      </div>
                      <DateRangePicker
                        value={{
                          from: advancedFilters.paymentFrom,
                          to: advancedFilters.paymentTo,
                        }}
                        onChange={(next) =>
                          setAdvancedFilters((current) => ({
                            ...current,
                            paymentFrom: String(next.from || ""),
                            paymentTo: String(next.to || ""),
                          }))
                        }
                        placeholder="Selecionar período"
                        align="right"
                      />
                    </div>
                  </div>
                </div>

                <div className="sticky bottom-0 px-6 py-4 border-t border-slate-800 bg-slate-900/95 backdrop-blur flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <p className="text-sm text-slate-400">
                    Visualizando{" "}
                    <span className="text-white font-medium">
                      {filteredRecords.length}
                    </span>{" "}
                    registros com os filtros atuais.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={resetAllFilters}
                      className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
                    >
                      Limpar tudo
                    </button>
                    <button
                      onClick={() => setShowAdvancedFilters(false)}
                      className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
                    >
                      Aplicar filtros
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Records Table */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl antialiased">
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] relative">
              <table className="min-w-[1100px] w-full border-collapse">
              <thead className="sticky top-0 z-20">
                <tr className="bg-slate-950 border-b border-slate-800">
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                    Contatos & Contas
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                    Etiquetas
                  </th>
                  <th
                    onClick={() => handleSort("description")}
                    className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] cursor-pointer hover:text-indigo-400 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      Descrição
                      <div className="flex flex-col opacity-20 group-hover:opacity-100 transition-opacity">
                        <ChevronUp size={10} className={sortConfig.key === "description" && sortConfig.direction === "asc" ? "text-indigo-400 opacity-100" : ""} />
                        <ChevronDown size={10} className={sortConfig.key === "description" && sortConfig.direction === "desc" ? "text-indigo-400 opacity-100" : ""} />
                      </div>
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                    Datas Cronograma
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                    Status
                  </th>
                  <th
                    onClick={() => handleSort("amount")}
                    className="px-6 py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] cursor-pointer hover:text-indigo-400 transition-colors group"
                  >
                    <div className="flex items-center justify-end gap-2">
                      Valor Final
                      <div className="flex flex-col opacity-20 group-hover:opacity-100 transition-opacity text-left">
                        <ChevronUp size={10} className={sortConfig.key === "amount" && sortConfig.direction === "asc" ? "text-indigo-400 opacity-100" : ""} />
                        <ChevronDown size={10} className={sortConfig.key === "amount" && sortConfig.direction === "desc" ? "text-indigo-400 opacity-100" : ""} />
                      </div>
                    </div>
                  </th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/10">
                {sortedRecords.map((record) => (
                  <Fragment key={record.id}>
                    <tr
                      className="hover:bg-indigo-500/[0.03] transition-colors cursor-pointer group/row"
                      onDoubleClick={() => handleOpenModal(record)}
                    >
                      <td
                        className="px-6 py-5 align-top"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-col gap-2">
                          {record.parties
                            ?.filter((party) => party.contact)
                            .sort(
                              (a, b) =>
                                getPartyRoleMeta(a.role).order -
                                getPartyRoleMeta(b.role).order,
                            )
                            .map((party) => {
                              const roleMeta = getPartyRoleMeta(party.role);

                              return (
                                <div
                                  key={`${record.id}-${party.contactId}-${party.role}`}
                                  className="flex items-center justify-between gap-2 p-1.5 bg-slate-950/40 border border-slate-800/50 rounded-lg group/party hover:border-indigo-500/30 transition-all mb-1"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm shrink-0 ${roleMeta.className.replace('text-', 'bg-').replace('vibrant-', 'vibrant-bg-')} ${roleMeta.className}`}>
                                      {roleMeta.short}
                                    </span>
                                    <span
                                      className="text-[10px] text-slate-300 truncate font-black uppercase tracking-widest cursor-pointer hover:text-indigo-400"
                                      onClick={() =>
                                        navigate(`/contacts/${party.contact!.id}`)
                                      }
                                      title={`${roleMeta.label}: ${party.contact!.name}`}
                                    >
                                      {party.contact!.name}
                                    </span>
                                  </div>
                                  {party.amount && (
                                    <span className="text-[9px] font-black text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded shadow-sm shrink-0">
                                      {formatCurrency(Number(party.amount))}
                                    </span>
                                  )}
                                </div>
                              );
                            })}

                          {record.bankAccount && (
                            <div className="flex items-center gap-2 mt-1 opacity-70 hover:opacity-100 transition-opacity">
                              <div className="p-1 bg-blue-500/10 rounded text-blue-400 shrink-0">
                                <Building2 size={10} />
                              </div>
                              <span
                                className="text-[11px] text-slate-400 truncate max-w-[140px] font-medium"
                                title={record.bankAccount.bankName}
                              >
                                {record.bankAccount.bankName}
                              </span>
                            </div>
                          )}

                            {(!record.parties || record.parties.length === 0) &&
                              !record.bankAccount && (
                                <div className="px-1 py-1 flex items-center gap-2 opacity-30">
                                  <div className="w-1 h-1 rounded-full bg-slate-600" />
                                  <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                                    Sem Vínculos
                                  </span>
                                </div>
                              )}
                        </div>
                      </td>

                      <td
                        className="px-6 py-5 align-top"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <InlineTags
                          tags={record.tags || []}
                          entityId={record.id}
                          entityType="financial"
                          onRefresh={fetchData}
                          className="scale-90 origin-top-left"
                        />
                      </td>

                      <td className="px-6 py-5 align-top min-w-[280px]">
                        <div className="flex items-start gap-3">
                          {record.children && record.children.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRowExpand(record.id);
                              }}
                              className="mt-1 p-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-500 hover:text-white hover:border-indigo-500 transition-all shadow-lg active:scale-95"
                            >
                              {expandedRows.has(record.id) ? (
                                <ChevronDown size={14} />
                              ) : (
                                <ChevronRight size={14} />
                              )}
                            </button>
                          )}
                          <div className="flex flex-col gap-2 flex-1">
                            <p className="text-sm font-black text-white leading-tight tracking-tight group-hover/row:text-indigo-300 transition-colors">
                              {record.description}
                            </p>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {record.financialCategory && (
                                <span className="text-[9px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded-md border border-slate-800 bg-slate-950 text-slate-500 group-hover/row:border-slate-700 transition-colors">
                                  {record.financialCategory.name}
                                </span>
                              )}
                              {record.totalInstallments &&
                                record.totalInstallments > 1 && (
                                  <span className="text-[9px] font-black uppercase tracking-[0.15em] px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-md border border-indigo-500/20 shadow-sm">
                                    {record.totalInstallments} parcelas
                                  </span>
                                )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-5 align-top whitespace-nowrap">
                        <div className="flex flex-col gap-2.5">
                          <div className="flex items-center gap-2 px-2 py-1 bg-slate-950/50 rounded-lg border border-slate-800/40">
                            <Calendar size={11} className="text-slate-600" />
                            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-tighter">
                              {record.createdAt ? formatDate(record.createdAt) : "-"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-950 rounded-lg border border-slate-800 shadow-inner group/venc">
                            <div className={`w-1.5 h-1.5 rounded-full ${isPast(new Date(record.dueDate)) && !record.paymentDate ? "bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.3)]"}`} />
                            <span className="text-[12px] text-white font-black tracking-tight">
                              VENC: {formatDate(record.dueDate)}
                            </span>
                          </div>
                          {record.paymentDate && (
                            <div className="flex items-center gap-2 px-2 py-1 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
                              <CheckCircle2 size={11} className="text-emerald-500" />
                              <span className="text-[11px] text-emerald-500 font-black uppercase tracking-tighter">
                                PAGO: {formatDate(record.paymentDate)}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                       <td className="px-6 py-5 align-top whitespace-nowrap">
                        <div className="inline-block scale-110 origin-top-left drop-shadow-md">
                          {getStatusBadge(getEffectiveRecordStatus(record))}
                        </div>
                      </td>

                      <td className="px-6 py-5 align-top whitespace-nowrap text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`text-lg font-black tracking-tighter drop-shadow-sm ${record.type === "INCOME" ? "text-emerald-400" : "text-red-400"}`}
                          >
                            {record.type === "INCOME" ? "+" : "-"}
                            {formatCurrency(
                              record.amountFinal
                                ? Number(record.amountFinal)
                                : record.amount,
                            )}
                          </span>
                          {record.amountFinal &&
                            Number(record.amountFinal) !== record.amount && (
                              <div className="px-2 py-0.5 bg-slate-950 rounded border border-slate-800">
                                <p className="text-[10px] text-slate-600 line-through font-black italic tracking-tighter">
                                  {formatCurrency(record.amount)}
                                </p>
                              </div>
                            )}
                        </div>
                      </td>
                        <td
                          className="px-6 py-5 whitespace-nowrap text-right align-top"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex gap-1.5 justify-end">
                            {isOpenRecord(record) && !(record.children && record.children.length > 0) && (
                              <button
                                onClick={() => handleOpenSettleModal(record)}
                                disabled={!hasPartiesToSettle(record)}
                                className={`p-2.5 rounded-xl border transition-all active:scale-90 shadow-sm ${
                                  hasPartiesToSettle(record)
                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white"
                                    : "bg-slate-950 border-slate-800 text-slate-700 cursor-not-allowed opacity-50"
                                }`}
                                title={
                                  hasPartiesToSettle(record)
                                    ? "Liquidar Lançamento"
                                    : "Defina Credor e Devedor para liquidar"
                                }
                              >
                                <Calculator size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenModal(record)}
                              className="p-2.5 bg-slate-950 border border-slate-800 text-indigo-400 hover:bg-indigo-500 hover:text-white rounded-xl transition-all active:scale-90 shadow-sm"
                              title="Editar Detalhes"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(record.id)}
                              className="p-2.5 bg-slate-950 border border-slate-800 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all active:scale-90 shadow-sm"
                              title="Excluir Registro"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                    </tr>
                    {/* Parcelas expandidas */}
                    {expandedRows.has(record.id) &&
                      record.children?.map((child) => (
                        <tr
                          key={child.id}
                          className="bg-slate-700/20 border-l-2 border-purple-500/40 hover:bg-slate-700/40 transition-colors cursor-pointer"
                          onDoubleClick={() =>
                            handleOpenModal(child as FinancialRecord)
                          }
                        >
                          <td className="px-6 py-2 pl-14 whitespace-nowrap text-[10px] text-slate-500 italic">
                            Parcela {child.installmentNumber}/
                            {record.totalInstallments}
                          </td>
                          <td
                            className="px-6 py-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <InlineTags
                              tags={child.tags || []}
                              entityId={child.id}
                              entityType="financial"
                              onRefresh={fetchData}
                            />
                          </td>
                          <td className="px-6 py-2">
                            <p className="text-xs text-slate-300 truncate max-w-[200px]">
                              {child.description}
                            </p>
                          </td>
                          <td className="px-6 py-2 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-[10px] text-orange-400 font-bold">
                                V: {formatDate(child.dueDate)}
                              </span>
                              {child.paymentDate && (
                                <span className="text-[10px] text-green-400 font-bold">
                                  P: {formatDate(child.paymentDate)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td
                            className="px-6 py-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <InlineTags
                              tags={child.tags || []}
                              entityId={child.id}
                              entityType="financial"
                              onRefresh={fetchData}
                            />
                          </td>
                          <td className="px-6 py-2 whitespace-nowrap text-xs">
                            {getStatusBadge(
                              getEffectiveRecordStatus(
                                child as FinancialRecord,
                              ),
                            )}
                          </td>
                          <td className="px-6 py-2 whitespace-nowrap text-right">
                            <span className="text-xs font-bold text-slate-300">
                              {formatCurrency(Number(child.amount))}
                            </span>
                          </td>
                          <td
                            className="px-6 py-2 whitespace-nowrap text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isOpenRecord(child as FinancialRecord) && (
                              <button
                                onClick={() =>
                                  handleOpenSettleModal(
                                    child as FinancialRecord,
                                  )
                                }
                                disabled={!hasPartiesToSettle(child as FinancialRecord)}
                                className={`p-1.5 rounded transition-colors ${
                                  hasPartiesToSettle(child as FinancialRecord)
                                    ? "text-green-400 hover:bg-green-500/10"
                                    : "text-slate-600 cursor-not-allowed opacity-50"
                                }`}
                                title={
                                  hasPartiesToSettle(child as FinancialRecord)
                                    ? "Liquidar parcela"
                                    : "Defina Credor e Devedor para liquidar"
                                }
                              >
                                <Calculator size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(child.id)}
                              className="p-1.5 text-red-400 hover:bg-red-500/10 rounded transition-colors ml-1"
                              title="Excluir parcela"
                            >
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
                O Dr.X está analisando seu fluxo de caixa. Em breve você terá
                previsões de inadimplência e sugestões de redução de custos
                automáticas.
              </p>
              <div className="flex gap-2">
                <span className="px-2 py-1 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold rounded border border-indigo-500/20 uppercase">
                  Projeção 2026
                </span>
                <span className="px-2 py-1 bg-purple-500/10 text-purple-400 text-[10px] font-bold rounded border border-purple-500/20 uppercase">
                  Risk Analysis
                </span>
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
                Conecte suas contas bancárias reais para conciliação automática
                via Open Finance. Sincronização em tempo real com os principais
                bancos.
              </p>
              <button className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2">
                <Plus size={14} /> Conectar Banco
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bank Accounts View */}
      {view === "banking" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {bankIntegrations.map((integration) => {
              const lastJob = integration.syncJobs?.[0];
              return (
                <div
                  key={integration.id}
                  className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-black/10 space-y-4"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 text-xs font-bold uppercase tracking-wider">
                          <Building2 size={12} />
                          {integration.provider}
                        </span>
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold">
                          {integration.environment}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-white mt-3">
                        {integration.displayName}
                      </h3>
                      <p className="text-sm text-slate-400 mt-1 break-words">
                        {integration.bankAccount
                          ? `${integration.bankAccount.title} • ${integration.bankAccount.bankName}`
                          : "Sem conta interna vinculada"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => handleHealthcheckIntegration(integration)}
                        className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold flex items-center gap-2"
                      >
                        <CheckCircle2 size={15} />
                        Testar
                      </button>
                      <button
                        onClick={() => handleSyncIntegration(integration)}
                        className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold flex items-center gap-2"
                      >
                        <RefreshCw size={15} />
                        Sincronizar
                      </button>
                      <button
                        onClick={() => handleOpenIntegrationModal(integration)}
                        className="p-2 rounded-lg text-indigo-300 hover:bg-indigo-500/10"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteIntegration(integration.id)}
                        className="p-2 rounded-lg text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                      <p className="text-slate-500 text-xs uppercase tracking-wider font-bold">
                        Status
                      </p>
                      <p className="text-white font-semibold mt-1">{integration.status}</p>
                      {integration.lastSyncAt && (
                        <p className="text-slate-400 text-xs mt-2">
                          Último sync: {formatDate(integration.lastSyncAt)}
                        </p>
                      )}
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                      <p className="text-slate-500 text-xs uppercase tracking-wider font-bold">
                        Saúde
                      </p>
                      <p className="text-white font-semibold mt-1">
                        {integration.lastHealthcheckStatus || "Ainda não testado"}
                      </p>
                      {integration.lastHealthcheckError && (
                        <p className="text-amber-300 text-xs mt-2">
                          {integration.lastHealthcheckError}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                      <p className="text-[11px] text-slate-500 uppercase tracking-wider font-bold">
                        Transações
                      </p>
                      <p className="text-lg font-bold text-white mt-1">
                        {integration._count?.bankTransactions || 0}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                      <p className="text-[11px] text-slate-500 uppercase tracking-wider font-bold">
                        Conciliações
                      </p>
                      <p className="text-lg font-bold text-white mt-1">
                        {integration._count?.reconciliations || 0}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                      <p className="text-[11px] text-slate-500 uppercase tracking-wider font-bold">
                        Webhooks
                      </p>
                      <p className="text-lg font-bold text-white mt-1">
                        {integration._count?.webhookEvents || 0}
                      </p>
                    </div>
                  </div>

                  {lastJob && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3 text-sm">
                      <p className="text-slate-500 text-xs uppercase tracking-wider font-bold">
                        Último job
                      </p>
                      <p className="text-white font-semibold mt-1">
                        {lastJob.jobType} • {lastJob.status}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}

            {bankIntegrations.length === 0 && (
              <div className="xl:col-span-3 rounded-3xl border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-300 flex items-center justify-center mx-auto mb-4">
                  <Globe size={28} />
                </div>
                <h3 className="text-xl font-bold text-white">
                  Banco Inter ainda não conectado
                </h3>
                <p className="text-slate-400 mt-2 max-w-2xl mx-auto">
                  Cadastre a integração para sincronizar saldo, extrato e iniciar
                  a conciliação automática do Financeiro com o Banking Hub.
                </p>
                <button
                  onClick={() => handleOpenIntegrationModal()}
                  className="mt-5 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold inline-flex items-center gap-2"
                >
                  <Plus size={16} />
                  Conectar Banco Inter
                </button>
              </div>
            )}
          </div>

          {lastHealthcheck && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={clsx(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    lastHealthcheck.success
                      ? "bg-emerald-500/10 text-emerald-300"
                      : "bg-amber-500/10 text-amber-300",
                  )}
                >
                  {lastHealthcheck.success ? (
                    <CheckCircle2 size={18} />
                  ) : (
                    <AlertTriangle size={18} />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Resultado do Healthcheck
                  </h3>
                  <p className="text-sm text-slate-400">
                    {lastHealthcheck.message}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {lastHealthcheck.checks.map((check) => (
                  <div
                    key={check.key}
                    className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"
                  >
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      {check.label}
                    </p>
                    <p
                      className={clsx(
                        "text-sm font-semibold mt-2",
                        check.status === "success" && "text-emerald-300",
                        check.status === "warning" && "text-amber-300",
                        check.status === "error" && "text-red-300",
                      )}
                    >
                      {check.status.toUpperCase()}
                    </p>
                    <p className="text-sm text-slate-400 mt-2">{check.details}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-800 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">
                  Extrato Sincronizado
                </h3>
                <p className="text-sm text-slate-400">
                  Visualize transações importadas do Inter e faça a conciliação
                  com os lançamentos financeiros do Xjur.
                </p>
              </div>
              <div className="text-sm text-slate-400">
                {bankTransactions.length} transações carregadas
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-950/70 text-slate-400">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Data</th>
                    <th className="text-left px-4 py-3 font-semibold">Descrição</th>
                    <th className="text-left px-4 py-3 font-semibold">Conta</th>
                    <th className="text-left px-4 py-3 font-semibold">Valor</th>
                    <th className="text-left px-4 py-3 font-semibold">Conciliação</th>
                    <th className="text-right px-4 py-3 font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {bankTransactions.map((transaction) => {
                    const suggestions = getSuggestedRecords(transaction);
                    const reconciled = (transaction.reconciliations?.length || 0) > 0;

                    return (
                      <tr
                        key={transaction.id}
                        className="border-t border-slate-800 align-top"
                      >
                        <td className="px-4 py-4 text-slate-300 whitespace-nowrap">
                          {formatDate(transaction.occurredAt)}
                        </td>
                        <td className="px-4 py-4 min-w-[260px]">
                          <div className="font-medium text-white">
                            {transaction.description}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {transaction.counterpartyName || transaction.entryType}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-slate-300">
                          {transaction.bankAccount?.title || "Sem conta"}
                        </td>
                        <td
                          className={clsx(
                            "px-4 py-4 font-bold whitespace-nowrap",
                            transaction.direction === "IN"
                              ? "text-emerald-300"
                              : "text-red-300",
                          )}
                        >
                          {formatCurrency(transaction.amount)}
                        </td>
                        <td className="px-4 py-4 min-w-[280px]">
                          {reconciled ? (
                            <div className="space-y-2">
                              {transaction.reconciliations?.map((item) => (
                                <div
                                  key={item.id}
                                  className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2"
                                >
                                  <p className="text-emerald-200 font-medium">
                                    {item.financialRecord?.description || "Registro vinculado"}
                                  </p>
                                  <p className="text-xs text-emerald-100/80 mt-1">
                                    {item.matchType} •{" "}
                                    {item.financialRecord
                                      ? formatCurrency(item.financialRecord.amount)
                                      : "Sem valor"}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : suggestions.length > 0 ? (
                            <div className="space-y-2">
                              {suggestions.slice(0, 2).map((record) => (
                                <div
                                  key={record.id}
                                  className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-3 py-2"
                                >
                                  <p className="text-white font-medium">{record.description}</p>
                                  <p className="text-xs text-slate-300 mt-1">
                                    {formatCurrency(record.amount)} • {formatDate(record.dueDate)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-500">Sem sugestão automática</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            {!reconciled && (
                              <button
                                onClick={() => handleOpenReconcileModal(transaction)}
                                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold"
                              >
                                Conciliar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {bankTransactions.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-12 text-center text-slate-500"
                      >
                        Nenhuma transação bancária sincronizada ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {view === "accounts" && !selectedBankAccount && (
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
                    <h3 className="text-lg font-semibold text-white">
                      {account.title}
                    </h3>
                    <p className="text-sm text-slate-400">{account.bankName}</p>
                    <p className="text-xs text-slate-500">
                      {account.accountType === "CHECKING"
                        ? "Conta Corrente"
                        : "Poupança"}
                    </p>

                    {account.contact && (
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span className="text-xs px-2 py-1 bg-blue-500/10 text-blue-400 rounded inline-flex items-center gap-1">
                          <User size={12} />
                          {account.contact.name}
                        </span>
                        <span className="text-xs text-slate-500">
                          {account.contact.personType === "PF"
                            ? account.contact.cpf
                            : account.contact.cnpj}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div
                  className="flex gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
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
                  <p className="text-xs text-slate-500">
                    Agência: {account.agency || "-"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Conta: {account.accountNumber}
                  </p>
                </div>
              )}

              <div className="pt-4 border-t border-slate-700">
                <p className="text-sm text-slate-400 mb-1">Saldo</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(account.balance)}
                </p>
              </div>

              <div className="mt-4">
                <span
                  className={`px-2 py-1 rounded-md text-xs font-medium ${
                    account.isActive
                      ? "bg-green-500/10 text-green-400"
                      : "bg-gray-500/10 text-gray-400"
                  }`}
                >
                  {account.isActive ? "Ativa" : "Inativa"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {view === "accounts" && selectedBankAccount && (
        <BankAccountDetails
          account={selectedBankAccount}
          onBack={() => {
            setSelectedBankAccount(null);
            fetchData();
          }}
        />
      )}

      {/* Conditions View */}
      {view === "conditions" && <PaymentConditions />}

      {/* Modal de Transação - REDESENHADO PREMIUM */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-all animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] flex flex-col antialiased">
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-20">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                    <div className={`w-2 h-6 rounded-full ${formData.type === "INCOME" ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]"}`} />
                    {editingRecord ? "Editar Transação" : "Nova Transação"}
                  </h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                    Módulo Financeiro & Fluxo de Caixa
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setModalTab("dados");
                  }}
                  className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Tabs Premium */}
              <div className="flex p-1.5 bg-slate-950 border border-slate-800 rounded-2xl gap-2">
                <button
                  type="button"
                  onClick={() => setModalTab("dados")}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                    modalTab === "dados"
                      ? "bg-slate-800 text-white shadow-xl ring-1 ring-slate-700"
                      : "text-slate-500 hover:text-slate-300 hover:bg-slate-900"
                  }`}
                >
                  <DollarSign size={14} className={modalTab === "dados" ? "text-indigo-400" : ""} />
                  Dados Gerais
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab("partes")}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                    modalTab === "partes"
                      ? "bg-slate-800 text-white shadow-xl ring-1 ring-slate-700"
                      : "text-slate-500 hover:text-slate-300 hover:bg-slate-900"
                  }`}
                >
                  <User size={14} className={modalTab === "partes" ? "text-indigo-400" : ""} />
                  Partes
                  {editingRecord?.parties && editingRecord.parties.length > 0 && (
                    <span className="ml-1 w-5 h-5 flex items-center justify-center bg-indigo-500 text-white rounded-full text-[9px] font-black">
                      {editingRecord.parties.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-900/30">

            {/* Tab: Partes da Transação */}
            {modalTab === "partes" && (
              <div className="p-6">
                {editingRecord ? (
                  <FinancialParties
                    recordId={editingRecord.id}
                    recordType={editingRecord.type as "INCOME" | "EXPENSE"}
                    bankAccounts={bankAccounts}
                    currentBankAccountId={editingRecord.bankAccount?.id}
                    onBankAccountChange={(id) => {
                      setFormData((prev) => ({ ...prev, bankAccountId: id }));
                    }}
                    onUpdate={fetchData}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 px-8 text-center space-y-6 bg-slate-950/20 rounded-3xl border border-slate-800/50 border-dashed">
                    <div className="w-20 h-20 rounded-3xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 rotate-3 border border-indigo-500/20 shadow-xl shadow-indigo-500/5 ring-1 ring-indigo-500/10">
                      <User size={40} className="-rotate-3" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-black text-white tracking-tight">
                        Configuração de Partes & Divisões
                      </h3>
                      <p className="text-xs text-slate-500 max-w-sm font-medium leading-relaxed uppercase tracking-wider">
                        Para gerenciar detalhadamente os credores, devedores e
                        pagadores desta transação, primeiro você precisa
                        <b> salvar</b> os dados básicos.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setModalTab("dados")}
                      className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                    >
                      Voltar para Dados Gerais e Salvar
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Dados Gerais (formulário refatorado) */}
            {modalTab === "dados" && (
              <form onSubmit={handleSubmit} className="px-8 py-8 space-y-8">
                {/* LINHA 1: Tipo | Categoria | Status */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-[0.2em] px-1">
                      Fluxo de Lançamento *
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) =>
                        setFormData({ ...formData, type: e.target.value })
                      }
                      className="w-full h-12 px-4 bg-slate-950 border border-slate-800 rounded-2xl text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none transition-all shadow-inner"
                      required
                    >
                      <option value="INCOME">⬆️ Receita (Entrada)</option>
                      <option value="EXPENSE">⬇️ Despesa (Saída)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-[0.2em] px-1">
                      Classificação / Categoria
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none opacity-40 group-focus-within:opacity-100 transition-opacity">
                        <Bookmark size={14} className="text-indigo-400" />
                      </div>
                      <input
                        type="text"
                        list="category-list-modal"
                        value={formData.category}
                        onChange={(e) =>
                          setFormData({ ...formData, category: e.target.value })
                        }
                        className="w-full h-12 pl-11 pr-4 bg-slate-950 border border-slate-800 rounded-2xl text-white text-sm font-bold placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-inner"
                        placeholder="Ex: Honorários, Aluguel..."
                      />
                      <datalist id="category-list-modal">
                        {categories.map((c) => (
                          <option key={c.id} value={c.name} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-[0.2em] px-1">
                      Estado da Operação *
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value })
                      }
                      className="w-full h-12 px-4 bg-slate-950 border border-slate-800 rounded-2xl text-indigo-100 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none transition-all shadow-inner"
                      required
                    >
                      <option value="PENDING">🕒 Pendente / Em Aberto</option>
                      <option value="PAID">✅ Liquidado / Pago / Recebido</option>
                      <option value="CANCELLED">🚫 Cancelado / Estornado</option>
                      <option value="OVERDUE">⚠️ Vencido / Inadimplente</option>
                    </select>
                  </div>
                </div>

                {/* LINHA 2: Valor | Parcelas (Select + Nx) | Vencimento */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 bg-slate-950/20 rounded-3xl border border-white/[0.03] shadow-inner relative overflow-hidden group/valor">
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover/valor:opacity-10 transition-opacity">
                    <DollarSign size={100} className="text-indigo-500" />
                  </div>
                  
                  <div className="md:col-span-4 space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-[0.2em] px-1">
                      Valor da Transação (R$) *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="text-emerald-500 font-black text-base drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]">
                          $
                        </span>
                      </div>
                      <input
                        ref={amountInputRef}
                        autoFocus
                        type="text"
                        inputMode="decimal"
                        value={formData.amount}
                        onChange={(e) => {
                          let next = e.target.value.replace(/[^\d.,]/g, "");
                          const commaIndex = next.indexOf(",");
                          if (commaIndex !== -1) {
                            next =
                              next.slice(0, commaIndex + 1) +
                              next.slice(commaIndex + 1).replace(/,/g, "");
                          }
                          setFormData({ ...formData, amount: next });
                        }}
                        onBlur={() => {
                          const parsed = parseAmountPtBr(formData.amount);
                          if (!Number.isFinite(parsed)) return;
                          setFormData({
                            ...formData,
                            amount: formatAmountPtBr(parsed),
                          });
                        }}
                        className="w-full h-14 pl-12 pr-4 bg-slate-950 border border-slate-800 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-black text-2xl md:text-xl shadow-lg ring-1 ring-white/5 transition-all tabular-nums"
                        placeholder="0,00"
                        required
                      />
                    </div>
                  </div>

                  <div className="md:col-span-5 space-y-2">
                    <label className="block text-[10px] font-black text-indigo-400 mb-1 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                      Plano de Pagamento / Parcelas
                      <span className="text-[8px] animate-pulse bg-indigo-500/20 px-1.5 py-0.5 rounded-full ring-1 ring-indigo-500/50 text-indigo-400">Novo</span>
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={formData.paymentConditionId}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            paymentConditionId: e.target.value,
                          });
                          if (e.target.value) setNxInput("");
                        }}
                        className="flex-1 h-14 px-4 bg-slate-950 border border-slate-800 rounded-2xl text-indigo-100 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none transition-all shadow-inner"
                      >
                        <option value="">⚡ À Vista (Uma vez)</option>
                        {paymentConditions.map((c) => (
                          <option key={c.id} value={c.id}>
                            🗓️ {c.name}
                          </option>
                        ))}
                      </select>
                      <div className="relative group/nx">
                        <input
                          type="text"
                          value={nxInput}
                          onChange={(e) => handleNxInput(e.target.value)}
                          className="w-16 h-14 px-2 bg-slate-950 border border-indigo-500/30 rounded-2xl text-indigo-400 text-base text-center font-black focus:outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder-slate-700 transition-all group-hover/nx:border-indigo-500/60"
                          placeholder="Nx"
                          title="Digite ex: 3x para dividir em 3 parcelas"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowConditionSubModal(true)}
                        className="w-14 h-14 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-2xl hover:bg-indigo-500/20 hover:scale-105 transition-all flex items-center justify-center shrink-0 active:scale-95 shadow-lg group/plus"
                        title="Criar nova Condição de Pagamento"
                      >
                        <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                      </button>
                    </div>
                  </div>

                  <div className="md:col-span-3 space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-[0.2em] px-1">
                      Data Vencimento *
                    </label>
                    <div className="relative group/date">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none opacity-40 group-focus-within/date:opacity-100 transition-opacity">
                        <Calendar size={14} className="text-indigo-400" />
                      </div>
                      <input
                        type="date"
                        value={formData.dueDate}
                        onChange={(e) =>
                          setFormData({ ...formData, dueDate: e.target.value })
                        }
                        className="w-full h-14 pl-11 pr-4 bg-slate-950 border border-slate-800 rounded-2xl text-white font-black text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-inner hover:border-slate-700"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Grid de Parcelas Geradas - DESIGN PREMIUM */}
                {installments.length > 0 && (
                  <div className="bg-slate-950/40 rounded-3xl border border-indigo-500/20 p-6 space-y-4 shadow-inner">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Calendar size={14} className="opacity-70" />
                        Cronograma de Parcelamento
                      </h3>
                      <span className="text-[9px] font-black bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full ring-1 ring-indigo-500/30 uppercase">
                        {installments.length} Parcelas
                      </span>
                    </div>
                    
                    <div className="max-h-[200px] overflow-y-auto rounded-2xl border border-slate-800/50 bg-slate-900/30">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-950/50 text-[9px] text-slate-500 font-black uppercase tracking-widest">
                            <th className="px-4 py-3 border-b border-slate-800/50">#</th>
                            <th className="px-4 py-3 border-b border-slate-800/50">Vencimento</th>
                            <th className="px-4 py-3 border-b border-slate-800/50 text-right">Valor Parcela</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {installments.map((inst, idx) => (
                            <tr
                              key={idx}
                              className="border-b border-slate-800/30 hover:bg-white/[0.02] transition-colors group/inst"
                            >
                              <td className="px-4 py-2.5 text-slate-500 font-black text-[10px]">
                                {inst.installmentNumber.toString().padStart(2, '0')}
                              </td>
                              <td className="px-4 py-2.5">
                                <input
                                  type="date"
                                  value={inst.dueDate}
                                  onChange={(e) => {
                                    const newInsts = [...installments];
                                    newInsts[idx].dueDate = e.target.value;
                                    setInstallments(newInsts);
                                  }}
                                  className="bg-transparent border-none p-0 text-slate-200 focus:text-white focus:ring-0 w-full text-xs font-bold"
                                />
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <span className="text-slate-600 text-[10px] font-black">$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={inst.amount}
                                    onChange={(e) => {
                                      const newInsts = [...installments];
                                      newInsts[idx].amount =
                                        parseFloat(e.target.value) || 0;
                                      setInstallments(newInsts);
                                    }}
                                    className="bg-transparent border-none p-0 text-slate-200 focus:text-white text-right focus:ring-0 w-24 font-black text-sm"
                                  />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-950/50">
                          <tr>
                            <td
                              colSpan={2}
                              className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider"
                            >
                              Total Conferido
                            </td>
                            <td className="px-4 py-3 text-right text-emerald-400 font-black text-base tracking-tighter shadow-sm">
                              {formatCurrency(
                                installments.reduce(
                                  (sum, i) => sum + i.amount,
                                  0,
                                ),
                              )}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* LINHA 3: Descrição */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-[0.2em] px-1">
                    Descrição Detalhada do Lançamento *
                  </label>
                  <div className="relative group">
                    <div className="absolute top-3.5 left-4 opacity-40 group-focus-within:opacity-100 transition-opacity">
                      <FileText size={16} className="text-indigo-400" />
                    </div>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      className="w-full h-14 pl-12 pr-4 bg-slate-950 border border-slate-800 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-bold text-sm shadow-inner transition-all"
                      placeholder="Ex: Pagamento de Honorários Contratuais - Processo 0001..."
                      required
                    />
                  </div>
                </div>

                {/* Processo (opcional) */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-[0.2em] px-1">
                    Vínculo com Processo Jurídico (Opcional)
                  </label>
                  {isEmbeddedInProcess ? (
                    <div className="bg-indigo-500/[0.03] border border-indigo-500/20 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-inner">
                      <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
                        <Scale size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-black text-indigo-400/70 uppercase tracking-widest leading-none mb-1">
                          Processo Vinculado Ativo
                        </p>
                        <p className="text-sm font-black text-white leading-tight">
                          {props.processContext?.title || "Processo em Tela"}
                        </p>
                        <p className="text-[11px] text-slate-500 font-bold mt-1 tracking-tight">
                          {props.processContext?.cnj || props.processContext?.code || lockedProcessId}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="relative group/search">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none opacity-40 group-focus-within/search:opacity-100 transition-opacity">
                          <Search size={16} className="text-indigo-400" />
                        </div>
                        <input
                          type="text"
                          value={processSearch}
                          onChange={(e) => setProcessSearch(e.target.value)}
                          className="w-full h-12 pl-11 pr-4 bg-slate-950 border border-slate-800 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm font-bold transition-all shadow-inner"
                          placeholder="CNJ, Código ou Título..."
                        />
                      </div>
                      <select
                        value={formData.processId}
                        onChange={(e) =>
                          setFormData({ ...formData, processId: e.target.value })
                        }
                        className="w-full h-12 px-4 bg-slate-950 border border-slate-800 rounded-2xl text-indigo-100 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none transition-all shadow-inner"
                      >
                        <option value="">🚫 Nenhum Processo</option>
                        {formData.processId &&
                          !processOptions.some(
                            (p) => p.id === formData.processId,
                          ) && (
                            <option value={formData.processId}>
                              ✓ Selecionado ({editingRecord?.process?.cnj || formData.processId})
                            </option>
                          )}
                        {loadingProcesses ? (
                          <option value="" disabled>⌛ Carregando processos...</option>
                        ) : (
                          processOptions.map((p) => (
                            <option key={p.id} value={p.id}>
                              ⚖️ {(p.code ? `${p.code} - ` : "") + (p.title || p.cnj || p.id).slice(0, 40)}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  )}
                </div>

                {/* LINHA 4: Data Pagamento | Forma Pagamento | Conta Bancária */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-[0.2em] px-1">
                      Data da Liquidação
                    </label>
                    <div className="relative group/date2">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none opacity-40 group-focus-within/date2:opacity-100 transition-opacity">
                        <CheckCircle2 size={14} className="text-emerald-400" />
                      </div>
                      <input
                        type="date"
                        value={formData.paymentDate}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            paymentDate: e.target.value,
                          })
                        }
                        className="w-full h-12 pl-11 pr-4 bg-slate-950 border border-slate-800 rounded-2xl text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-[0.2em] px-1">
                      Método de Pagamento
                    </label>
                    <select
                      value={formData.paymentMethod}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          paymentMethod: e.target.value,
                        })
                      }
                      className="w-full h-12 px-4 bg-slate-950 border border-slate-800 rounded-2xl text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none transition-all shadow-inner"
                    >
                      <option value="">💳 Selecionar Método...</option>
                      <option value="PIX">💎 PIX (Instantâneo)</option>
                      <option value="BOLETO">📄 Boleto Bancário</option>
                      <option value="TED">🏦 Transf. Bancária (TED/DOC)</option>
                      <option value="DINHEIRO">💵 Dinheiro (Espécie)</option>
                      <option value="CARTAO">💳 Cartão de Crédito/Débito</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-[0.2em] px-1">
                      Conta Destino/Origem
                    </label>
                    <select
                      value={formData.bankAccountId}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          bankAccountId: e.target.value,
                        })
                      }
                      className="w-full h-12 px-4 bg-slate-950 border border-slate-800 rounded-2xl text-indigo-400 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none transition-all shadow-inner"
                    >
                      <option value="">🏦 Selecionar Conta...</option>
                      {bankAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          🏦 {account.bankName || account.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* LINHA 5: Origem | Tags */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-[0.2em] px-1">
                      Fonte de Registro (Origem)
                    </label>
                    <div className="relative">
                      <select
                        value={formData.origin}
                        onChange={(e) =>
                          setFormData({ ...formData, origin: e.target.value })
                        }
                        className="w-full h-12 px-4 bg-slate-950 border border-slate-800 rounded-2xl text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none transition-all shadow-inner"
                      >
                        <option value="MANUAL">✏️ Lançamento Manual</option>
                        <option value="NF">📄 Nota Fiscal Eletrônica</option>
                        <option value="COMPRA">🛒 Ordem de Compra</option>
                        <option value="PROPOSTA">📋 Proposta Comercial</option>
                        <option value="JUDICIAL">⚖️ Mandado Judicial</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-[0.2em] px-1">
                      Etiquetas de Identificação
                    </label>
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-2 min-h-[48px] shadow-inner flex items-center">
                      {editingRecord ? (
                        <InlineTags
                          tags={editingRecord.tags || []}
                          entityId={editingRecord.id}
                          entityType="financial"
                          onRefresh={fetchData}
                        />
                      ) : (
                        <p className="text-[10px] text-slate-600 italic px-2 font-bold uppercase tracking-wider">
                          Auto-atribuição disponível após salvar
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* LINHA 6: Observações (com paste de imagens) */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-[0.2em] px-1 flex items-center justify-between">
                    <span>Anotações & Observações</span>
                    <span className="text-[9px] font-bold text-slate-600 bg-slate-950 px-2 py-0.5 rounded-full lowercase">
                      Ctrl+V para colar imagens
                    </span>
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    onPaste={handleNotesPaste}
                    className="w-full h-32 p-4 bg-slate-950 border border-slate-800 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm font-medium transition-all shadow-inner resize-none"
                    placeholder="Notas internas, instruções de conciliação ou detalhes adicionais..."
                  />
                  
                  {/* Preview de imagens coladas PREMIUM */}
                  {pastedImages.length > 0 && (
                    <div className="flex gap-3 mt-4 flex-wrap p-2 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                      {pastedImages.map((img, idx) => (
                        <div key={idx} className="relative group/img aspect-square w-20">
                          <img
                            src={img.url}
                            alt={`Colada ${idx + 1}`}
                            className="w-full h-full object-cover rounded-xl border border-slate-700 shadow-lg group-hover/img:border-indigo-500/50 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              URL.revokeObjectURL(img.url);
                              setPastedImages((prev) =>
                                prev.filter((_, i) => i !== idx),
                              );
                            }}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-all shadow-xl hover:scale-110 active:scale-95 z-10"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Anexos PREMIUM */}
                <div className="space-y-4 pt-4 pb-8">
                  <div className="flex items-center justify-between px-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                      Documentação & Comprovantes
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        ref={attachmentInputRef}
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                        onChange={(e) => {
                          if (e.target.files) {
                            setAttachments((prev) => [
                              ...prev,
                              ...Array.from(e.target.files!),
                            ]);
                          }
                        }}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => attachmentInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500/20 transition-all active:scale-95"
                      >
                        <Upload size={12} />
                        Anexar Arquivos
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Anexos já salvos */}
                    {editingRecord?.metadata?.attachments?.map((att: any, attIdx: number) => {
                      const docUrl = savedAttachmentUrls[att.fileName];
                      return (
                        <div
                          key={"saved-" + attIdx}
                          className="group/saved flex items-center gap-3 bg-slate-950/50 border border-slate-800 rounded-2xl p-3 hover:border-indigo-500/30 transition-all"
                        >
                          <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 shrink-0">
                            <FileText size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <AttachmentPreview url={docUrl} title={att.originalName}>
                              <a
                                href={docUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-xs font-black text-white hover:text-indigo-400 truncate"
                              >
                                {att.originalName}
                              </a>
                            </AttachmentPreview>
                            <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-0.5">Arquivo Salvo</p>
                          </div>
                        </div>
                      );
                    })}

                    {/* Novos Anexos */}
                    {attachments.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-3 animate-in slide-in-from-right-4 duration-300"
                      >
                        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 shrink-0">
                          <CheckCircle2 size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-white truncate">{file.name}</p>
                          <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest mt-0.5">
                            Ready • {(file.size / 1024).toFixed(0)} KB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-2 text-slate-600 hover:text-red-400 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {attachments.length === 0 && (!editingRecord?.metadata?.attachments || editingRecord.metadata.attachments.length === 0) && (
                    <div className="py-8 text-center bg-slate-950/20 rounded-3xl border border-slate-800/50 border-dashed">
                      <Paperclip size={24} className="mx-auto text-slate-700 mb-2 opacity-30" />
                      <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.2em]">Nenhum documento vinculado</p>
                    </div>
                  )}
                </div>
              </form>
            )}

            {/* Footer Fixo Premium */}
            <div className="px-8 py-6 border-t border-slate-800 bg-slate-950/50 backdrop-blur-md flex items-center justify-between gap-4 sticky bottom-0 z-20 mt-auto">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-slate-500 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
              >
                Cancelar
              </button>
              
              <div className="flex items-center gap-3">
                {editingRecord &&
                  isOpenRecord(editingRecord) &&
                  !(editingRecord.children && editingRecord.children.length > 0) && (
                    <button
                      type="button"
                      onClick={() => handleOpenSettleModal(editingRecord)}
                      disabled={!hasPartiesToSettle(editingRecord)}
                      className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 border ${
                        hasPartiesToSettle(editingRecord)
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-white"
                          : "bg-slate-950 border-slate-800 text-slate-600 cursor-not-allowed"
                      }`}
                      title={
                        hasPartiesToSettle(editingRecord)
                          ? "Liquidar Lançamento"
                          : "Defina Credor e Devedor para liquidar"
                      }
                    >
                      Liquidar
                    </button>
                  )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleSubmit(e, { closeAfterSave: false });
                  }}
                  disabled={submitting}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                >
                  {submitting ? "Salvando..." : "Salvar"}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleSubmit(e, { closeAfterSave: true });
                  }}
                  disabled={submitting}
                  className="group relative overflow-hidden px-10 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-600/20 active:scale-95 disabled:opacity-50"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {submitting ? "Salvando..." : "Salvar e Sair"}
                    {!submitting && <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />}
                  </span>
                </button>
              </div>
            </div>

            {/* Sub-Modal: Condições de Pagamento */}
            {showConditionSubModal && (
              <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center z-[100] p-4 transition-all animate-in fade-in zoom-in duration-300">
                <div className="bg-slate-900 rounded-3xl w-full max-w-4xl max-h-[85vh] overflow-hidden border border-slate-700 shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col">
                  <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 sticky top-0 z-10 backdrop-blur">
                    <div>
                      <h3 className="text-xl font-black text-white tracking-tight">Condições de Pagamento</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Gestão de Prazos e Parcelamento</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowConditionSubModal(false);
                        fetchPaymentConditions();
                      }}
                      className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 bg-slate-900/30">
                    <PaymentConditions />
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Conta Bancária */}
      {showIntegrationModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <form onSubmit={handleSubmitIntegration}>
              <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {editingIntegration
                      ? "Editar Integração Banco Inter"
                      : "Nova Integração Banco Inter"}
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Configure conexão, credenciais e vínculo com a conta bancária
                    interna do Xjur.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIntegrationModal(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-300">
                      Nome da integração
                    </span>
                    <input
                      value={integrationFormData.displayName}
                      onChange={(e) =>
                        setIntegrationFormData((prev) => ({
                          ...prev,
                          displayName: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                      placeholder="Banco Inter"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-300">
                      Ambiente
                    </span>
                    <select
                      value={integrationFormData.environment}
                      onChange={(e) =>
                        setIntegrationFormData((prev) => ({
                          ...prev,
                          environment: e.target.value as "SANDBOX" | "PRODUCTION",
                        }))
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                    >
                      <option value="SANDBOX">Sandbox</option>
                      <option value="PRODUCTION">Produção</option>
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-300">
                      Conta bancária interna
                    </span>
                    <select
                      value={integrationFormData.bankAccountId}
                      onChange={(e) =>
                        setIntegrationFormData((prev) => ({
                          ...prev,
                          bankAccountId: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                    >
                      <option value="">Selecionar depois</option>
                      {bankAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.title} • {account.bankName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-300">
                      External Account ID
                    </span>
                    <input
                      value={integrationFormData.externalAccountId}
                      onChange={(e) =>
                        setIntegrationFormData((prev) => ({
                          ...prev,
                          externalAccountId: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-300">
                      Titular
                    </span>
                    <input
                      value={integrationFormData.accountHolderName}
                      onChange={(e) =>
                        setIntegrationFormData((prev) => ({
                          ...prev,
                          accountHolderName: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-300">
                      Documento do titular
                    </span>
                    <input
                      value={integrationFormData.accountHolderDocument}
                      onChange={(e) =>
                        setIntegrationFormData((prev) => ({
                          ...prev,
                          accountHolderDocument: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-slate-300">
                        Agência
                      </span>
                      <input
                        value={integrationFormData.branchCode}
                        onChange={(e) =>
                          setIntegrationFormData((prev) => ({
                            ...prev,
                            branchCode: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-slate-300">
                        Conta
                      </span>
                      <input
                        value={integrationFormData.accountNumber}
                        onChange={(e) =>
                          setIntegrationFormData((prev) => ({
                            ...prev,
                            accountNumber: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 space-y-4">
                  <h3 className="text-lg font-bold text-white">Credenciais Inter</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-slate-300">
                        Client ID
                      </span>
                      <input
                        value={integrationFormData.clientId}
                        onChange={(e) =>
                          setIntegrationFormData((prev) => ({
                            ...prev,
                            clientId: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-slate-300">
                        Client Secret
                      </span>
                      <input
                        value={integrationFormData.clientSecret}
                        onChange={(e) =>
                          setIntegrationFormData((prev) => ({
                            ...prev,
                            clientSecret: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white"
                      />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm font-semibold text-slate-300">
                        Certificado A1 em Base64
                      </span>
                      <textarea
                        value={integrationFormData.certificateBase64}
                        onChange={(e) =>
                          setIntegrationFormData((prev) => ({
                            ...prev,
                            certificateBase64: e.target.value,
                          }))
                        }
                        rows={4}
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white"
                        placeholder="Cole aqui o conteúdo Base64 do PFX/P12 quando quiser gravar no cofre"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-slate-300">
                        Senha do certificado
                      </span>
                      <input
                        value={integrationFormData.certificatePassword}
                        onChange={(e) =>
                          setIntegrationFormData((prev) => ({
                            ...prev,
                            certificatePassword: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-slate-300">
                        Token URL customizada
                      </span>
                      <input
                        value={integrationFormData.tokenUrl}
                        onChange={(e) =>
                          setIntegrationFormData((prev) => ({
                            ...prev,
                            tokenUrl: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white"
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-white">Webhook</h3>
                      <p className="text-sm text-slate-400">
                        Prepare a integração para liquidações e eventos futuros.
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={integrationFormData.webhookEnabled}
                        onChange={(e) =>
                          setIntegrationFormData((prev) => ({
                            ...prev,
                            webhookEnabled: e.target.checked,
                          }))
                        }
                      />
                      Ativar
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-slate-300">
                        URL do webhook
                      </span>
                      <input
                        value={integrationFormData.webhookUrl}
                        onChange={(e) =>
                          setIntegrationFormData((prev) => ({
                            ...prev,
                            webhookUrl: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-slate-300">
                        Segredo do webhook
                      </span>
                      <input
                        value={integrationFormData.webhookSecret}
                        onChange={(e) =>
                          setIntegrationFormData((prev) => ({
                            ...prev,
                            webhookSecret: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="px-6 py-5 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowIntegrationModal(false)}
                  className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold"
                >
                  {submitting ? "Salvando..." : "Salvar Integração"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReconcileModal && selectedBankTransaction && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <form onSubmit={handleSubmitReconciliation}>
              <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Conciliar Transação Bancária
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    {selectedBankTransaction.description} •{" "}
                    {formatCurrency(selectedBankTransaction.amount)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReconcileModal(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <label className="space-y-2 block">
                  <span className="text-sm font-semibold text-slate-300">
                    Lançamento financeiro
                  </span>
                  <select
                    value={reconcileFormData.financialRecordId}
                    onChange={(e) =>
                      setReconcileFormData((prev) => ({
                        ...prev,
                        financialRecordId: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                  >
                    <option value="">Selecione</option>
                    {getSuggestedRecords(selectedBankTransaction).length > 0 && (
                      <optgroup label="Sugestões automáticas">
                        {getSuggestedRecords(selectedBankTransaction).map((record) => (
                          <option key={record.id} value={record.id}>
                            {record.description} • {formatCurrency(record.amount)} •{" "}
                            {formatDate(record.dueDate)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Demais pendências">
                      {reconcileRecords.map((record) => (
                        <option key={record.id} value={record.id}>
                          {record.description} • {formatCurrency(record.amount)} •{" "}
                          {record.type}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-300">
                      Tipo de conciliação
                    </span>
                    <select
                      value={reconcileFormData.matchType}
                      onChange={(e) =>
                        setReconcileFormData((prev) => ({
                          ...prev,
                          matchType: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                    >
                      <option value="MANUAL">Manual</option>
                      <option value="SUGGESTED">Sugerida</option>
                      <option value="AUTO">Automática validada</option>
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-300">
                      Observação
                    </span>
                    <input
                      value={reconcileFormData.notes}
                      onChange={(e) =>
                        setReconcileFormData((prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                    />
                  </label>
                </div>
              </div>

              <div className="px-6 py-5 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowReconcileModal(false)}
                  className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold"
                >
                  {submitting ? "Conciliando..." : "Confirmar Conciliação"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBankModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg w-full max-w-lg">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                {editingBank ? "Editar Conta Bancária" : "Nova Conta Bancária"}
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
                  onChange={(e) =>
                    setBankFormData({ ...bankFormData, title: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex: Conta Empresa - Operacional"
                  required
                />
                <p className="text-xs text-slate-400 mt-1">
                  Nome para identificar esta conta
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nome do Banco *
                </label>
                <input
                  type="text"
                  value={bankFormData.bankName}
                  onChange={(e) =>
                    setBankFormData({
                      ...bankFormData,
                      bankName: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex: Banco do Brasil"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Tipo de Conta *
                </label>
                <select
                  value={bankFormData.accountType}
                  onChange={(e) =>
                    setBankFormData({
                      ...bankFormData,
                      accountType: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="CHECKING">Conta Corrente</option>
                  <option value="SAVINGS">Poupança</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Agência
                  </label>
                  <input
                    type="text"
                    value={bankFormData.agency}
                    onChange={(e) =>
                      setBankFormData({
                        ...bankFormData,
                        agency: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="0000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Número da Conta
                  </label>
                  <input
                    type="text"
                    value={bankFormData.accountNumber}
                    onChange={(e) =>
                      setBankFormData({
                        ...bankFormData,
                        accountNumber: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="00000-0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Saldo Inicial
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={bankFormData.balance}
                  onChange={(e) =>
                    setBankFormData({
                      ...bankFormData,
                      balance: e.target.value,
                    })
                  }
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
                  onSelectContact={(id) =>
                    setBankFormData({ ...bankFormData, contactId: id })
                  }
                  hideRole={true}
                  hideQualification={true}
                  showAction={false}
                  className="!bg-transparent !p-0 !border-0 !shadow-none"
                  context="financial"
                />
                {bankFormData.contactId && (
                  <p className="text-xs text-indigo-400 mt-2 flex items-center gap-1">
                    <User size={12} /> Selecionado:{" "}
                    {contacts.find((c) => c.id === bankFormData.contactId)
                      ?.name || "ID: " + bankFormData.contactId}
                  </p>
                )}
                {loadingContacts && (
                  <p className="text-xs text-slate-400 mt-1">
                    Carregando contatos...
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-1">
                  Selecione o contato titular desta conta (CPF ou CNPJ)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Observações
                </label>
                <textarea
                  value={bankFormData.notes}
                  onChange={(e) =>
                    setBankFormData({ ...bankFormData, notes: e.target.value })
                  }
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
                    submitting ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {submitting
                    ? "Salvando..."
                    : editingBank
                      ? "Atualizar"
                      : "Criar"}
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
              <button
                onClick={() => setShowSettleModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Resumo do registro */}
            <div className="p-4 bg-gradient-to-r from-slate-700/60 to-slate-700/30 rounded-lg mb-5 border border-slate-600/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Descrição</p>
                  <p className="text-base font-semibold text-white">
                    {settlingRecord.description}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-400">Valor Original</p>
                  <p className="text-xl font-bold text-white">
                    {formatCurrency(settlingRecord.amount)}
                  </p>
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
                  <p className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">
                    Lançamento
                  </p>
                  <p className="text-sm font-medium text-slate-300 mt-0.5">
                    {settlingRecord.createdAt
                      ? formatDate(settlingRecord.createdAt)
                      : formatDate(settlingRecord.dueDate)}
                  </p>
                </div>

                <ArrowRight size={16} className="text-slate-500 shrink-0" />

                {/* Data de Vencimento */}
                <div className="flex-1 p-3 bg-slate-800/60 rounded-lg border border-slate-600/40">
                  <p className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">
                    Vencimento
                  </p>
                  <p className="text-sm font-medium text-slate-300 mt-0.5">
                    {formatDate(settlingRecord.dueDate)}
                  </p>
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
                      onChange={(e) =>
                        setSettleData({
                          ...settleData,
                          paymentDate: e.target.value,
                        })
                      }
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
                          {calcSettleDaysLate}{" "}
                          {calcSettleDaysLate === 1 ? "dia" : "dias"} de atraso
                        </span>
                      ) : calcSettleDaysLate === 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-500/15 text-green-400 border border-green-500/25">
                          <CheckCircle2 size={12} />
                          Em dia
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/25">
                          <CheckCircle2 size={12} />
                          {Math.abs(calcSettleDaysLate)}{" "}
                          {Math.abs(calcSettleDaysLate) === 1 ? "dia" : "dias"}{" "}
                          antecipado
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
                  <AlertTriangle size={16} className="text-yellow-400" />
                  Encargos
                  {calcSettleDaysLate > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-red-500/15 text-red-400 rounded ml-auto">
                      Auto-aplicado por atraso
                    </span>
                  )}
                </h3>

                {/* Multa */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Multa
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={settleData.finePercent}
                        onChange={(e) =>
                          handleSettlePercentChange(
                            "finePercent",
                            e.target.value,
                          )
                        }
                        className="w-full px-3 py-1.5 pr-7 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500"
                        placeholder="0"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                        %
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={settleData.fine}
                        onChange={(e) =>
                          handleSettleValueChange("fine", e.target.value)
                        }
                        className="w-full px-3 py-1.5 pr-7 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500"
                        placeholder="0,00"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                        R$
                      </span>
                    </div>
                  </div>
                </div>

                {/* Juros */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Juros
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={settleData.interestPercent}
                        onChange={(e) =>
                          handleSettlePercentChange(
                            "interestPercent",
                            e.target.value,
                          )
                        }
                        className="w-full px-3 py-1.5 pr-7 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500"
                        placeholder="0"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                        %
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={settleData.interest}
                        onChange={(e) =>
                          handleSettleValueChange("interest", e.target.value)
                        }
                        className="w-full px-3 py-1.5 pr-7 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500"
                        placeholder="0,00"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                        R$
                      </span>
                    </div>
                  </div>
                </div>

                {/* Correção Monetária */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Correção Monetária
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={settleData.monetaryCorrectionPercent}
                        onChange={(e) =>
                          handleSettlePercentChange(
                            "monetaryCorrectionPercent",
                            e.target.value,
                          )
                        }
                        className="w-full px-3 py-1.5 pr-7 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500"
                        placeholder="0"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                        %
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={settleData.monetaryCorrection}
                        onChange={(e) =>
                          handleSettleValueChange(
                            "monetaryCorrection",
                            e.target.value,
                          )
                        }
                        className="w-full px-3 py-1.5 pr-7 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500"
                        placeholder="0,00"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                        R$
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* === ACRÉSCIMOS/DESCONTO === */}
              <div className="border border-blue-500/20 rounded-lg p-4 space-y-3 bg-blue-500/5">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Percent size={16} className="text-blue-400" />{" "}
                  Acréscimos/Desconto
                </h3>
                <div className="grid grid-cols-2 gap-2 items-end">
                  <div className="relative">
                    <label className="block text-xs text-slate-400 mb-1">
                      %
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={settleData.discountPercent}
                      onChange={(e) =>
                        handleSettlePercentChange(
                          "discountPercent",
                          e.target.value,
                        )
                      }
                      className="w-full px-3 py-1.5 pr-7 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="0"
                    />
                    <span className="absolute right-2.5 bottom-[7px] text-xs text-slate-500">
                      %
                    </span>
                  </div>
                  <div className="relative">
                    <label className="block text-xs text-slate-400 mb-1">
                      Valor (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={settleData.discount}
                      onChange={(e) =>
                        handleSettleValueChange("discount", e.target.value)
                      }
                      className="w-full px-3 py-1.5 pr-7 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="0,00"
                    />
                    <span className="absolute right-2.5 bottom-[7px] text-xs text-slate-500">
                      R$
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">
                  Use valor positivo para acréscimo, negativo para desconto
                </p>
              </div>

              {/* === VALOR FINAL EDITÁVEL === */}
              <div className="p-4 rounded-lg border-2 border-green-500/30 bg-green-500/5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <label className="text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      Valor Total a Pagar{" "}
                      <span className="text-red-400">*</span>
                    </label>
                    <div className="flex items-baseline gap-2 mt-1">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-400 font-bold text-sm">
                          R$
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={
                            settleFinalOverride !== ""
                              ? settleFinalOverride
                              : calcSettleFinalAmount.toFixed(2)
                          }
                          onChange={(e) =>
                            handleSettleFinalOverride(e.target.value)
                          }
                          className="w-full pl-10 pr-3 py-2 bg-slate-700/60 border border-green-500/30 rounded-lg text-2xl font-bold text-green-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                      {calcSettleFinalAmount !== settlingRecord.amount && (
                        <span className="text-sm text-slate-500 line-through shrink-0">
                          {formatCurrency(settlingRecord.amount)}
                        </span>
                      )}
                    </div>
                    {settleFinalOverride !== "" && (
                      <button
                        type="button"
                        onClick={() => setSettleFinalOverride("")}
                        className="text-[10px] text-blue-400 hover:text-blue-300 mt-1 underline"
                      >
                        Restaurar valor calculado (
                        {formatCurrency(
                          (() => {
                            if (!settlingRecord) return 0;
                            let t = Number(settlingRecord.amount);
                            t +=
                              (parseFloat(settleData.fine) || 0) +
                              (parseFloat(settleData.interest) || 0) +
                              (parseFloat(settleData.monetaryCorrection) || 0);
                            t -= parseFloat(settleData.discount) || 0;
                            return Math.max(0, Math.round(t * 100) / 100);
                          })(),
                        )}
                        )
                      </button>
                    )}
                  </div>
                  <div className="shrink-0">
                    {settlingRecord &&
                      calcSettleFinalAmount > settlingRecord.amount && (
                        <span className="text-xs px-2 py-1 bg-red-500/10 text-red-400 rounded-full border border-red-500/20">
                          +
                          {formatCurrency(
                            calcSettleFinalAmount - settlingRecord.amount,
                          )}
                        </span>
                      )}
                    {settlingRecord &&
                      calcSettleFinalAmount < settlingRecord.amount && (
                        <span className="text-xs px-2 py-1 bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20">
                          -
                          {formatCurrency(
                            settlingRecord.amount - calcSettleFinalAmount,
                          )}
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
                  <select
                    value={settleData.paymentMethod}
                    onChange={(e) =>
                      setSettleData({
                        ...settleData,
                        paymentMethod: e.target.value,
                      })
                    }
                    className={`w-full px-4 py-2 bg-slate-700 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 ${
                      !settleData.paymentMethod
                        ? "border-red-500/40"
                        : "border-slate-600"
                    }`}
                    required
                  >
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
                  <select
                    value={settleData.bankAccountId}
                    onChange={(e) =>
                      setSettleData({
                        ...settleData,
                        bankAccountId: e.target.value,
                      })
                    }
                    className={`w-full px-4 py-2 bg-slate-700 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 ${
                      !settleData.bankAccountId
                        ? "border-red-500/40"
                        : "border-slate-600"
                    }`}
                    required
                  >
                    <option value="">Selecione</option>
                    {bankAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Observações (com suporte a paste de imagem) */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-1.5">
                  Observações
                  <span className="text-[10px] text-slate-500 font-normal">
                    (Cole imagens com Ctrl+V)
                  </span>
                </label>
                <textarea
                  value={settleData.notes}
                  onChange={(e) =>
                    setSettleData({ ...settleData, notes: e.target.value })
                  }
                  onPaste={handleSettlePaste}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[60px] text-sm"
                  placeholder="Observações sobre a liquidação... (Ctrl+V para colar imagens)"
                />
                {/* Preview de imagens coladas */}
                {settlePastedImages.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {settlePastedImages.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={img.url}
                          alt={img.name}
                          className="h-16 w-16 object-cover rounded-lg border border-slate-600"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            URL.revokeObjectURL(img.url);
                            setSettlePastedImages((prev) =>
                              prev.filter((_, i) => i !== idx),
                            );
                            setSettleAttachments((prev) =>
                              prev.filter((f) => f.name !== img.name),
                            );
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
                  <span className="text-[10px] text-slate-500 font-normal">
                    (Comprovantes, Recibos, etc.)
                  </span>
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
                      <div
                        key={idx}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-700/40 rounded-lg border border-slate-600/30"
                      >
                        <Paperclip
                          size={14}
                          className="text-indigo-400 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white truncate">
                            {file.name}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {formatFileSize(file.size)}
                          </p>
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
                <button
                  type="button"
                  onClick={() => setShowSettleModal(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                >
                  Cancelar (ESC)
                </button>
                <button
                  type="submit"
                  disabled={submitting || !isSettleFormValid}
                  className={`flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                    submitting || !isSettleFormValid
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                  title={
                    !isSettleFormValid
                      ? (!hasPartiesToSettle(settlingRecord!) 
                          ? "Defina Credor e Devedor na transação para liquidar" 
                          : "Preencha todos os campos obrigatórios")
                      : ""
                  }
                >
                  <CheckCircle2 size={18} />
                  {submitting
                    ? "Liquidando..."
                    : `Liquidar ${formatCurrency(calcSettleFinalAmount)}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        title="Financeiro"
        sections={helpFinancialBankingHubDetailed}
      />
    </div>
  );
}
