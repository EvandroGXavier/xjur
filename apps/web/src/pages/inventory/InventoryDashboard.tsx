import { useEffect, useState } from "react";
import { api } from "../../services/api";
import {
  AlertTriangle,
  Check,
  DollarSign,
  PackageSearch,
  TrendingUp,
  X,
  FileText,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { ContactPickerGlobal } from "../../components/contacts/ContactPickerGlobal";
import { usePaymentConditions } from "../../hooks/usePaymentConditions";

export function InventoryDashboard() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalStockValue: 0,
    lowStockItems: 0,
  });
  const [alerts, setAlerts] = useState<any[]>([]);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [profitMargin, setProfitMargin] = useState(30);
  const [isLoading, setIsLoading] = useState(true);

  // New Budget Presets
  const [defaultSeller, setDefaultSeller] = useState<any>(null);
  const [defaultPaymentConditionId, setDefaultPaymentConditionId] = useState("");
  const [defaultNotes, setDefaultNotes] = useState("");
  const [defaultValidityDays, setDefaultValidityDays] = useState(7);

  const { conditions: paymentConditions, fetchConditions } = usePaymentConditions();

  useEffect(() => {
    loadDashboardData();
    loadConfig();
    fetchConditions();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [balancesRes, alertsRes] = await Promise.all([
        api.get("/stock/balances"),
        api.get("/stock/alerts"),
      ]);

      const products = balancesRes.data || [];
      const stockAlerts = alertsRes.data || [];
      const totalValue = products.reduce((acc: number, item: any) => {
        return acc + Number(item.costPrice || 0) * (item.currentStock || 0);
      }, 0);

      setStats({
        totalProducts: products.length,
        totalStockValue: totalValue,
        lowStockItems: stockAlerts.length,
      });
      setAlerts(stockAlerts);
    } catch {
      toast.error("Erro ao carregar dados do dashboard.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadConfig = async () => {
    try {
      const res = await api.get("/stock/config");
      if (res.data) {
        if (res.data.profitMargin !== undefined && res.data.profitMargin !== null) {
          setProfitMargin(Number(res.data.profitMargin));
        }
        
        setDefaultSeller(res.data.defaultSeller || null);
        setDefaultPaymentConditionId(res.data.defaultPaymentConditionId || "");
        setDefaultNotes(res.data.defaultNotes || "");
        setDefaultValidityDays(res.data.defaultValidityDays || 7);
      }
    } catch (err) {
      console.error("Erro ao carregar configuracoes.", err);
    }
  };

  const saveConfig = async () => {
    if (!Number.isFinite(profitMargin) || profitMargin < 0) {
      toast.error("Informe uma margem de lucro valida.");
      return;
    }

    try {
      await api.post("/stock/config", { 
        profitMargin,
        defaultSellerId: defaultSeller?.id,
        defaultPaymentConditionId,
        defaultNotes,
        defaultValidityDays: Number(defaultValidityDays) || 7
      });
      toast.success("Configuracoes salvas com sucesso!");
      setShowConfigModal(false);
    } catch {
      toast.error("Erro ao salvar configuracoes.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
      <div className="bg-slate-800/50 text-white px-4 py-3 flex items-center justify-between border-b-2 border-teal-500">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <TrendingUp className="text-teal-400" />
          Visao Geral do Estoque
        </h1>
        <button
          onClick={() => setShowConfigModal(true)}
          className="bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-200 px-3 py-1.5 text-sm rounded flex items-center gap-2 transition-colors shadow-sm"
        >
          <Settings size={16} className="text-purple-400" /> Configuracoes
        </button>
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="text-slate-400 text-center py-10">
            Carregando metricas...
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 p-6 rounded-xl shadow-lg flex items-center gap-4 group hover:border-teal-500/50 transition-colors">
                <div className="bg-teal-500/10 p-4 rounded-lg text-teal-400 group-hover:scale-110 transition-transform">
                  <PackageSearch size={32} />
                </div>
                <div>
                  <div className="text-slate-400 text-sm font-semibold uppercase tracking-wider">
                    Total de Produtos
                  </div>
                  <div className="text-3xl font-bold text-white mt-1">
                    {stats.totalProducts}
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 p-6 rounded-xl shadow-lg flex items-center gap-4 group hover:border-emerald-500/50 transition-colors">
                <div className="bg-emerald-500/10 p-4 rounded-lg text-emerald-400 group-hover:scale-110 transition-transform">
                  <DollarSign size={32} />
                </div>
                <div>
                  <div className="text-slate-400 text-sm font-semibold uppercase tracking-wider">
                    Valor em Estoque
                  </div>
                  <div className="text-3xl font-bold text-white mt-1">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(stats.totalStockValue)}
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 p-6 rounded-xl shadow-lg flex items-center gap-4 group hover:border-rose-500/50 transition-colors">
                <div className="bg-rose-500/10 p-4 rounded-lg text-rose-400 group-hover:scale-110 transition-transform">
                  <AlertTriangle size={32} />
                </div>
                <div>
                  <div className="text-slate-400 text-sm font-semibold uppercase tracking-wider">
                    Falta de Estoque
                  </div>
                  <div className="text-3xl font-bold text-rose-400 mt-1">
                    {stats.lowStockItems}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-lg overflow-hidden flex flex-col flex-1 min-h-[300px]">
              <div className="bg-slate-900/50 border-b border-slate-700 px-4 py-3 font-semibold text-rose-400 flex items-center gap-2">
                <AlertTriangle size={18} /> Produtos com Estoque Baixo ou Critico
              </div>
              <div className="p-0 overflow-x-auto">
                {alerts.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 font-medium">
                    Nenhum alerta de estoque. Tudo sob controle!
                  </div>
                ) : (
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-900/40 text-slate-400">
                      <tr>
                        <th className="px-4 py-3 font-medium">Cod. SKU</th>
                        <th className="px-4 py-3 font-medium">
                          Nome do Produto
                        </th>
                        <th className="px-4 py-3 font-medium">Estoque Min.</th>
                        <th className="px-4 py-3 font-medium text-rose-400">
                          Estoque Atual
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {alerts.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-800/80 transition-colors"
                        >
                          <td className="px-4 py-3 font-mono text-xs">
                            {item.sku || "-"}
                          </td>
                          <td className="px-4 py-3 font-medium text-white">
                            {item.name}
                          </td>
                          <td className="px-4 py-3">
                            {item.minStock} {item.unit}
                          </td>
                          <td className="px-4 py-3 font-bold text-rose-500">
                            {item.currentStock} {item.unit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showConfigModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-slate-900 border border-slate-700 shadow-2xl rounded-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-800 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-purple-400 flex items-center gap-2">
                <Settings size={20} />
                Configuracoes de Estoque
              </h2>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 text-slate-300 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-4">
                <h3 className="text-teal-400 font-bold border-b border-slate-700 pb-2 flex items-center gap-2">
                  <TrendingUp size={18} /> Gerais
                </h3>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Margem de Lucro Padrao (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 outline-none text-teal-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all font-bold text-lg"
                      value={profitMargin}
                      onChange={(e) => setProfitMargin(Number(e.target.value))}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">
                      %
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <h3 className="text-purple-400 font-bold border-b border-slate-700 pb-2 flex items-center gap-2">
                  <FileText size={18} /> Pre-definicoes de Orcamento
                </h3>
                
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Vendedor / Emissor Padrao
                  </label>
                  <div className="bg-slate-950 border border-slate-700 rounded-lg p-1">
                    <ContactPickerGlobal 
                      onAdd={async () => {}}
                      hideRole={true}
                      hideQualification={true}
                      showAction={false}
                      hideContactLabel={true}
                      onSelectContact={(_id, contact) => setDefaultSeller(contact)}
                      defaultContact={defaultSeller}
                      className="!bg-transparent !p-0 !border-none !shadow-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Cond. de Pagamento
                    </label>
                    <select
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 outline-none text-white focus:border-purple-500"
                      value={defaultPaymentConditionId}
                      onChange={(e) => setDefaultPaymentConditionId(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {paymentConditions.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Validade (Dias)
                    </label>
                    <input
                      type="number"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 outline-none text-white focus:border-purple-500"
                      value={defaultValidityDays}
                      onChange={(e) => setDefaultValidityDays(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Observacao Padrao
                  </label>
                  <textarea
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 outline-none text-white focus:border-purple-500 min-h-[100px] resize-none"
                    value={defaultNotes}
                    onChange={(e) => setDefaultNotes(e.target.value)}
                    placeholder="Ex: Entrega em 5 dias uteis..."
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-950 px-6 py-4 flex justify-end gap-3 border-t border-slate-800">
              <button
                className="px-4 py-2 text-slate-400 font-medium hover:text-white transition-colors"
                onClick={() => setShowConfigModal(false)}
              >
                Cancelar
              </button>
              <button
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded shadow-md font-medium flex items-center gap-2 transition-all"
                onClick={saveConfig}
              >
                <Check size={18} />
                Salvar Regras
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
