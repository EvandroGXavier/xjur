import { useState, useEffect } from "react";
import {
  usePaymentConditions,
  PaymentCondition,
} from "../hooks/usePaymentConditions";
import { Plus, Edit, Trash2, X, Save, Percent, Calendar } from "lucide-react";
import { toast } from "sonner";

export function PaymentConditions() {
  const {
    conditions,
    loading,
    fetchConditions,
    createCondition,
    updateCondition,
    deleteCondition,
  } = usePaymentConditions();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PaymentCondition | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    surcharge: "0",
    discount: "0",
    active: true,
  });

  const [installmentsCount, setInstallmentsCount] = useState<number | "">("");
  const [installments, setInstallments] = useState<any[]>([]);

  useEffect(() => {
    fetchConditions();
  }, [fetchConditions]);

  const handleOpenModal = (item?: PaymentCondition) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        surcharge: item.surcharge.toString(),
        discount: item.discount.toString(),
        active: item.active,
      });
      setInstallmentsCount(item.installments?.length || "");
      setInstallments(item.installments || []);
    } else {
      setEditingItem(null);
      setFormData({ name: "", surcharge: "0", discount: "0", active: true });
      setInstallmentsCount("");
      setInstallments([]);
    }
    setModalOpen(true);
  };

  const handleAddInstallment = () => {
    const nextInstallment = installments.length + 1;
    // Prazos comuns: 0, 30, 60, 90...
    const nextDays =
      installments.length > 0
        ? installments[installments.length - 1].days + 30
        : 0;

    // Recalcular percentuais para dividir igual
    const newCount = nextInstallment;
    const basePct = 100 / newCount;

    setInstallments([
      ...installments.map((i) => ({ ...i, percentage: basePct })),
      { installment: nextInstallment, days: nextDays, percentage: basePct },
    ]);
  };

  const handleRemoveInstallment = (index: number) => {
    const newArr = [...installments];
    newArr.splice(index, 1);

    // Recalcular installments numbers and percentages
    const newCount = newArr.length;
    const basePct = newCount > 0 ? 100 / newCount : 0;

    setInstallmentsCount(newCount || "");

    setInstallments(
      newArr.map((item, i) => ({
        ...item,
        installment: i + 1,
        percentage: basePct,
      })),
    );
  };

  const updateInstallment = (index: number, field: string, value: number | string) => {
    const newArr = [...installments];
    newArr[index] = { ...newArr[index], [field]: value };
    setInstallments(newArr);
  };

  const handleInstallmentsCountChange = (value: string) => {
    const val = parseInt(value, 10);
    if (isNaN(val) || val < 0) {
      setInstallmentsCount("");
      setInstallments([]);
      return;
    }
    setInstallmentsCount(val);

    if (val === 0) {
      setInstallments([]);
      return;
    }

    const basePct = Number((100 / val).toFixed(2));
    const newArr = Array.from({ length: val }).map((_, i) => {
      const isLast = i === val - 1;
      const pct = isLast ? Number((100 - (basePct * (val - 1))).toFixed(2)) : basePct;
      return {
        installment: i + 1,
        days: i === 0 ? 0 : i * 30,
        percentage: pct,
      };
    });
    setInstallments(newArr);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    // Validate percentage total
    const totalPct = installments.reduce(
      (sum, i) => sum + (parseFloat(String(i.percentage).replace(',', '.')) || 0),
      0,
    );
    if (installments.length > 0 && Math.abs(totalPct - 100) > 0.01) {
      toast.error("O total dos percentuais deve ser 100%");
      return;
    }

    const payload = {
      name: formData.name,
      surcharge: parseFloat(formData.surcharge) || 0,
      discount: parseFloat(formData.discount) || 0,
      active: formData.active,
      installments: installments.map((i) => ({
        installment: Number(i.installment),
        days: Number(i.days) || 0,
        percentage: parseFloat(String(i.percentage).replace(',', '.')) || 0,
      })),
    };

    try {
      if (editingItem) {
        await updateCondition(editingItem.id, payload);
        toast.success("Condição atualizada com sucesso");
      } else {
        await createCondition(payload);
        toast.success("Condição criada com sucesso");
      }
      setModalOpen(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || "Erro ao salvar condição de pagamento");
      console.error(error);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Excluir esta condição de pagamento?")) return;
    try {
      await deleteCondition(id);
      toast.success("Excluída com sucesso");
    } catch (e) {
      // handled in hook
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {console.log('Payment Conditions Current State:', { loading, conditionsLength: conditions?.length, conditions })}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Condições de Pagamento
          </h1>
          <p className="text-slate-400 text-sm">
            Gerencie formas de parcelamento, prazos, descontos e acréscimos
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          Nova Condição
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-6 py-3 font-medium">Código</th>
              <th className="px-6 py-3 font-medium">Nome</th>
              <th className="px-6 py-3 font-medium">Acréscimo</th>
              <th className="px-6 py-3 font-medium">Desconto</th>
              <th className="px-6 py-3 font-medium">Parcelas</th>
              <th className="px-6 py-3 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {loading && conditions.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-8 text-center text-slate-500"
                >
                  Carregando...
                </td>
              </tr>
            )}
            {!loading && conditions.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-8 text-center text-slate-500 font-bold"
                >
                  Nenhuma condição de pagamento encontrada.
                </td>
              </tr>
            )}
            {!loading && conditions.length > 0 &&
              conditions.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                  onDoubleClick={() => handleOpenModal(item)}
                >
                  <td className="px-6 py-4 font-mono text-xs">
                    {(item.code || 0).toString().padStart(3, "0")}
                  </td>
                  <td className="px-6 py-4 font-medium text-white">
                    {item.name}
                  </td>
                  <td className="px-6 py-4">
                    {Number(item.surcharge) > 0
                      ? `+${Number(item.surcharge).toFixed(2)}%`
                      : "-"}
                  </td>
                  <td className="px-6 py-4">
                    {Number(item.discount) > 0
                      ? `-${Number(item.discount).toFixed(2)}%`
                      : "-"}
                  </td>
                  <td className="px-6 py-4">
                    {item.installments?.length || 0}
                  </td>
                  <td className="px-6 py-4 text-right flex justify-end gap-2">
                    <button
                      onClick={(e) => handleDelete(item.id, e)}
                      className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button
                      onClick={() => handleOpenModal(item)}
                      className="text-slate-400 hover:text-white p-1"
                    >
                      <Edit size={16} />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-800/50">
              <h3 className="text-lg font-semibold text-white">
                {editingItem
                  ? "Editar Condição de Pagamento"
                  : "Nova Condição de Pagamento"}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-slate-400 mb-1">
                      Nome
                    </label>
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
                      placeholder="Ex: 5 parcelas"
                    />
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-slate-400 mb-1">
                      Qtd. Parcelas
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={installmentsCount}
                      onChange={(e) => handleInstallmentsCountChange(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
                      placeholder="Ex: 5"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">
                      Acréscimo (%)
                    </label>
                    <div className="relative">
                      <Percent
                        className="absolute left-3 top-2.5 text-slate-500"
                        size={16}
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.surcharge}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            surcharge: e.target.value,
                          })
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-white focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">
                      Desconto (%)
                    </label>
                    <div className="relative">
                      <Percent
                        className="absolute left-3 top-2.5 text-slate-500"
                        size={16}
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.discount}
                        onChange={(e) =>
                          setFormData({ ...formData, discount: e.target.value })
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-white focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-medium text-white flex items-center gap-2">
                      <Calendar size={16} className="text-indigo-400" />
                      Parcelas
                    </h4>
                    <button
                      type="button"
                      onClick={handleAddInstallment}
                      className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors flex items-center gap-1"
                    >
                      <Plus size={16} /> Incluir Parcela
                    </button>
                  </div>

                  {installments.length > 0 ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-4 gap-4 text-xs font-semibold text-slate-500 uppercase px-2 mb-2">
                        <div>Parcela</div>
                        <div>Prazo (Dias)</div>
                        <div>Percentual (%)</div>
                        <div className="text-right">Ação</div>
                      </div>

                      {installments.map((inst, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-4 gap-4 items-center bg-slate-950/50 p-2 rounded-lg border border-slate-800/50"
                        >
                          <div className="font-medium text-white pl-2">
                            {inst.installment}
                          </div>
                          <div>
                            <input
                              type="number"
                              min="0"
                              value={inst.days}
                              onChange={(e) =>
                                updateInstallment(
                                  idx,
                                  "days",
                                  parseInt(e.target.value),
                                )
                              }
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-sm focus:border-indigo-500 outline-none"
                            />
                          </div>
                          <div>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={inst.percentage}
                              onChange={(e) =>
                                updateInstallment(
                                  idx,
                                  "percentage",
                                  e.target.value
                                )
                              }
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-sm focus:border-indigo-500 outline-none"
                            />
                          </div>
                          <div className="text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveInstallment(idx)}
                              className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}

                      <div className="flex justify-end pt-2 px-2 text-sm">
                        <span className="text-slate-400 mr-2">Total:</span>
                        <span
                          className={`font-bold ${Math.abs(installments.reduce((sum, i) => sum + (parseFloat(String(i.percentage).replace(',', '.')) || 0), 0) - 100) > 0.01 ? "text-amber-500" : "text-emerald-500"}`}
                        >
                          {installments
                            .reduce((sum, i) => sum + (parseFloat(String(i.percentage).replace(',', '.')) || 0), 0)
                            .toFixed(2)}
                          %
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 border border-dashed border-slate-800 rounded-lg text-slate-500 text-sm">
                      Nenhuma parcela definida. O valor será considerado à vista
                      (0 dias, 100%).
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <Save size={18} />
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
