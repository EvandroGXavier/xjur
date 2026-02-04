import { useState, useEffect } from 'react';
import { Plus, LayoutGrid, List, Search, Filter, Kanban } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { MagicProcessModal } from './MagicProcessModal';

export function ProcessList() {
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState<'KANBAN' | 'LIST'>('KANBAN');
    const [isMagicModalOpen, setIsMagicModalOpen] = useState(false);
    const [processes, setProcesses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProcesses();
    }, []);

    const fetchProcesses = async () => {
        try {
            setLoading(true);
            const response = await api.get('/processes');
            setProcesses(response.data);
        } catch (err) {
            console.error(err);
            // toast.error('Erro ao carregar processos');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Processos</h1>
                    <p className="text-slate-400 mt-1">Gerencie seus casos e prazos judiciais.</p>
                </div>
                <div className="flex gap-3">
                    <div className="flex bg-slate-900 border border-slate-700 rounded-lg p-1">
                        <button 
                            onClick={() => setViewMode('KANBAN')}
                            className={clsx("p-2 rounded transition", viewMode === 'KANBAN' ? "bg-slate-800 text-white" : "text-slate-500 hover:text-white")}
                        >
                            <Kanban size={20} />
                        </button>
                        <button 
                            onClick={() => setViewMode('LIST')}
                            className={clsx("p-2 rounded transition", viewMode === 'LIST' ? "bg-slate-800 text-white" : "text-slate-500 hover:text-white")}
                        >
                            <List size={20} />
                        </button>
                    </div>

                    <button 
                        onClick={() => setIsMagicModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition shadow-lg shadow-indigo-500/20"
                    >
                        <Plus size={20} /> Novo Processo
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex gap-4">
                 <div className="relative flex-1">
                      <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input 
                        type="text" 
                        placeholder="Buscar por CNJ, Parte ou Assunto..." 
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                      />
                  </div>
                  <button className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 flex items-center gap-2 hover:bg-slate-700 hover:text-white transition">
                      <Filter size={18} /> Filtros
                  </button>
            </div>

            {/* Content Content - Placeholder for now until we have database populated */}
            <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-lg flex items-center justify-center p-12 text-center">
                {processes.length === 0 ? (
                    <div className="max-w-md">
                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <LayoutGrid size={32} className="text-slate-500" />
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">Sem processos cadastrados</h3>
                        <p className="text-slate-400 mb-6">Use o botão "Novo Processo" para importar automaticamente do tribunal via CNJ.</p>
                        <button 
                            onClick={() => setIsMagicModalOpen(true)} 
                            className="text-indigo-400 hover:text-indigo-300 font-medium"
                        >
                            Criar meu primeiro caso &rarr;
                        </button>
                    </div>
                ) : (
                    <div className="text-white">Lista de Processos (Em construção: Grid/Kanban)...</div>
                )}
            </div>

            <MagicProcessModal 
                isOpen={isMagicModalOpen}
                onClose={() => setIsMagicModalOpen(false)}
                onSuccess={fetchProcesses}
            />
        </div>
    );
}
