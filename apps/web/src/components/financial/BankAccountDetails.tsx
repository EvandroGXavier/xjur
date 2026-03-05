import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Upload, FileText, Lock, Unlock, Search, Eye, EyeOff, User as UserIcon, ShieldAlert } from 'lucide-react';
import { SecurityTab } from '../ui/SecurityTab';
import { api } from '../../services/api';
import { toast } from 'sonner';

interface BankAccountDetailsProps {
  account: any;
  onBack: () => void;
}

export function BankAccountDetails({ account, onBack }: BankAccountDetailsProps) {
  const [activeTab, setActiveTab] = useState<'ALL' | 'IN' | 'OUT' | 'CONCILIATION' | 'SECURITY'>('ALL');
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Secret Modal State
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [secretUsername, setSecretUsername] = useState('');
  const [secretPassword, setSecretPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSecretUnlocked, setIsSecretUnlocked] = useState(false);

  useEffect(() => {
    fetchAccountRecords();
  }, [account.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + F8 to open secret area
      if (e.ctrlKey && e.key === 'F8') {
        e.preventDefault();
        setShowSecretModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchAccountRecords = async () => {
    try {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const tenantId = user.tenantId || 'default-tenant-id';
      const res = await api.get(`/financial/records?tenantId=${tenantId}`);
      // Filtrar no frontend por enquanto (depois pode ser query backend)
      const accRecords = Array.isArray(res.data) ? res.data.filter((r: any) => r.bankAccount?.id === account.id) : [];
      setRecords(accRecords);
    } catch (e) {
      toast.error('Erro ao carregar movimentações');
    } finally {
      setLoading(false);
    }
  };

  const unlockSecret = async () => {
    try {
      if (!secretUsername || !secretPassword) {
        toast.error('Informe usuário e senha!');
        return;
      }

      // 1. Validar as credenciais do supervisor via API
      const response = await api.post('/auth/login', {
        email: secretUsername,
        password: secretPassword
      });

      const supervisor = response.data.user;
      const perms = supervisor.permissions || {};

      // 2. Verificar se o supervisor tem a permissão específica: security_financial
      // Administradores e Owners têm acesso total por padrão
      const hasPermission = 
        supervisor.role === 'ADMIN' || 
        supervisor.role === 'OWNER' || 
        (perms['security_financial'] && perms['security_financial'].access === true);

      if (hasPermission) {
        setIsSecretUnlocked(true);
        setShowSecretModal(false);
        setActiveTab('SECURITY');
        toast.success(`Acesso Supervisor concedido: ${supervisor.name}`);
      } else {
        toast.error('Este usuário não possui o nível de acesso "Segurança_Contas Bancarias"!');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Falha na autenticação do Supervisor');
    } finally {
      setSecretPassword('');
    }
  };

  const filteredRecords = useMemo(() => {
    let filtered = records;
    if (activeTab === 'IN') filtered = filtered.filter(r => r.type === 'INCOME');
    if (activeTab === 'OUT') filtered = filtered.filter(r => r.type === 'EXPENSE');

    if (searchTerm) {
      filtered = filtered.filter(r => r.description.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return filtered;
  }, [records, activeTab, searchTerm]);

  const totalIn = records.filter(r => r.type === 'INCOME').reduce((acc, r) => acc + Number(r.amountFinal || r.amount), 0);
  const totalOut = records.filter(r => r.type === 'EXPENSE').reduce((acc, r) => acc + Number(r.amountFinal || r.amount), 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 border-b border-slate-700 pb-4">
        <button onClick={onBack} className="p-2 bg-slate-800 rounded-md hover:bg-slate-700 transition">
          <ArrowLeft size={18} className="text-slate-300" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            {account.title} 
            {isSecretUnlocked && (
              <span title="Modo Supervisor Ativo">
                <Unlock size={16} className="text-yellow-500" />
              </span>
            )}
          </h2>
          <p className="text-slate-400 text-sm">Agência: {account.agency} | Conta: {account.accountNumber}</p>
        </div>
        <div className="ml-auto flex gap-4">
          <div className="text-right">
            <p className="text-xs text-slate-500">Saldo Atual</p>
            <p className="text-xl font-bold text-white">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(account.balance)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-4 border-b border-slate-700 pb-2">
        <TabButton active={activeTab === 'ALL'} onClick={() => setActiveTab('ALL')}>Movimentações</TabButton>
        <TabButton active={activeTab === 'IN'} onClick={() => setActiveTab('IN')}>Entradas</TabButton>
        <TabButton active={activeTab === 'OUT'} onClick={() => setActiveTab('OUT')}>Saídas</TabButton>
        <TabButton active={activeTab === 'CONCILIATION'} onClick={() => setActiveTab('CONCILIATION')}>Conciliação</TabButton>
        {isSecretUnlocked && (
          <TabButton active={activeTab === 'SECURITY'} onClick={() => setActiveTab('SECURITY')} icon={<ShieldAlert size={14} className="text-yellow-500" />}>
            <span className="text-yellow-500">Segurança</span>
          </TabButton>
        )}
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex justify-center items-center h-64 text-slate-400">Carregando...</div>
        ) : (
          <>
            {(activeTab === 'ALL' || activeTab === 'IN' || activeTab === 'OUT') && (
              <div className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <div className="relative w-72">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="Pesquisar movimentação..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex gap-4 text-sm font-semibold">
                    <span className="text-green-400">Entradas: R$ {totalIn.toFixed(2)}</span>
                    <span className="text-red-400">Saídas: R$ {totalOut.toFixed(2)}</span>
                  </div>
                </div>

                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-700/50">
                    <tr>
                      <th className="px-4 py-3 font-medium">Data</th>
                      <th className="px-4 py-3 font-medium">Histórico</th>
                      <th className="px-4 py-3 font-medium">Documento</th>
                      <th className="px-4 py-3 font-medium text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {filteredRecords.map(r => (
                      <tr key={r.id} className="hover:bg-slate-700/30">
                        <td className="px-4 py-3">{new Date(r.dueDate).toLocaleDateString()}</td>
                        <td className="px-4 py-3">{r.description}</td>
                        <td className="px-4 py-3 text-slate-500">{r.id.split('-')[0]}</td>
                        <td className={`px-4 py-3 text-right font-medium ${r.type === 'INCOME' ? 'text-green-400' : 'text-red-400'}`}>
                          {r.type === 'INCOME' ? '+' : '-'} R$ {Number(r.amountFinal || r.amount).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    {filteredRecords.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-slate-500 italic">
                          Nenhuma movimentação encontrada
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'CONCILIATION' && (
              <div className="p-12 flex flex-col items-center justify-center text-center">
                <div className="bg-emerald-500/10 p-4 rounded-full mb-4 ring-8 ring-emerald-500/5">
                  <FileText className="text-emerald-500" size={48} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Bem-vindo à conciliação bancária</h3>
                <p className="text-slate-400 max-w-md mb-8">
                  Importe o arquivo OFX exportado do seu banco para cruzar os dados reais com as informações lançadas no sistema.
                </p>
                
                <label className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer transition shadow-lg shadow-emerald-900/50">
                  <Upload size={18} />
                  Selecione um Arquivo (.OFX)
                  <input type="file" accept=".ofx" className="hidden" onChange={() => toast.success('Módulo de parsing de OFX em desenvolvimento.')} />
                </label>
              </div>
            )}

            {activeTab === 'SECURITY' && isSecretUnlocked && (
              <SecurityTab entityType="BANK_ACCOUNT" entityId={account.id} />
            )}
          </>
        )}
      </div>

      {showSecretModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-800 p-8 rounded-xl w-full max-w-sm border border-yellow-500/30 shadow-[0_0_50px_-12px_rgba(234,179,8,0.3)] animate-in zoom-in-95 duration-300">
            <div className="flex flex-col items-center mb-6">
              <div className="p-3 bg-yellow-500/10 rounded-full mb-3 text-yellow-500">
                <Lock size={32} />
              </div>
              <h3 className="text-xl font-bold text-white">Privilégios de Supervisor</h3>
              <p className="text-xs text-slate-400 text-center mt-1">Autenticação obrigatória para acessar as camadas do OpenFinance.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Usuário Supervisor</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input 
                    type="text" 
                    placeholder="E-mail ou Usuário"
                    className="w-full bg-slate-900 border border-slate-700 p-3 pl-10 rounded-lg text-white focus:ring-2 focus:ring-yellow-500/50 outline-none transition-all"
                    value={secretUsername}
                    onChange={e => setSecretUsername(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Senha Master</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••"
                    className="w-full bg-slate-900 border border-slate-700 p-3 pl-10 pr-10 rounded-lg text-white focus:ring-2 focus:ring-yellow-500/50 outline-none transition-all"
                    value={secretPassword}
                    onChange={e => setSecretPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && unlockSecret()}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-8">
              <button onClick={() => setShowSecretModal(false)} className="flex-1 py-3 text-sm font-medium text-slate-400 hover:text-white bg-slate-700/30 hover:bg-slate-700/50 rounded-lg transition-all">
                Cancelar
              </button>
              <button onClick={unlockSecret} className="flex-1 py-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-bold transition-all shadow-lg shadow-yellow-900/20 active:scale-95">
                Autenticar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, children, onClick, icon }: { active: boolean, children: React.ReactNode, onClick: () => void, icon?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-t-lg font-medium transition-all text-sm flex items-center gap-2 border-b-2 ${
        active 
          ? 'bg-slate-800 text-white border-indigo-500' 
          : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/50'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
