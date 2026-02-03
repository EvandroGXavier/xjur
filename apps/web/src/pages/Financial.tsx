import { useState, useEffect } from 'react';
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
  paymentMethod?: string;
  notes?: string;
  process?: {
    id: string;
    cnj: string;
  };
  bankAccount?: {
    id: string;
    bankName: string;
  };
}

interface BankAccount {
  id: string;
  bankName: string;
  accountType: string;
  accountNumber?: string;
  agency?: string;
  balance: number;
  isActive: boolean;
}

interface Dashboard {
  summary: {
    totalIncome: number;
    totalExpense: number;
    balance: number;
    pendingIncome: number;
    pendingExpense: number;
    overdueCount: number;
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
  const [editingRecord, setEditingRecord] = useState<FinancialRecord | null>(null);
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);

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
    paymentMethod: '',
    bankAccountId: '',
    notes: '',
  });

  const [bankFormData, setBankFormData] = useState({
    bankName: '',
    accountType: 'CHECKING',
    accountNumber: '',
    agency: '',
    balance: '',
    notes: '',
  });

  useEffect(() => {
    fetchData();
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

  const handleOpenModal = (record?: FinancialRecord) => {
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
        paymentMethod: record.paymentMethod || '',
        bankAccountId: record.bankAccount?.id || '',
        notes: record.notes || '',
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
        paymentMethod: '',
        bankAccountId: '',
        notes: '',
      });
    }
    setShowModal(true);
  };

  const handleOpenBankModal = (account?: BankAccount) => {
    if (account) {
      setEditingBank(account);
      setBankFormData({
        bankName: account.bankName,
        accountType: account.accountType,
        accountNumber: account.accountNumber || '',
        agency: account.agency || '',
        balance: account.balance.toString(),
        notes: '',
      });
    } else {
      setEditingBank(null);
      setBankFormData({
        bankName: '',
        accountType: 'CHECKING',
        accountNumber: '',
        agency: '',
        balance: '0',
        notes: '',
      });
    }
    setShowBankModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.description || !formData.amount || !formData.dueDate) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const tenantId = user.tenantId || 'default-tenant-id';

      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        tenantId,
        bankAccountId: formData.bankAccountId || undefined,
      };

      if (editingRecord) {
        await api.put(`/financial/records/${editingRecord.id}?tenantId=${tenantId}`, payload);
        toast.success('Registro atualizado com sucesso');
      } else {
        await api.post('/financial/records', payload);
        toast.success('Registro criado com sucesso');
      }

      setShowModal(false);
      fetchData();
    } catch (error) {
      toast.error('Erro ao salvar registro');
      console.error(error);
    }
  };

  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!bankFormData.bankName) {
      toast.error('Preencha o nome do banco');
      return;
    }

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const tenantId = user.tenantId || 'default-tenant-id';

      const payload = {
        ...bankFormData,
        balance: parseFloat(bankFormData.balance),
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
      fetchData();
    } catch (error) {
      toast.error('Erro ao salvar conta bancária');
      console.error(error);
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
            <button
              onClick={() => handleOpenModal()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <Plus size={20} />
              Nova Transação
            </button>
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
                  <tr key={record.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="text-sm font-medium text-white">{record.description}</p>
                        {record.bankAccount && (
                          <p className="text-xs text-slate-400">{record.bankAccount.bankName}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getTypeBadge(record.type)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {record.category || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {formatDate(record.dueDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(record.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-bold ${record.type === 'INCOME' ? 'text-green-400' : 'text-red-400'}`}>
                        {record.type === 'INCOME' ? '+' : '-'}{formatCurrency(record.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
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
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-500/10 rounded-lg">
                    <Building2 className="text-indigo-400" size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{account.bankName}</h3>
                    <p className="text-sm text-slate-400">
                      {account.accountType === 'CHECKING' ? 'Conta Corrente' : 'Poupança'}
                    </p>
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
                    <option value="INCOME">Receita</option>
                    <option value="EXPENSE">Despesa</option>
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
                    <option value="PAID">Pago</option>
                    <option value="CANCELLED">Cancelado</option>
                    <option value="OVERDUE">Vencido</option>
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
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                >
                  {editingRecord ? 'Atualizar' : 'Criar'}
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
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                >
                  {editingBank ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
