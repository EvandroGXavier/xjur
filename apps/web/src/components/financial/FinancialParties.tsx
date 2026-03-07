
import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { Trash2, Building2, FileText, Phone, Mail } from 'lucide-react';
import { ContactPickerGlobal } from '../contacts/ContactPickerGlobal';
import { useNavigate } from 'react-router-dom';

interface FinancialPartiesProps {
  recordId: string;
  recordType?: 'INCOME' | 'EXPENSE';
  bankAccounts?: any[];
  currentBankAccountId?: string;
  onBankAccountChange?: (id: string) => void;
  onUpdate?: () => void;
}

interface FinancialPartyData {
  id: string;
  contactId: string;
  role: string; // CREDITOR, DEBTOR, PAYER, BENEFICIARY
  amount?: number;
  notes?: string;
  contact: {
    id: string;
    name: string;
    document?: string;
    personType: string;
    phone?: string;
    email?: string;
  };
}

const FINANCIAL_ROLES = [
  { label: 'Credor', value: 'CREDITOR' },
  { label: 'Devedor', value: 'DEBTOR' },
  { label: 'Pagador', value: 'PAYER' },
  { label: 'Beneficiário', value: 'BENEFICIARY' },
  { label: 'Fiador', value: 'GUARANTOR' },
  { label: 'Testemunha', value: 'WITNESS' },
];

export function FinancialParties({ 
  recordId, 
  recordType: _recordType,
  bankAccounts = [],
  currentBankAccountId,
  onBankAccountChange,
  onUpdate,
}: FinancialPartiesProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [parties, setParties] = useState<FinancialPartyData[]>([]);
  const [partyAmount, setPartyAmount] = useState('');

  useEffect(() => {
    if (recordId) fetchParties();
  }, [recordId]);

  const fetchParties = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/financial/records/${recordId}/parties`);
      setParties(res.data);
    } catch (err) {
      toast.error('Erro ao buscar partes da transação');
    } finally {
      setLoading(false);
    }
  };

  const handleGlobalAdd = async (data: any) => {
    try {
      setLoading(true);
      if (data.isQuickAdd) {
        await api.post(`/financial/records/${recordId}/parties/quick-contact`, {
          ...data.quickContact,
          role: data.roleId,
          amount: data.amount ? parseFloat(data.amount) : undefined,
        });
      } else {
        await api.post(`/financial/records/${recordId}/parties`, {
          contactId: data.contactId,
          role: data.roleId,
          amount: data.amount ? parseFloat(data.amount) : undefined,
        });
      }
      toast.success(data.isQuickAdd ? 'Contato criado e vinculado!' : 'Parte adicionada com sucesso!');
      setPartyAmount('');
      fetchParties();
      onUpdate?.();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao adicionar parte');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveParty = async (partyId: string) => {
    if (!confirm('Tem certeza que deseja remover esta parte?')) return;
    try {
      await api.delete(`/financial/records/${recordId}/parties/${partyId}`);
      toast.success('Parte removida');
      fetchParties();
      onUpdate?.();
    } catch (err) {
      toast.error('Erro ao remover parte');
    }
  };

  // Agrupamento por papel
  const creditors = parties.filter(p => p.role === 'CREDITOR');
  const debtors = parties.filter(p => p.role === 'DEBTOR');
  const payers = parties.filter(p => p.role === 'PAYER');
  const others = parties.filter(p => !['CREDITOR', 'DEBTOR', 'PAYER'].includes(p.role));

  const getRoleLabel = (role: string) => {
    const found = FINANCIAL_ROLES.find(r => r.value === role);
    return found ? found.label : role;
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'CREDITOR': return { text: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/20' };
      case 'DEBTOR': return { text: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/20' };
      case 'PAYER': return { text: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/20' };
      case 'BENEFICIARY': return { text: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-500/20' };
      default: return { text: 'text-slate-400', bg: 'bg-slate-500/20', border: 'border-slate-500/20' };
    }
  };

  const renderList = (title: string, items: FinancialPartyData[], colorClass: string, emptyMessage: string) => (
    <div className={`rounded-xl border ${colorClass} bg-slate-900/50 backdrop-blur-sm overflow-hidden`}>
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
        <h3 className="font-semibold text-slate-200 text-sm uppercase tracking-wider">{title}</h3>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
          {items.length}
        </span>
      </div>
      <div className="divide-y divide-slate-800">
        {items.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-sm italic">
            {emptyMessage}
          </div>
        ) : (
          items.map(party => {
            const roleColor = getRoleColor(party.role);
            return (
              <div key={party.id} className="p-3 hover:bg-slate-800/50 transition flex items-center justify-between group">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${roleColor.bg} ${roleColor.text} shrink-0`}>
                    {party.contact.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-200 flex items-center gap-2 flex-wrap">
                      <span 
                        className="hover:text-indigo-400 cursor-pointer transition-colors truncate"
                        onClick={() => navigate(`/contacts/${party.contact.id}`)}
                      >
                        {party.contact.name}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${roleColor.bg} ${roleColor.text} ${roleColor.border} font-bold uppercase`}>
                        {getRoleLabel(party.role)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5 flex-wrap">
                      {party.contact.document && (
                        <span className="flex items-center gap-1">
                          <FileText size={10} />
                          {party.contact.document}
                        </span>
                      )}
                      {party.contact.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={10} />
                          {party.contact.phone}
                        </span>
                      )}
                      {party.contact.email && (
                        <span className="flex items-center gap-1">
                          <Mail size={10} />
                          {party.contact.email}
                        </span>
                      )}
                      {party.amount && (
                        <span className="text-indigo-400 font-bold">
                          R$ {Number(party.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => handleRemoveParty(party.id)}
                  className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition shrink-0"
                  title="Remover parte"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className="animate-in fade-in space-y-6">
      {/* Adicionar Parte */}
      <ContactPickerGlobal 
        onAdd={handleGlobalAdd}
        loading={loading}
        context="financial"
        customRoles={FINANCIAL_ROLES}
        roleLabel="Papel na Transação"
        rolePlaceholder="Selecione..."
        hideQualification={true}
        showAmount={true}
        amount={partyAmount}
        onAmountChange={(val) => setPartyAmount(val)}
      />

      {/* Conta Bancária / Pagador Institucional */}
      {bankAccounts.length > 0 && (
        <div className="rounded-xl border border-blue-900/30 bg-slate-900/50 backdrop-blur-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/80 flex items-center gap-2">
            <Building2 size={16} className="text-blue-400" />
            <h3 className="font-semibold text-slate-200 text-sm uppercase tracking-wider">Conta Pagadora</h3>
          </div>
          <div className="p-4">
            <select
              value={currentBankAccountId || ''}
              onChange={(e) => onBankAccountChange?.(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="">Nenhuma conta selecionada</option>
              {bankAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.title} - {acc.bankName} ({acc.accountType === 'CHECKING' ? 'CC' : 'Poup.'})
                </option>
              ))}
            </select>
            {currentBankAccountId && (
              <p className="text-[10px] text-slate-500 mt-2 italic">
                A conta bancária representa o pagador institucional da transação.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Listas por grupo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderList('Credores (Quem Recebe)', creditors, 'border-emerald-900/30', 'Nenhum credor vinculado')}
        {renderList('Devedores (Quem Paga)', debtors, 'border-red-900/30', 'Nenhum devedor vinculado')}
      </div>

      {(payers.length > 0 || others.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {payers.length > 0 && renderList('Pagadores', payers, 'border-blue-900/30', '')}
          {others.length > 0 && renderList('Outros Envolvidos', others, 'border-slate-800', '')}
        </div>
      )}

      {/* Hint contextual */}
      <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-4">
        <p className="text-xs text-slate-500 leading-relaxed">
          <strong className="text-slate-400">💡 Exemplo prático:</strong> Um advogado compra Papel A4 na papelaria.{' '}
          <span className="text-emerald-400">Credor</span>: Papelaria XYZ (fornecedor).{' '}
          <span className="text-red-400">Devedor</span>: Dr. João Silva (advogado). {' '}
          <span className="text-blue-400">Conta Pagadora</span>: Banco do Brasil CC 12345 (conta do escritório).
          A transação não precisa ser da empresa — qualquer pessoa pode ser credor ou devedor.
        </p>
      </div>
    </div>
  );
}
