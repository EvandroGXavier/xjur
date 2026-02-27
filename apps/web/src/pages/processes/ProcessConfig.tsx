import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, Settings, Gavel, Layout, Database, FileSpreadsheet, 
  ChevronRight, Users, Zap, Plus, Trash2, Save, Tags
} from 'lucide-react';
import { api } from '../../services/api';
import { toast } from 'sonner';

interface ConfigCard {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  action: () => void;
  badge?: string;
  gradient: string;
}

export function ProcessConfig() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loadingAction, setLoadingAction] = useState(false);
  
  // View state
  const [view, setView] = useState<'cards' | 'bulk'>('cards');
  const [tags, setTags] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  // Action States
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedLawyer, setSelectedLawyer] = useState('');
  const [targetStatus, setTargetStatus] = useState('');

  // Get filters from previous page
  const incomingFilters = location.state?.filters;
  
  useEffect(() => {
    if (view === 'bulk') {
        fetchTags();
        fetchUsers();
    }
  }, [view]);

  const fetchTags = async () => {
    try {
      const { data } = await api.get('/tags?scope=PROCESS');
      setTags(data);
    } catch (err) { console.error(err); }
  };

  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/users');
      setUsers(data);
    } catch (err) { console.error(err); }
  };

  const handleBatchAction = async (action: string) => {
    const filterDesc = incomingFilters 
        ? "os processos filtrados na tela anterior" 
        : "TODOS os processos da base";
        
    const confirmMsg = `Deseja aplicar esta ação a ${filterDesc}?`;
    if (!window.confirm(confirmMsg)) return;

    try {
        setLoadingAction(true);
        const payload: any = { 
            action,
            ...incomingFilters 
        };

        if (action.includes('TAG')) payload.tagId = selectedTag;
        if (action === 'UPDATE_STATUS') payload.status = targetStatus;
        if (action === 'UPDATE_LAWYER') payload.lawyerName = selectedLawyer;

        const res = await api.post('/processes/bulk-action', payload);
        toast.success(`Ação concluída! Itens afetados: ${res.data.updatedCount}`);
    } catch (err: any) {
        toast.error('Erro ao executar ação: ' + (err.response?.data?.message || err.message));
    } finally {
        setLoadingAction(false);
    }
  };

  const configCards: ConfigCard[] = [
    {
      id: 'bulk',
      icon: <Zap className="w-6 h-6" />,
      title: 'Ações em Massa',
      description: 'Atribua advogados, mude status ou etiquetas de múltiplos processos simultaneamente.',
      action: () => setView('bulk'),
      gradient: 'from-indigo-500 to-blue-600',
    },
    {
      id: 'automations',
      icon: <Layout className="w-6 h-6" />,
      title: 'Regras de Automação',
      description: 'Configure disparos automáticos de tarefas conforme a mudança de status do processo.',
      action: () => {},
      badge: 'Em breve',
      gradient: 'from-emerald-500 to-teal-600',
    },
    {
      id: 'fields',
      icon: <Database className="w-6 h-6" />,
      title: 'Campos do Processo',
      description: 'Personalize os campos e informações adicionais que deseja coletar por pasta.',
      action: () => {},
      badge: 'Em breve',
      gradient: 'from-amber-500 to-orange-600',
    },
  ];

  return (
    <div className="min-h-screen p-6 md:p-8 animate-in fade-in duration-500 text-slate-200">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (view === 'bulk') setView('cards');
              else navigate('/processes');
            }}
            className="p-2.5 hover:bg-slate-800 rounded-xl transition-all border border-slate-800 group"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-blue-500/20 rounded-xl border border-indigo-500/20">
                <Settings className="text-indigo-400 w-6 h-6" />
              </div>
              {view === 'bulk' ? 'Ações em Massa (Processos)' : 'Configurações de Processos'}
            </h1>
            <p className="text-slate-400 mt-1 ml-14">
                {view === 'bulk' 
                    ? (incomingFilters ? "Aplicando ações aos processos filtrados na grid." : "Ações massivas para toda a base de processos.")
                    : "Gerencie automações, campos e organização dos seus casos."
                }
            </p>
          </div>
        </div>
      </div>

      {view === 'bulk' ? (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 max-w-5xl">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* TAGS */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/20">
                            <Tags className="text-indigo-400" size={20} />
                        </div>
                        <h3 className="text-lg font-semibold text-white">Etiquetas</h3>
                    </div>
                    <div className="space-y-4">
                        <select 
                            value={selectedTag}
                            onChange={(e) => setSelectedTag(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500"
                        >
                            <option value="">Selecione Etiqueta...</option>
                            {tags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
                        </select>
                        <div className="grid grid-cols-2 gap-2">
                             <button onClick={() => handleBatchAction('ADD_TAG')} disabled={loadingAction || !selectedTag} className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-30">Atribuir</button>
                             <button onClick={() => handleBatchAction('REMOVE_TAG')} disabled={loadingAction || !selectedTag} className="bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-30">Remover</button>
                        </div>
                    </div>
                </div>

                {/* LAWYER */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-blue-500/20 rounded-lg border border-blue-500/20">
                            <Users className="text-blue-400" size={20} />
                        </div>
                        <h3 className="text-lg font-semibold text-white">Responsável</h3>
                    </div>
                    <div className="space-y-4">
                        <select 
                            value={selectedLawyer}
                            onChange={(e) => setSelectedLawyer(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500"
                        >
                            <option value="">Selecione Advogado...</option>
                            {users.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                        </select>
                        <button onClick={() => handleBatchAction('UPDATE_LAWYER')} disabled={loadingAction || !selectedLawyer} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-30 flex items-center justify-center gap-2">
                            <Save size={16} /> Atribuir em Massa
                        </button>
                    </div>
                </div>

                {/* STATUS */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-amber-500/20 rounded-lg border border-amber-500/20">
                            <Zap className="text-amber-400" size={20} />
                        </div>
                        <h3 className="text-lg font-semibold text-white">Alterar Status</h3>
                    </div>
                    <div className="space-y-4">
                        <select 
                            value={targetStatus}
                            onChange={(e) => setTargetStatus(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-amber-500"
                        >
                            <option value="">Selecione Status...</option>
                            <option value="ATIVO">Ativo</option>
                            <option value="SUSPENSO">Suspenso</option>
                            <option value="ARQUIVADO">Arquivado</option>
                            <option value="OPORTUNIDADE">Oportunidade</option>
                        </select>
                        <button onClick={() => handleBatchAction('UPDATE_STATUS')} disabled={loadingAction || !targetStatus} className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-30">
                            Confirmar Mudança
                        </button>
                    </div>
                </div>
            </div>

            {incomingFilters && (
                <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center gap-3">
                    <Zap size={18} className="text-indigo-400" />
                    <p className="text-sm text-slate-400">
                        <strong>Filtros Ativos:</strong> A ação será aplicada apenas aos processos que obedecem aos critérios da busca anterior.
                    </p>
                </div>
            )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {configCards.map((card) => {
              const isDisabled = !!card.badge;
              return (
                <button
                  key={card.id}
                  onClick={card.action}
                  disabled={isDisabled}
                  className={`group relative text-left rounded-xl border transition-all duration-300 overflow-hidden
                    ${isDisabled
                      ? 'bg-slate-900/50 border-slate-800/50 cursor-not-allowed opacity-60'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-600 hover:shadow-xl hover:shadow-black/20 hover:-translate-y-0.5 active:scale-[0.98]'
                    }
                  `}
                >
                  <div className={`h-1 w-full bg-gradient-to-r ${card.gradient} ${isDisabled ? 'opacity-30' : 'opacity-70 group-hover:opacity-100'} transition-opacity`} />
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-xl bg-gradient-to-br ${card.gradient} ${isDisabled ? 'opacity-40' : 'opacity-80 group-hover:opacity-100 group-hover:scale-110'} transition-all duration-300 shadow-lg`}>
                        <span className="text-white">{card.icon}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {card.badge && (
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full border border-slate-700">
                            {card.badge}
                          </span>
                        )}
                        {!isDisabled && (
                          <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all duration-300" />
                        )}
                      </div>
                    </div>
                    <h3 className={`text-lg font-semibold mb-2 transition-colors ${isDisabled ? 'text-slate-500' : 'text-white group-hover:text-indigo-300'}`}>
                      {card.title}
                    </h3>
                    <p className={`text-sm leading-relaxed ${isDisabled ? 'text-slate-600' : 'text-slate-400'}`}>
                      {card.description}
                    </p>
                  </div>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
