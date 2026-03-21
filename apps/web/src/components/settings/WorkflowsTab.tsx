import React, { useState, useEffect } from "react";
import { api } from "../../services/api";
import { Plus, Edit2, Trash2, Check, X, ArrowUp, ArrowDown, Settings as SettingsIcon } from "lucide-react";
import { clsx } from "clsx";

interface WorkflowStep {
  id?: string;
  order: number;
  taskTitle: string;
  description?: string;
  taskCategory: string;
  taskPriority: string;
  daysToInternal?: number;
  daysToFatal?: number;
  defaultAssigneeRole?: string;
}

interface Workflow {
  id?: string;
  name: string;
  description?: string;
  isActive: boolean;
  isDefault: boolean;
  steps: WorkflowStep[];
}

export function WorkflowsTab() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const res = await api.get("/workflows");
      setWorkflows(res.data);
    } catch (err) {
      console.error("Erro ao carregar esteiras de trabalho:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (workflow?: Workflow) => {
    if (workflow) {
      setEditingWorkflow({ ...workflow, steps: [...(workflow.steps || [])] });
    } else {
      setEditingWorkflow({
        name: "",
        description: "",
        isActive: true,
        isDefault: false,
        steps: [],
      });
    }
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorkflow) return;

    try {
      setLoading(true);
      // Ensure steps have correct order
      const dataToSave = {
        ...editingWorkflow,
        steps: editingWorkflow.steps.map((step, index) => ({
          ...step,
          order: index + 1, // Re-indexar a ordem para garantir consistência
        })),
      };

      if (dataToSave.id) {
        await api.patch(`/workflows/${dataToSave.id}`, dataToSave);
      } else {
        await api.post("/workflows", dataToSave);
      }
      setModalOpen(false);
      fetchWorkflows();
    } catch (error: any) {
      alert("Erro ao salvar: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta esteira? Processos vinculados poderão perder as automações futuras.")) return;
    try {
      setLoading(true);
      await api.delete(`/workflows/${id}`);
      fetchWorkflows();
    } catch (error: any) {
      alert("Erro ao excluir: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleAddStep = () => {
    if (!editingWorkflow) return;
    const newStep: WorkflowStep = {
      order: editingWorkflow.steps.length + 1,
      taskTitle: "",
      taskCategory: "ACAO",
      taskPriority: "MEDIA",
    };
    setEditingWorkflow({
      ...editingWorkflow,
      steps: [...editingWorkflow.steps, newStep],
    });
  };

  const handleRemoveStep = (index: number) => {
    if (!editingWorkflow) return;
    const newSteps = [...editingWorkflow.steps];
    newSteps.splice(index, 1);
    setEditingWorkflow({ ...editingWorkflow, steps: newSteps });
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if (!editingWorkflow) return;
    const newSteps = [...editingWorkflow.steps];
    if (direction === 'up' && index > 0) {
      const temp = newSteps[index];
      newSteps[index] = newSteps[index - 1];
      newSteps[index - 1] = temp;
    } else if (direction === 'down' && index < newSteps.length - 1) {
      const temp = newSteps[index];
      newSteps[index] = newSteps[index + 1];
      newSteps[index + 1] = temp;
    }
    setEditingWorkflow({ ...editingWorkflow, steps: newSteps });
  };

  const updateStep = (index: number, field: keyof WorkflowStep, value: any) => {
    if (!editingWorkflow) return;
    const newSteps = [...editingWorkflow.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setEditingWorkflow({ ...editingWorkflow, steps: newSteps });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <SettingsIcon className="text-indigo-400" />
            Esteiras de Trabalho (Workflows)
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Configure automações sequenciais de andamentos para os processos.
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          Nova Esteira
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading && workflows.length === 0 ? (
          <div className="text-slate-500">Carregando esteiras...</div>
        ) : (
          workflows.map((workflow) => (
            <div
              key={workflow.id}
              className={clsx(
                "bg-slate-900 border rounded-xl p-5 hover:border-indigo-500/50 transition-all cursor-pointer relative",
                workflow.isActive ? "border-slate-800" : "border-red-900/30 opacity-70"
              )}
              onClick={() => handleOpenModal(workflow)}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-bold text-white pr-8">{workflow.name}</h3>
                {workflow.isDefault && (
                  <span className="absolute top-4 right-4 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold px-2 py-1 rounded-full border border-indigo-500/20">
                    PADRÃO
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400 line-clamp-2 mb-4">
                {workflow.description || "Sem descrição"}
              </p>
              
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-800">
                <div className="text-xs text-slate-500">
                  {workflow.steps?.length || 0} Etapa(s)
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); if (workflow.id) handleDelete(workflow.id); }}
                    className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL EDIÇÃO */}
      {modalOpen && editingWorkflow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-800/50">
              <h3 className="text-lg font-bold text-white">
                {editingWorkflow.id ? "Editar Esteira" : "Nova Esteira de Trabalho"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Nome da Esteira</label>
                  <input
                    autoFocus
                    required
                    value={editingWorkflow.name}
                    onChange={(e) => setEditingWorkflow({ ...editingWorkflow, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
                    placeholder="Ex: Contencioso Trabalhista Padrão"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Descrição</label>
                  <input
                    value={editingWorkflow.description || ""}
                    onChange={(e) => setEditingWorkflow({ ...editingWorkflow, description: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
                    placeholder="Ex: Esteira padronizada para novas defesas."
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingWorkflow.isActive}
                    onChange={(e) => setEditingWorkflow({ ...editingWorkflow, isActive: e.target.checked })}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-700 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-300">Esteira Ativa</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingWorkflow.isDefault}
                    onChange={(e) => setEditingWorkflow({ ...editingWorkflow, isDefault: e.target.checked })}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-700 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-300 min-w-max">Padrão para Novos Processos</span>
                </label>
              </div>

              <div className="border-t border-slate-800 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-lg font-bold text-white">Etapas da Esteira</h4>
                    <p className="text-xs text-slate-400">
                      As etapas serão geradas sequencialmente. Uma etapa começa quando a anterior for concluída. (Etapas com o mesmo número de ordem ocorrem paralelamente). Para facilitar, a ordem aqui é visual de cima para baixo.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddStep}
                    className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <Plus size={16} /> Adicionar Etapa
                  </button>
                </div>

                <div className="space-y-4">
                  {editingWorkflow.steps.map((step, index) => (
                    <div key={index} className="bg-slate-800/20 border border-slate-800 rounded-lg p-4 relative group">
                      {/* Controles de Ordenação */}
                      <div className="absolute left-[-12px] top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => moveStep(index, 'up')} disabled={index === 0} className="p-1 bg-slate-800 rounded text-slate-400 hover:text-white disabled:opacity-30"><ArrowUp size={14}/></button>
                        <button type="button" onClick={() => moveStep(index, 'down')} disabled={index === editingWorkflow.steps.length - 1} className="p-1 bg-slate-800 rounded text-slate-400 hover:text-white disabled:opacity-30"><ArrowDown size={14}/></button>
                      </div>

                      <div className="flex justify-between items-start mb-3">
                        <h5 className="text-white font-bold flex items-center gap-2">
                          <span className="bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">
                            {index + 1}
                          </span>
                          Configuração do Andamento Alvo
                        </h5>
                        <button type="button" onClick={() => handleRemoveStep(index)} className="text-slate-500 hover:text-red-400"><Trash2 size={16}/></button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-xs text-slate-500 mb-1">Título do Andamento *</label>
                          <input
                            required
                            value={step.taskTitle}
                            onChange={(e) => updateStep(index, 'taskTitle', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white focus:border-indigo-500 outline-none"
                            placeholder="Ex: Análise Inicial do Contrato"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Categoria</label>
                          <select
                            value={step.taskCategory}
                            onChange={(e) => updateStep(index, 'taskCategory', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white focus:border-indigo-500 outline-none"
                          >
                            <option value="ACAO">Ação (Padrão)</option>
                            <option value="REGISTRO">Registro Simples</option>
                            <option value="AGENDA">Agendável (Audiência/Prazo)</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">SLA Interno (Dias) - Opcional</label>
                          <input
                            type="number"
                            min="0"
                            value={step.daysToInternal || ""}
                            onChange={(e) => updateStep(index, 'daysToInternal', e.target.value ? parseInt(e.target.value) : null)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white focus:border-indigo-500 outline-none"
                            placeholder="Ex: 2"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1"> SLA Fatal (Dias) - Opcional</label>
                          <input
                            type="number"
                            min="0"
                            value={step.daysToFatal || ""}
                            onChange={(e) => updateStep(index, 'daysToFatal', e.target.value ? parseInt(e.target.value) : null)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white focus:border-indigo-500 outline-none"
                            placeholder="Ex: 5"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Prioridade</label>
                          <select
                            value={step.taskPriority}
                            onChange={(e) => updateStep(index, 'taskPriority', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white focus:border-indigo-500 outline-none"
                          >
                            <option value="BAIXA">Baixa</option>
                            <option value="MEDIA">Média</option>
                            <option value="ALTA">Alta</option>
                            <option value="URGENTE">Urgente</option>
                          </select>
                        </div>

                        <div className="md:col-span-3">
                          <label className="block text-xs text-slate-500 mb-1">Instruções Opcionais (Descrição)</label>
                          <textarea
                            rows={2}
                            value={step.description || ""}
                            onChange={(e) => updateStep(index, 'description', e.target.value)}
                            className="w-full resize-y bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white focus:border-indigo-500 outline-none"
                            placeholder="Descreva o que deve ser feito nesta etapa..."
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {editingWorkflow.steps.length === 0 && (
                    <div className="text-center p-8 border border-dashed border-slate-700 rounded-lg">
                      <p className="text-slate-500">Nenhuma etapa configurada. Clique em "Adicionar Etapa" para começar.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-slate-400 hover:text-white font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-slate-900 disabled:opacity-50"
              >
                {loading ? "Salvando..." : "Salvar Esteira"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
