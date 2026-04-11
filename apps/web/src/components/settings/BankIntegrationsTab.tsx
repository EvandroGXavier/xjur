import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { 
  Building2, Plus, Server, Trash2, CheckCircle2, 
  X, ShieldCheck, Activity, Key, UploadCloud, Link as LinkIcon
} from 'lucide-react';
import clsx from 'clsx';

// Constants for Providers
const PROVIDERS = [
  { id: 'INTER', name: 'Banco Inter', color: 'bg-orange-500', icon: Building2, type: 'mTLS' },
  { id: 'PICPAY', name: 'PicPay', color: 'bg-emerald-500', icon: Server, type: 'Token' },
  { id: 'PAGBANK', name: 'PagBank', color: 'bg-yellow-500', icon: Building2, type: 'Token' },
  { id: 'SANTANDER', name: 'Santander', color: 'bg-red-600', icon: ShieldCheck, type: 'mTLS' },
];

const BankIntegrationModal = ({ isOpen, onClose, onSave, bankAccounts }: any) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    provider: '',
    displayName: '',
    environment: 'SANDBOX',
    bankAccountId: '', // Opcional
    credentialSecretId: '', // Token ou Client Secret
    certificateSecretId: '', // Certificado
    webhookUrl: '',
    accountHolderDocument: '',
  });

  // Reset step on open
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setFormData({
        provider: '',
        displayName: '',
        environment: 'SANDBOX',
        bankAccountId: '',
        credentialSecretId: '',
        certificateSecretId: '',
        webhookUrl: '',
        accountHolderDocument: '',
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedProviderDef = PROVIDERS.find(p => p.id === formData.provider);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post('/banking/integrations', formData);
      toast.success('Integração bancária cadastrada com sucesso!');
      onSave();
      onClose();
    } catch (error: any) {
      toast.error('Erro ao cadastrar integração: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/80 sticky top-0 z-10">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Building2 className="text-indigo-400" /> Nova Integração Bancária
            </h3>
            <p className="text-xs text-slate-400 mt-1">Conecte o Hub Dr.X diretamente aos provedores financeiros.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white bg-slate-800 rounded-full transition-colors hidden sm:block">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-6 flex-1">
          {step === 1 && (
            <div className="space-y-6">
              <h4 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-4">1. Selecione o Provedor</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {PROVIDERS.map(provider => (
                  <button
                    key={provider.id}
                    onClick={() => {
                      setFormData(prev => ({ ...prev, provider: provider.id, displayName: `Integração ${provider.name}` }));
                      setStep(2);
                    }}
                    className="flex flex-col items-center justify-center p-6 bg-slate-950 border border-slate-800 rounded-2xl hover:border-indigo-500 hover:bg-slate-800/50 transition-all group"
                  >
                    <div className={clsx("w-14 h-14 rounded-2xl flex items-center justify-center mb-4 text-white shadow-lg", provider.color)}>
                      <provider.icon size={28} />
                    </div>
                    <span className="text-sm font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">{provider.name}</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest mt-2 px-2 py-1 bg-slate-900 rounded-md">
                      Protocolo: {provider.type}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && selectedProviderDef && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold uppercase tracking-widest text-slate-500">2. Credenciais: {selectedProviderDef.name}</h4>
                <button type="button" onClick={() => setStep(1)} className="text-xs text-indigo-400 hover:underline">Voltar</button>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Nome da Conexão</label>
                    <input
                      required
                      type="text"
                      value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Ambiente</label>
                    <select
                      value={formData.environment}
                      onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                    >
                      <option value="SANDBOX">Sandbox (Testes)</option>
                      <option value="LIVE">Produção (Live)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 flex items-center gap-2"><Key size={14} /> Token / Client Secret</label>
                  <input
                    required
                    type="password"
                    placeholder="Cole a string fornecida pelo painel do banco..."
                    value={formData.credentialSecretId}
                    onChange={(e) => setFormData({ ...formData, credentialSecretId: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Este dado é encriptado antes de ser salvo no banco.</p>
                </div>

                {selectedProviderDef.type === 'mTLS' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1 flex items-center gap-2"><ShieldCheck size={14} /> Certificado Digital (.crt/.key Base64) (mTLS)</label>
                    <textarea
                      required
                      placeholder="Cole aqui o conteúdo cru (PEM/Text) do seu Certificado Digital A1 emitido pelo Banco..."
                      value={formData.certificateSecretId}
                      onChange={(e) => setFormData({ ...formData, certificateSecretId: e.target.value })}
                      className="w-full h-24 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none font-mono"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800/50">
                   <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Conta Bancária Associada (Interna)</label>
                    <select
                      value={formData.bankAccountId}
                      onChange={(e) => setFormData({ ...formData, bankAccountId: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                    >
                      <option value="">Nenhuma (Opcional)</option>
                      {bankAccounts.map((acc: any) => (
                        <option key={acc.id} value={acc.id}>{acc.title} ({acc.bankName})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">CNPJ do Lojista (Opcional)</label>
                     <input
                      type="text"
                      placeholder="Apenas números..."
                      value={formData.accountHolderDocument}
                      onChange={(e) => setFormData({ ...formData, accountHolderDocument: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Botões do Form */}
              <div className="flex items-center justify-end gap-3 pt-6">
                <button type="button" onClick={onClose} className="px-5 py-2.5 text-xs font-bold text-slate-400 hover:text-white uppercase tracking-widest transition-colors">
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all disabled:opacity-50"
                  >
                  {loading ? 'Processando...' : 'Salvar Provedor'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export const BankIntegrationsTab = () => {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [intRes, accRes] = await Promise.all([
        api.get('/banking/integrations'),
        api.get('/banking/accounts') // assuming this endpoint exists or similar
      ]);
      setIntegrations(intRes.data);
      if (accRes.data) {
          setBankAccounts(accRes.data);
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao listar integrações');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja remover esta conexão de banco? Isso interromperá todos os webhooks de pagamento referentes a ela.')) return;
    try {
      await api.delete(`/banking/integrations/${id}`);
      toast.success('Integração removida!');
      fetchData();
    } catch (e) {
      toast.error('Erro ao deletar.');
    }
  };

  const handleHealthCheck = async (id: string) => {
    try {
      toast.loading('Testando comunicação com o banco...', { id: 'healthcheck' });
      await api.post(`/banking/integrations/${id}/health`);
      toast.success('Conexão estável e respondendo!', { id: 'healthcheck' });
      fetchData(); // atualiza status de healthcheck
    } catch (e: any) {
      toast.error('O Teste falhou: ' + (e.response?.data?.message || 'Verifique as credenciais.'), { id: 'healthcheck' });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Server className="text-indigo-400" />
            Integrações BankHub
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Mantenha as chaves dos provedores de Open Finance centralizadas.
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all active:scale-95"
        >
          <Plus size={16} /> Nova Integração
        </button>
      </div>

      {/* GRID */}
      {loading && integrations.length === 0 ? (
        <div className="text-center py-10 opacity-50"><Activity size={32} className="mx-auto mb-2 animate-spin text-indigo-500" /> Carregando integrações...</div>
      ) : integrations.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-10 flex flex-col items-center justify-center text-center">
          <UploadCloud size={48} className="text-slate-600 mb-4" />
          <h3 className="text-lg font-bold text-white">Nenhum Serviço Bancário</h3>
          <p className="text-slate-400 text-sm mt-2 max-w-sm mb-6">
            Você não possui conexões com bancos nativos. Múltiplos provedores podem ser acoplados para Boleto e Pix Nativo simultaneamente.
          </p>
          <button 
             onClick={() => setIsModalOpen(true)}
             className="px-6 py-2 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
          >
            Começar Agora
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {integrations.map((int: any) => {
            const isLive = int.environment === 'LIVE';
            const providerDef = PROVIDERS.find(p => p.id === int.provider) || PROVIDERS[0];
            return (
              <div key={int.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-indigo-500/30 transition-all flex flex-col relative group">
                <div className={clsx("h-1 w-full absolute top-0 left-0", providerDef.color)}></div>
                
                <div className="p-6 pb-4">
                  <div className="flex justify-between items-start mb-4">
                    <div className={clsx("w-12 h-12 rounded-xl flex items-center justify-center text-white", providerDef.color)}>
                       <providerDef.icon size={24} />
                    </div>
                    <span className={clsx(
                      "px-2.5 py-1 rounded-md text-[9px] font-black tracking-widest uppercase border",
                      isLive ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    )}>
                      {isLive ? 'Produção' : 'Sandbox'}
                    </span>
                  </div>
                  
                  <h3 className="text-lg font-bold text-white mb-1 truncate">{int.displayName}</h3>
                  <p className="text-xs text-slate-400 max-w-full truncate">Provedor: {providerDef.name} ({int.provider})</p>
                </div>

                <div className="bg-slate-950/50 p-4 border-t border-slate-800 mt-auto grid grid-cols-2 gap-2 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  <div className="flex flex-col gap-1 items-center justify-center">
                    <span className="flex items-center gap-1">Status Webhook</span>
                    {int.webhookEnabled ? <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 size={12}/> Ativo</span> : <span className="text-slate-600 flex items-center gap-1"><XCircle size={12}/> Inativo</span>}
                  </div>
                  <div className="flex flex-col gap-1 items-center justify-center border-l border-slate-800">
                     <span className="flex items-center gap-1">Protocolo</span>
                     <span className="text-indigo-400"><LinkIcon size={12} className="inline mr-1" /> {providerDef.type}</span>
                  </div>
                </div>

                <div className="flex border-t border-slate-800 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button 
                      onClick={() => handleHealthCheck(int.id)}
                      className="flex-1 py-3 text-xs font-bold text-indigo-400 hover:bg-slate-800 uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                   >
                     Testar API
                   </button>
                   <button 
                      onClick={() => handleDelete(int.id)}
                      className="px-4 border-l border-slate-800 py-3 text-red-500 hover:bg-red-500/10 transition-colors flex items-center justify-center"
                   >
                     <Trash2 size={16} />
                   </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL */}
      <BankIntegrationModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={fetchData} 
        bankAccounts={bankAccounts}
      />
    </div>
  );
};
