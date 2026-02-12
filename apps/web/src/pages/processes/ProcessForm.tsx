
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { ArrowLeft, Save, Loader2, FileText, Users, Calendar, Activity } from 'lucide-react';
import { masks } from '../../utils/masks';
import { ProcessParties } from './ProcessParties';
import { ProcessoAndamentos } from '../../components/processos/ProcessoAndamentos';

export function ProcessForm() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditing = !!id && id !== 'new';
    
    // Tabs: MAIN, PARTIES, AGENDA
    const [activeTab, setActiveTab] = useState('MAIN');

    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        title: '',
        cnj: '',
        court: '',
        courtSystem: '',
        vars: '',
        district: '',
        status: 'ATIVO',
        category: 'JUDICIAL',
        area: '',
        subject: '',
        judge: '',
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
                title: data.title || '',
                cnj: data.cnj || '',
                court: data.court || '',
                courtSystem: data.courtSystem || '',
                vars: data.vars || '',
                district: data.district || '',
                status: data.status || 'ATIVO',
                category: data.category || 'JUDICIAL',
                area: data.area || '',
                subject: data.subject || '',
                judge: data.judge || '',
                value: data.value ? parseFloat(data.value) : 0,
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
                const res = await api.post('/processes', form);
                toast.success('Processo criado!');
                // Redireciona para edição para liberar as abas
                navigate(`/processes/${res.data.id}`);
            }
        } catch (err) {
            console.error(err);
            toast.error('Erro ao salvar processo');
        } finally {
            setLoading(false);
        }
    };

    if (loading && isEditing && !form.title) {
        return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>;
    }

    const inputClass = "w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors placeholder-slate-600";
    const labelClass = "text-sm font-medium text-slate-300";

    const TabButton = ({ id, label, icon: Icon }: any) => (
        <button
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition ${
                activeTab === id 
                ? 'border-indigo-500 text-indigo-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
        >
            <Icon size={16} />
            {label}
        </button>
    );

    return (
        <div className="p-6 md:p-8 animate-in fade-in">
            {/* HEADER */}
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => navigate('/processes')} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-white">
                        {isEditing ? 'Editar Processo' : 'Novo Processo'}
                    </h1>
                    <p className="text-slate-500 text-sm mt-0.5">
                        {isEditing ? `ID: ${id?.substring(0, 8)}...` : 'Preencha os dados do processo'}
                    </p>
                </div>
            </div>

            {/* TABS (Only if editing) */}
            {isEditing && (
                <div className="flex border-b border-slate-800 mb-6">
                    <TabButton id="MAIN" label="PRINCIPAL" icon={FileText} />
                    <TabButton id="PARTIES" label="PARTES" icon={Users} />
                    <TabButton id="TIMELINE" label="ANDAMENTOS" icon={Activity} />
                    <TabButton id="AGENDA" label="AGENDA" icon={Calendar} />
                </div>
            )}

            {/* CONTENT */}
            <div className="max-w-5xl">
                
                {/* ─── TAB: PRINCIPAL ─── */}
                <div className={activeTab === 'MAIN' ? 'block' : 'hidden'}>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Identificação */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Identificação</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <label className={labelClass}>Título / Nome do Caso *</label>
                                    <input 
                                        value={form.title}
                                        onChange={e => setForm({...form, title: e.target.value})}
                                        className={inputClass}
                                        placeholder="Ex: Ação de Cobrança - João vs Maria"
                                        required
                                    />
                                </div>
                                
                                <div className="space-y-1.5">
                                    <label className={labelClass}>Número CNJ</label>
                                    <input 
                                        value={form.cnj}
                                        onChange={e => setForm({...form, cnj: masks.cnj(e.target.value)})}
                                        className={`${inputClass} font-mono`}
                                        placeholder="0000000-00.0000.0.00.0000"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className={labelClass}>Categoria</label>
                                    <select 
                                        value={form.category}
                                        onChange={e => setForm({...form, category: e.target.value})}
                                        className={inputClass}
                                    >
                                        <option value="JUDICIAL">Judicial</option>
                                        <option value="EXTRAJUDICIAL">Extrajudicial / Consultivo</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className={labelClass}>Status</label>
                                    <select 
                                        value={form.status}
                                        onChange={e => setForm({...form, status: e.target.value})}
                                        className={inputClass}
                                    >
                                        <option value="ATIVO">Ativo</option>
                                        <option value="EM_ANDAMENTO">Em Andamento</option>
                                        <option value="SUSPENSO">Suspenso</option>
                                        <option value="ARQUIVADO">Arquivado</option>
                                        <option value="ENCERRADO">Encerrado</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Detalhes Jurídicos */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Detalhes Jurídicos</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <div className="space-y-1.5">
                                    <label className={labelClass}>Tribunal</label>
                                    <input 
                                        value={form.court}
                                        onChange={e => setForm({...form, court: e.target.value})}
                                        className={inputClass}
                                        placeholder="TJMG, TRF1, TRT3..."
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className={labelClass}>Sistema</label>
                                    <input 
                                        value={form.courtSystem}
                                        onChange={e => setForm({...form, courtSystem: e.target.value})}
                                        className={inputClass}
                                        placeholder="PJe, Eproc, Projudi..."
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className={labelClass}>Vara / Órgão</label>
                                    <input 
                                        value={form.vars}
                                        onChange={e => setForm({...form, vars: e.target.value})}
                                        className={inputClass}
                                        placeholder="2ª Vara Cível"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className={labelClass}>Comarca</label>
                                    <input 
                                        value={form.district}
                                        onChange={e => setForm({...form, district: e.target.value})}
                                        className={inputClass}
                                        placeholder="Belo Horizonte"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className={labelClass}>Magistrado</label>
                                    <input 
                                        value={form.judge}
                                        onChange={e => setForm({...form, judge: e.target.value})}
                                        className={inputClass}
                                        placeholder="Dr. João da Silva"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className={labelClass}>Valor da Causa</label>
                                    <input 
                                        value={masks.currency(form.value.toString())}
                                        onChange={e => {
                                            const val = parseFloat(e.target.value.replace(/\D/g, '')) / 100;
                                            setForm({...form, value: val || 0});
                                        }}
                                        className={inputClass}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Classificação */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Classificação & Notas</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <label className={labelClass}>Área</label>
                                    <input 
                                        value={form.area}
                                        onChange={e => setForm({...form, area: e.target.value})}
                                        className={inputClass}
                                        placeholder="Cível, Trabalhista, Criminal..."
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className={labelClass}>Assunto</label>
                                    <input 
                                        value={form.subject}
                                        onChange={e => setForm({...form, subject: e.target.value})}
                                        className={inputClass}
                                        placeholder="Ação de Cobrança, Indenização..."
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className={labelClass}>Pasta na Nuvem</label>
                                <input 
                                    value={form.folder}
                                    onChange={e => setForm({...form, folder: e.target.value})}
                                    className={inputClass}
                                    placeholder="Z:\Processos\... ou link do Google Drive"
                                />
                            </div>

                            <div className="space-y-1.5">
                                    <label className={labelClass}>Descrição / Objeto</label>
                                    <textarea 
                                        value={form.description}
                                        onChange={e => setForm({...form, description: e.target.value})}
                                        className={`${inputClass} min-h-[120px]`}
                                        placeholder="Descreva o objeto da ação ou do caso..."
                                    />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pb-6">
                            <button type="button" onClick={() => navigate('/processes')} className="px-6 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition">
                                Cancelar
                            </button>
                            <button type="submit" disabled={loading} className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center gap-2 transition disabled:opacity-50 shadow-lg shadow-indigo-500/20">
                                {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                {isEditing ? 'Salvar Alterações' : 'Criar Processo'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* ─── TAB: PARTES ─── */}
                {isEditing && activeTab === 'PARTIES' && (
                    <div className="animate-in fade-in">
                        <ProcessParties processId={id!} />
                    </div>
                )}

                {/* ─── TAB: ANDAMENTOS ─── */}
                {isEditing && activeTab === 'TIMELINE' && (
                    <div className="animate-in fade-in">
                        <ProcessoAndamentos processId={id!} />
                    </div>
                )}

                {/* ─── TAB: AGENDA ─── */}
                {isEditing && activeTab === 'AGENDA' && (
                    <div className="animate-in fade-in flex items-center justify-center h-64 border border-dashed border-slate-800 rounded-xl bg-slate-900/30 text-slate-500">
                        <div className="text-center">
                            <Calendar size={48} className="mx-auto mb-3 opacity-20" />
                            <p>Funcionalidade de Agenda em desenvolvimento...</p>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
