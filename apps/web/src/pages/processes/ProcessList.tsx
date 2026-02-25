import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
    Plus, 
    List, 
    Search, 
    Filter, 
    Kanban, 
    FileText,
    Gavel,
    Trash2,
    MoreHorizontal,
    Pencil,
    Trash,
    ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { MagicProcessModal } from './MagicProcessModal';
import { DataGrid } from '../../components/ui/DataGrid';
import { Badge } from '../../components/ui/Badge';
import { InlineTags } from '../../components/ui/InlineTags';
import { HelpModal, useHelpModal } from '../../components/HelpModal';
import { helpProcesses } from '../../data/helpManuals';

interface Process {
    id: string;
    cnj?: string;
    title: string;
    client?: string;
    court?: string;
    courtSystem?: string;
    status: string;
    category?: 'JUDICIAL' | 'EXTRAJUDICIAL';
    value?: number;
    createdAt: string;
    updatedAt: string;
}

export function ProcessList() {
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState<'KANBAN' | 'LIST'>('LIST');
    const [isMagicModalOpen, setIsMagicModalOpen] = useState(false);
    const [processes, setProcesses] = useState<Process[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null); // For dropdown

    // Click outside to close menu
    useEffect(() => {
        const handleClickOutside = () => setActiveMenuId(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);
    
    // GID: Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: keyof Process | null, direction: 'asc' | 'desc' | null }>({ key: null, direction: null });
    // GID: Selection State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const { isHelpOpen, setIsHelpOpen } = useHelpModal();

    useEffect(() => {
        const controller = new AbortController();
        fetchProcesses(controller.signal);
        return () => controller.abort();
    }, []);

    const fetchProcesses = async (signal?: AbortSignal) => {
        try {
            setLoading(true);
            const response = await api.get('/processes', { signal });
            console.log('Processos carregados:', response.data);
            setProcesses(Array.isArray(response.data) ? response.data : []);
        } catch (err: any) {
            if (axios.isCancel(err)) return;
            console.error(err);
            toast.error('Erro ao carregar processos');
        } finally {
            setLoading(false);
        }
    };

    const sortedProcesses = useMemo(() => {
        let sortableItems = [...processes];
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            sortableItems = sortableItems.filter(p => 
                (p.title && p.title.toLowerCase().includes(lowerTerm)) ||
                (p.cnj && p.cnj.toLowerCase().includes(lowerTerm)) ||
                (p.client && p.client.toLowerCase().includes(lowerTerm))
            );
        }
        if (sortConfig.key && sortConfig.direction) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key!] ?? '';
                const bValue = b[sortConfig.key!] ?? '';
                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [processes, sortConfig, searchTerm]);

    const formatCurrency = (val?: number) => val ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val) : '-';
    
    const formatDate = (date?: string) => {
        if (!date) return '-';
        try {
            return new Date(date).toLocaleDateString('pt-BR');
        } catch (e) {
            return date;
        }
    };

    return (
        <div className="space-y-6 h-full flex flex-col animate-in fade-in duration-500 p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        <Gavel className="text-indigo-500" size={32} />
                        Processos & Casos
                    </h1>
                    <p className="text-slate-400 mt-1">Gerencie a esteira jurídica, prazos e andamentos do escritório.</p>
                </div>
                <div className="flex gap-3">
                    <div className="flex bg-slate-900 border border-slate-700 rounded-lg p-1">
                        <button onClick={() => setViewMode('KANBAN')} className={clsx("p-2 rounded-md transition-all", viewMode === 'KANBAN' ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-white")} title="Visualização Kanban"><Kanban size={18} /></button>
                        <button onClick={() => setViewMode('LIST')} className={clsx("p-2 rounded-md transition-all", viewMode === 'LIST' ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-white")} title="Visualização em Lista"><List size={18} /></button>
                    </div>
                    <button onClick={() => setIsMagicModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 whitespace-nowrap"><Plus size={20} /> Novo Processo</button>
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center">
                 <div className="relative flex-1 w-full md:max-w-xl">
                      <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar por CNJ, Parte, Cliente ou Pasta..." className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-slate-500 transition-all" />
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto">
                      <div className="hidden md:block h-6 w-px bg-slate-800"></div>
                      <button className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 flex items-center gap-2 hover:bg-slate-700 hover:text-white transition text-sm font-medium whitespace-nowrap"><Filter size={16} /> Filtros</button>
                      {selectedIds.length > 0 && (
                          <div className="flex items-center gap-2 ml-auto animate-in slide-in-from-right-5 fade-in">
                              <span className="text-sm text-slate-400 hidden sm:inline">{selectedIds.length} selecionados</span>
                              <button className="text-red-400 hover:text-red-300 p-2 hover:bg-red-500/10 rounded-lg transition" title="Excluir Selecionados"><Trash2 size={18} /></button>
                          </div>
                      )}
                  </div>
            </div>

            <div className="flex-1 flex flex-col min-h-[400px]">
                {viewMode === 'LIST' ? (
                    <DataGrid<Process>
                        data={sortedProcesses}
                        totalItems={sortedProcesses.length}
                        isLoading={loading}
                        onSort={(key, direction) => setSortConfig({ key: key as keyof Process, direction })}
                        onSelect={setSelectedIds}
                        columns={[
                            {
                                key: 'title',
                                label: 'Processo / Caso',
                                sortable: true,
                                render: (process) => (
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-white hover:text-indigo-400 transition-colors cursor-pointer" onClick={() => navigate(`/processes/${process.id}`)}>
                                                {process.title}
                                            </span>
                                            {process.category && (
                                                <span className={clsx("px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border border-transparent", process.category === 'JUDICIAL' ? 'text-indigo-400 bg-indigo-500/10' : 'text-amber-400 bg-amber-500/10')}>
                                                    {process.category === 'JUDICIAL' ? 'JUD' : 'ADV'}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-slate-500 text-[10px] mt-0.5 font-mono flex items-center gap-1 group/cnj">
                                            {process.cnj || 'ID: ' + process.id.substring(0,8)}
                                            {process.cnj && (
                                                <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(process.cnj!); toast.success('CNJ copiado!'); }} className="opacity-0 group-hover/cnj:opacity-100 hover:text-white transition-opacity" title="Copiar CNJ"><FileText size={10} /></button>
                                            )}
                                        </span>
                                    </div>
                                )
                            },
                            {
                                key: 'tags' as any,
                                label: 'Etiquetas',
                                render: (p: any) => (
                                    <InlineTags 
                                        tags={p.tags || []} 
                                        entityId={p.id} 
                                        entityType="process" 
                                        onRefresh={() => fetchProcesses()} 
                                    />
                                )
                            },
                            {
                                key: 'court',
                                label: 'Foro',
                                sortable: true,
                                render: (process) => (
                                    <div className="flex flex-col">
                                        <span className="text-slate-300 text-sm">{process.court || '-'}</span>
                                        {process.courtSystem && <span className="text-[10px] text-slate-500 font-mono">{process.courtSystem}</span>}
                                    </div>
                                )
                            },

                            { key: 'client', label: 'Cliente', sortable: true, render: (process) => <span className="text-slate-300 hover:text-white cursor-pointer transition-colors">{process.client || '-'}</span> },
                            {
                                key: 'status',
                                label: 'Status',
                                sortable: true,
                                render: (process) => {
                                    const variantMap: Record<string, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
                                        'ATIVO': 'success', 'EM_ANDAMENTO': 'info', 'SUSPENSO': 'warning', 'ARQUIVADO': 'default', 'ENCERRADO': 'default'
                                    };
                                    return <Badge variant={variantMap[process.status] || 'default'}>{process.status?.replace('_', ' ') || 'RASCUNHO'}</Badge>;
                                }
                            },
                            { key: 'value', label: 'Valor', sortable: true, render: (process) => <span className="font-mono text-xs text-slate-300">{formatCurrency(process.value)}</span> },
                            { key: 'createdAt', label: 'Data', sortable: true, render: (process) => <span className="text-slate-400 text-xs">{formatDate(process.createdAt)}</span> },
                            {
                                key: 'actions' as keyof Process,
                                label: 'Ações',
                                sortable: false,
                                render: (process) => (
                                    <div className="relative">
                                        <button 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setActiveMenuId(activeMenuId === process.id ? null : process.id); 
                                            }} 
                                            className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"
                                        >
                                            <MoreHorizontal size={18} />
                                        </button>
                                        
                                        {activeMenuId === process.id && (
                                            <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); navigate(`/processes/${process.id}`); }} 
                                                    className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2 transition-colors"
                                                >
                                                    <Pencil size={14} /> Editar
                                                </button>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); navigate(`/processes/${process.id}`); }} 
                                                    className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2 transition-colors"
                                                >
                                                    <ExternalLink size={14} /> Abrir Detalhes
                                                </button>
                                                <div className="h-px bg-slate-700 my-1"></div>
                                                <button 
                                                    onClick={async (e) => { 
                                                        e.stopPropagation(); 
                                                        if(confirm('Excluir este processo permanentemente?')) {
                                                            try {
                                                                await api.delete(`/processes/${process.id}`);
                                                                fetchProcesses();
                                                                toast.success('Processo excluído');
                                                            } catch(err) {
                                                                toast.error('Erro ao excluir');
                                                            }
                                                        }
                                                    }} 
                                                    className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2 transition-colors"
                                                >
                                                    <Trash size={14} /> Excluir
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )
                            }
                        ]}
                    />
                ) : (
                    <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-12 text-center flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4"><Kanban size={32} className="text-slate-500" /></div>
                        <h3 className="text-lg font-medium text-white mb-2">Modo Kanban em construção</h3>
                        <p className="text-slate-400 mb-6 max-w-sm">Estamos migrando o quadro para o novo padrão GID. Utilize a lista por enquanto.</p>
                        <button onClick={() => setViewMode('LIST')} className="text-indigo-400 hover:text-indigo-300 text-sm font-medium flex items-center gap-2"><List size={16} /> Voltar para Lista</button>
                    </div>
                )}
            </div>
            <MagicProcessModal isOpen={isMagicModalOpen} onClose={() => setIsMagicModalOpen(false)} onSuccess={fetchProcesses} />
            <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} title="Processos" sections={helpProcesses} />
        </div>
    );
}
