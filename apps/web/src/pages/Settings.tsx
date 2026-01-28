
import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Settings as SettingsIcon, 
  Building2, 
  CreditCard, 
  HelpCircle, 
  Palette,
  Search,
  Plus,
  MoreVertical
} from 'lucide-react';
import { clsx } from 'clsx';

// Componentes de Tab (internos para manter simples)
const TabButton = ({ active, onClick, icon: Icon, label }: any) => (
  <button
    onClick={onClick}
    className={clsx(
      "flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors",
      active 
        ? "border-indigo-500 text-indigo-400" 
        : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
    )}
  >
    <Icon size={18} />
    {label}
  </button>
);

export function Settings() {
  const [activeTab, setActiveTab] = useState('options'); // options, tenants, plans, help, whitelabel
  const [loading, setLoading] = useState(false);
  
  // Dados de SaaS (Carregados apenas se aba for tenants/plans e user for admin)
  const [tenants, setTenants] = useState<any[]>([]);

  useEffect(() => {
    if (activeTab === 'tenants') {
        fetchTenants();
    }
  }, [activeTab]);

  const fetchTenants = async () => {
    try {
        setLoading(true);
        const res = await api.get('/saas/tenants');
        setTenants(res.data);
    } catch (error) {
        console.error('Erro ao carregar tenants', error);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-slate-400 text-sm">Gerencie as opções do sistema e do ambiente SaaS</p>
      </div>

      {/* Tabs Header */}
      <div className="flex border-b border-slate-800 overflow-x-auto">
        <TabButton 
            active={activeTab === 'options'} 
            onClick={() => setActiveTab('options')} 
            icon={SettingsIcon} 
            label="Opções" 
        />
        <TabButton 
            active={activeTab === 'tenants'} 
            onClick={() => setActiveTab('tenants')} 
            icon={Building2} 
            label="Empresas" 
        />
        <TabButton 
            active={activeTab === 'plans'} 
            onClick={() => setActiveTab('plans')} 
            icon={CreditCard} 
            label="Planos" 
        />
        <TabButton 
            active={activeTab === 'help'} 
            onClick={() => setActiveTab('help')} 
            icon={HelpCircle} 
            label="Ajuda" 
        />
        <TabButton 
            active={activeTab === 'whitelabel'} 
            onClick={() => setActiveTab('whitelabel')} 
            icon={Palette} 
            label="Whitelabel" 
        />
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        
        {/* ABA OPÇÕES */}
        {activeTab === 'options' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Geral</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                            <span className="text-slate-300 text-sm">Notificações Sonoras</span>
                            <div className="w-10 h-5 bg-indigo-600 rounded-full relative cursor-pointer">
                                <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                            <span className="text-slate-300 text-sm">Modo Escuro</span>
                            <span className="text-indigo-400 text-xs font-bold">ATIVO</span>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* ABA EMPRESAS (SAAS) */}
        {activeTab === 'tenants' && (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-2.5 text-slate-500" size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar empresa..." 
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                    <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                        <Plus size={18} />
                        Nova Empresa
                    </button>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                            <tr>
                                <th className="px-6 py-3 font-medium">Empresa</th>
                                <th className="px-6 py-3 font-medium">Documento</th>
                                <th className="px-6 py-3 font-medium">Plano</th>
                                <th className="px-6 py-3 font-medium">Status</th>
                                <th className="px-6 py-3 font-medium text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-300">
                            {loading && (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Carregando...</td></tr>
                            )}
                            {!loading && tenants.map((tenant) => (
                                <tr key={tenant.id} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-white">{tenant.name}</td>
                                    <td className="px-6 py-4">{tenant.document}</td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 text-xs font-bold border border-indigo-500/20">
                                            {tenant.plan?.name || 'Sem Plano'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {tenant.isActive ? (
                                            <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                                                ATIVO
                                            </span>
                                        ) : (
                                           <span className="flex items-center gap-1.5 text-red-400 text-xs font-bold">
                                                <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                                                INATIVO
                                            </span> 
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-slate-400 hover:text-white p-1">
                                            <MoreVertical size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
        
        {/* Outras Abas Placeholder */}
        {activeTab === 'plans' && (
             <div className="text-center py-12 text-slate-500">
                 <CreditCard size={48} className="mx-auto mb-4 opacity-50" />
                 <p>Gestão de Planos em desenvolvimento...</p>
             </div>
        )}

      </div>
    </div>
  );
}
