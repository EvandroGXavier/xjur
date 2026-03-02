import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { FileText, Plus, Search, Printer, Check } from 'lucide-react';
import { toast } from 'sonner';

export function ProposalsPage() {
  const [proposals, setProposals] = useState<any[]>([]);

  useEffect(() => {
    loadProposals();
  }, []);

  const loadProposals = async () => {
    try {
      const res = await api.get('/proposals');
      setProposals(res.data);
    } catch {
      toast.error('Erro ao buscar orçamentos');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.patch(`/proposals/${id}/status`, { status: 'APPROVED' });
      toast.success('Orçamento aprovado. Financeiro e estoque atualizados!');
      loadProposals();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao aprovar');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Orçamentos & Vendas</h1>
          <p className="text-sm text-slate-500">Gerencie propostas comerciais</p>
        </div>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-indigo-700">
          <Plus size={16} /> Novo Orçamento
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="Buscar orçamento..." className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="p-4 font-medium">Código</th>
                <th className="p-4 font-medium">Cliente</th>
                <th className="p-4 font-medium">Data</th>
                <th className="p-4 font-medium">Total</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {proposals.map(prop => (
                <tr key={prop.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-sm font-medium text-slate-800">#{prop.code}</td>
                  <td className="p-4 text-sm text-slate-600">{prop.contact?.name || '---'}</td>
                  <td className="p-4 text-sm text-slate-500">{new Date(prop.createdAt).toLocaleDateString()}</td>
                  <td className="p-4 text-sm font-medium text-slate-800">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(prop.totalAmount)}
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                      prop.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                      prop.status === 'DRAFT' ? 'bg-slate-100 text-slate-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {prop.status}
                    </span>
                  </td>
                  <td className="p-4 text-right flex justify-end gap-2">
                    {prop.status !== 'APPROVED' && (
                      <button onClick={() => handleApprove(prop.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg tooltip" title="Aprovar (Gera Financeiro e Estoque)">
                        <Check size={18} />
                      </button>
                    )}
                    <button className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg">
                      <Printer size={18} />
                    </button>
                    <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700 px-2 py-1">
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
              {proposals.length === 0 && (
                <tr>
                   <td colSpan={6} className="p-8 text-center text-slate-500 text-sm">
                     Nenhum orçamento encontrado.
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
