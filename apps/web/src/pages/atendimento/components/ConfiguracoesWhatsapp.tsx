
import { useState, useEffect } from 'react';
import { Shield, Users, Save, Plus, Trash2, Info, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { api } from '../../../services/api';

interface Connection {
  id: string;
  name: string;
  type: string;
  config: any;
}

export function ConfiguracoesWhatsapp() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnId, setSelectedConnId] = useState<string>('');
  const [bloquearGrupos, setBloquearGrupos] = useState(false);
  const [grupoInput, setGrupoInput] = useState('');
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      const response = await api.get<Connection[]>('/connections');
      const waConns = response.data.filter(c => c.type === 'WHATSAPP');
      setConnections(waConns);
      if (waConns.length > 0) {
        setSelectedConnId(waConns[0].id);
        const config = waConns[0].config || {};
        setBloquearGrupos(config.blockGroups ?? true);
        setWhitelist(config.groupWhitelist || []);
      }
    } catch (error) {
      toast.error('Erro ao carregar conexões');
    } finally {
      setLoading(false);
    }
  };

  const handleConnChange = (id: string) => {
    setSelectedConnId(id);
    const conn = connections.find(c => c.id === id);
    if (conn) {
      const config = conn.config || {};
      setBloquearGrupos(config.blockGroups ?? true);
      setWhitelist(config.groupWhitelist || []);
    }
  };

  const salvarConfiguracoes = async () => {
    if (!selectedConnId) return;
    setSaving(true);
    try {
      await api.patch(`/connections/${selectedConnId}`, {
        config: {
          blockGroups: bloquearGrupos,
          groupWhitelist: whitelist
        }
      });
      toast.success('Configurações do DR.X atualizadas com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const adicionarGrupo = () => {
    if (grupoInput.includes('@g.us')) {
      if (whitelist.includes(grupoInput)) {
        toast.error('Este grupo já está na lista');
        return;
      }
      setWhitelist([...whitelist, grupoInput]);
      setGrupoInput('');
    } else {
      toast.error('Formato inválido! O ID do grupo deve terminar com @g.us');
    }
  };

  const removerGrupo = (id: string) => {
    setWhitelist(whitelist.filter(g => g !== id));
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-950 p-6 md:p-8 animate-in fade-in zoom-in-95 duration-300 h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-6xl mx-auto">
        
        {/* Header Premium DR.X */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl mb-8">
          <div className="bg-gradient-to-r from-slate-900 via-[#1E3A8A]/40 to-slate-900 p-8 border-b border-slate-800 flex items-center gap-6">
            <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center border border-blue-500/30 shadow-lg shadow-blue-500/10">
              <Shield className="text-blue-400" size={36} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight uppercase">Protocolo de Segurança DR.X</h1>
              <p className="text-blue-200/50 text-base">Gerenciamento avançado de fluxo e filtragem de mensagens WhatsApp</p>
            </div>
          </div>

          <div className="p-8 md:p-10">
            <div className="flex flex-col lg:flex-row gap-12">
              {/* Sidebar de Seleção de Conexão */}
              <div className="lg:w-80 shrink-0">
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mb-6">Instância de Operação</h3>
                <div className="space-y-3">
                  {connections.map(conn => (
                    <button
                      key={conn.id}
                      onClick={() => handleConnChange(conn.id)}
                      className={clsx(
                        "w-full flex items-center justify-between p-3 rounded-xl transition-all border",
                        selectedConnId === conn.id 
                          ? "bg-blue-600/10 border-blue-500 text-blue-400" 
                          : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700 hover:bg-slate-900"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Users size={16} />
                        <span className="text-sm font-medium truncate">{conn.name}</span>
                      </div>
                      <ChevronRight size={14} className={selectedConnId === conn.id ? "opacity-100" : "opacity-0"} />
                    </button>
                  ))}
                  {connections.length === 0 && (
                    <div className="text-slate-600 text-sm italic p-4 border border-dashed border-slate-800 rounded-xl">
                      Nenhuma conexão WhatsApp encontrada.
                    </div>
                  )}
                </div>
              </div>

              {/* Painel de Configurações */}
              <div className="flex-1 space-y-8">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Info size={16} className="text-blue-400" />
                    <h2 className="text-lg font-bold text-white">Filtro de Grupos</h2>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Configure quais mensagens de grupo o sistema deve processar. Mensagens de grupos fora da lista ou não vinculadas a processos serão ignoradas automaticamente para garantir foco total.
                  </p>
                </div>

                {/* Switch de Bloqueio */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 hover:border-blue-500/30 transition-colors shadow-inner">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center border border-slate-800">
                        <Users size={24} className={bloquearGrupos ? "text-blue-400" : "text-slate-600"} />
                      </div>
                      <div>
                        <strong className="text-white block">Bloquear Grupos Desconhecidos</strong>
                        <span className="text-slate-500 text-sm">Apenas grupos autorizados entrarão no Atendimento</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => setBloquearGrupos(!bloquearGrupos)}
                      className={clsx(
                        "relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ring-offset-2 ring-offset-slate-950 focus:ring-2 focus:ring-blue-500",
                        bloquearGrupos ? "bg-blue-600" : "bg-slate-800"
                      )}
                    >
                      <span
                        className={clsx(
                          "inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-200 ease-in-out shadow-lg",
                          bloquearGrupos ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>
                </div>

                {/* Whitelist Section */}
                <div className={clsx(
                  "transition-all duration-500 overflow-hidden",
                  bloquearGrupos ? "opacity-100 max-h-[1000px]" : "opacity-30 max-h-0 pointer-events-none grayscale"
                )}>
                  <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 relative">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                      <Shield size={80} />
                    </div>

                    <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                      Grupos Permitidos <span className="text-xs font-normal text-slate-500">(Whitelist)</span>
                    </h3>
                    
                    <div className="flex gap-2 mb-6">
                      <input 
                        type="text" 
                        placeholder="Ex: 12036302@g.us"
                        value={grupoInput}
                        onChange={(e) => setGrupoInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && adicionarGrupo()}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition shadow-inner"
                      />
                      <button 
                        onClick={adicionarGrupo} 
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl transition-all shadow-lg shadow-blue-900/20 active:scale-95 flex items-center gap-2 font-bold"
                      >
                        <Plus size={20} /> Adicionar
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {whitelist.map(grupo => (
                        <div key={grupo} className="flex justify-between items-center px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl group/item hover:bg-slate-900 hover:border-slate-700 transition-all">
                          <span className="text-xs font-mono text-slate-400 group-hover/item:text-slate-200 truncate">{grupo}</span>
                          <button 
                            onClick={() => removerGrupo(grupo)} 
                            className="text-slate-600 hover:text-red-500 p-1.5 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      {whitelist.length === 0 && (
                        <div className="col-span-full py-8 text-center border-2 border-dashed border-slate-800 rounded-2xl text-slate-600 text-sm italic">
                          Nenhum grupo cadastrado manualmente.
                        </div>
                      )}
                    </div>
                    
                    <p className="text-[10px] text-slate-600 mt-4 leading-relaxed">
                      * Grupos vinculados a processos ativos serão permitidos automaticamente pelo DR.X, independente desta lista.
                    </p>
                  </div>
                </div>

                {/* Botão Salvar Premium */}
                <button 
                  onClick={salvarConfiguracoes}
                  disabled={saving || !selectedConnId}
                  className={clsx(
                    "w-full bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-5 rounded-2xl transition-all shadow-xl font-bold flex items-center justify-center gap-3 relative overflow-hidden group/save",
                    (saving || !selectedConnId) ? "opacity-50 cursor-not-allowed" : "hover:shadow-blue-500/20 hover:scale-[1.01] active:scale-[0.99]"
                  )}
                >
                  <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover/save:translate-x-[100%] transition-transform duration-1000 ease-in-out" />
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      SALVANDO...
                    </>
                  ) : (
                    <>
                      <Save size={22} />
                      SALVAR CONFIGURAÇÕES NO SERVIDOR
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Rodapé Informativo */}
        <div className="flex items-center justify-center gap-4 text-slate-600 text-[10px] uppercase tracking-widest font-bold">
           <span>DRX Intelligence</span>
           <span className="w-1 h-1 bg-slate-800 rounded-full" />
           <span>Segurança Jurídica</span>
           <span className="w-1 h-1 bg-slate-800 rounded-full" />
           <span>Protocolo de Fluxo</span>
        </div>
      </div>
    </div>
  );
}
