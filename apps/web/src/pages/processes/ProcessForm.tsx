
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { masks } from '../../utils/masks';

export function ProcessForm() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditing = !!id && id !== 'new';
    
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        title: '',
        cnj: '',
        court: '',
        courtSystem: '',
        status: 'ATIVO',
        category: 'JUDICIAL',
        client: '',
        value: 0,
        description: '',
        folder: ''
    });

    useEffect(() => {
        if (isEditing) {
            fetchProcess();
        }
    }, [id]);

    const fetchProcess = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/processes/${id}`);
            const data = res.data;
            setForm({
                title: data.title,
                cnj: data.cnj || '',
                court: data.court || '',
                courtSystem: data.courtSystem || '',
                status: data.status || 'ATIVO',
                category: data.category || 'JUDICIAL',
                client: data.client || '',
                value: data.value || 0,
                description: data.description || '',
                folder: data.folder || ''
            });
        } catch (err) {
            toast.error('Erro ao carregar processo');
            navigate('/processes');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!form.title) {
            toast.warning('Título é obrigatório');
            return;
        }

        setLoading(true);
        try {
            if (isEditing) {
                await api.patch(`/processes/${id}`, form);
                toast.success('Processo atualizado!');
            } else {
                await api.post('/processes', form);
                toast.success('Processo criado!');
            }
            navigate('/processes');
        } catch (err) {
            console.error(err);
            toast.error('Erro ao salvar processo');
        } finally {
            setLoading(false);
        }
    };

    if (loading && isEditing && !form.title) {
        return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-indigo-500" /></div>;
    }

    return (
        <div className="p-6 md:p-8 animate-in fade-in">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => navigate('/processes')} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition">
                    <ArrowLeft size={20} />
                </button>
                <h1 className="text-2xl font-bold text-white">
                    {isEditing ? 'Editar Processo' : 'Novo Processo'}
                </h1>
            </div>

            <form onSubmit={handleSubmit} className="max-w-4xl space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Título / Nome do Caso *</label>
                            <input 
                                value={form.title}
                                onChange={e => setForm({...form, title: e.target.value})}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                                required
                            />
                        </div>
                        
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Número CNJ</label>
                            <input 
                                value={form.cnj}
                                onChange={e => setForm({...form, cnj: masks.cnj(e.target.value)})}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Status</label>
                            <select 
                                value={form.status}
                                onChange={e => setForm({...form, status: e.target.value})}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                            >
                                <option value="ATIVO">Ativo</option>
                                <option value="SUSPENSO">Suspenso</option>
                                <option value="ARQUIVADO">Arquivado</option>
                                <option value="ENCERRADO">Encerrado</option>
                            </select>
                        </div>
                         
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Categoria</label>
                            <select 
                                value={form.category}
                                onChange={e => setForm({...form, category: e.target.value})}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                            >
                                <option value="JUDICIAL">Judicial</option>
                                <option value="EXTRAJUDICIAL">Extrajudicial / Consultivo</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Cliente (Nome)</label>
                            <input 
                                value={form.client}
                                onChange={e => setForm({...form, client: e.target.value})}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Valor da Causa</label>
                            <input 
                                value={masks.currency(form.value.toString())}
                                onChange={e => {
                                    const val = parseFloat(e.target.value.replace(/\D/g, '')) / 100;
                                    setForm({...form, value: val || 0});
                                }}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                         <label className="text-sm font-medium text-slate-300">Descrição / Objeto</label>
                         <textarea 
                             value={form.description}
                             onChange={e => setForm({...form, description: e.target.value})}
                             className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 min-h-[100px]"
                         />
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => navigate('/processes')} className="px-6 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition">
                        Cancelar
                    </button>
                    <button type="submit" disabled={loading} className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center gap-2 transition disabled:opacity-50">
                        {loading ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                        Salvar
                    </button>
                </div>
            </form>
        </div>
    );
}
