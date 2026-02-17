
import { useState } from 'react';
import { Sliders, Bell, Clock, Users, Save, ToggleLeft, ToggleRight, Plus, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'sonner';

interface Queue {
    id: string;
    name: string;
    color: string;
    members: number;
}

interface SettingsData {
    autoAssign: boolean;
    maxTicketsPerAgent: number;
    autoCloseHours: number;
    notifySound: boolean;
    notifyDesktop: boolean;
    welcomeMessage: string;
    offlineMessage: string;
    workingHoursEnabled: boolean;
    workingStart: string;
    workingEnd: string;
    workingDays: string[];
}

const DAYS = [
    { value: 'MON', label: 'Seg' },
    { value: 'TUE', label: 'Ter' },
    { value: 'WED', label: 'Qua' },
    { value: 'THU', label: 'Qui' },
    { value: 'FRI', label: 'Sex' },
    { value: 'SAT', label: 'Sáb' },
    { value: 'SUN', label: 'Dom' },
];

export function AtendimentoSettings() {
    const [activeTab, setActiveTab] = useState<'general' | 'queues' | 'hours' | 'notifications'>('general');

    const [settings, setSettings] = useState<SettingsData>({
        autoAssign: true,
        maxTicketsPerAgent: 10,
        autoCloseHours: 24,
        notifySound: true,
        notifyDesktop: false,
        welcomeMessage: 'Olá! Seja bem-vindo(a) ao atendimento do nosso escritório. Em que podemos ajudar?',
        offlineMessage: 'Agradecemos seu contato. Nosso horário de atendimento é de Seg a Sex, 8h às 18h. Retornaremos assim que possível!',
        workingHoursEnabled: true,
        workingStart: '08:00',
        workingEnd: '18:00',
        workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    });

    const [queues, setQueues] = useState<Queue[]>([
        { id: '1', name: 'Comercial', color: '#6366f1', members: 3 },
        { id: '2', name: 'Jurídico', color: '#eab308', members: 5 },
        { id: '3', name: 'Financeiro', color: '#22c55e', members: 2 },
        { id: '4', name: 'Suporte', color: '#06b6d4', members: 4 },
    ]);

    const [newQueueName, setNewQueueName] = useState('');

    const handleSave = () => {
        toast.success('Configurações salvas com sucesso!');
    };

    const addQueue = () => {
        if (!newQueueName.trim()) return;
        const colors = ['#6366f1', '#ef4444', '#f97316', '#22c55e', '#06b6d4', '#ec4899'];
        const newQueue: Queue = {
            id: Math.random().toString(36).substr(2, 9),
            name: newQueueName,
            color: colors[queues.length % colors.length],
            members: 0,
        };
        setQueues([...queues, newQueue]);
        setNewQueueName('');
        toast.success('Departamento criado!');
    };

    const removeQueue = (id: string) => {
        if (!confirm('Excluir departamento?')) return;
        setQueues(queues.filter(q => q.id !== id));
        toast.success('Departamento removido');
    };

    const toggleDay = (day: string) => {
        setSettings(prev => ({
            ...prev,
            workingDays: prev.workingDays.includes(day)
                ? prev.workingDays.filter(d => d !== day)
                : [...prev.workingDays, day],
        }));
    };

    const tabs = [
        { id: 'general' as const, label: 'Geral', icon: Sliders },
        { id: 'queues' as const, label: 'Departamentos', icon: Users },
        { id: 'hours' as const, label: 'Horários', icon: Clock },
        { id: 'notifications' as const, label: 'Notificações', icon: Bell },
    ];

    return (
        <div className="flex-1 flex flex-col bg-slate-950 p-6 md:p-8 animate-in fade-in zoom-in-95 duration-300 h-full overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Sliders className="text-slate-400" />
                        Configurações do Atendimento
                    </h2>
                    <p className="text-slate-400 mt-1">Ajuste o comportamento do módulo de atendimento.</p>
                </div>
                <button 
                    onClick={handleSave}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition shadow-lg shadow-indigo-500/20"
                >
                    <Save size={16} /> Salvar
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-slate-900 rounded-lg w-fit mb-6 border border-slate-800">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={clsx(
                            "px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2",
                            activeTab === tab.id
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "text-slate-400 hover:text-white hover:bg-slate-800"
                        )}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {activeTab === 'general' && (
                    <div className="max-w-2xl space-y-6 animate-in fade-in">
                        {/* Auto Assign */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-sm font-bold text-white">Distribuição Automática</h3>
                                    <p className="text-xs text-slate-400 mt-1">Atribuir tickets automaticamente ao agente com menos carga.</p>
                                </div>
                                <button 
                                    onClick={() => setSettings({...settings, autoAssign: !settings.autoAssign})}
                                    className="text-indigo-400"
                                >
                                    {settings.autoAssign 
                                        ? <ToggleRight size={36} className="text-indigo-500" /> 
                                        : <ToggleLeft size={36} className="text-slate-600" />
                                    }
                                </button>
                            </div>
                        </div>

                        {/* Max tickets */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                            <h3 className="text-sm font-bold text-white mb-1">Limite por Agente</h3>
                            <p className="text-xs text-slate-400 mb-3">Máximo de tickets simultâneos por operador.</p>
                            <input 
                                type="number" 
                                value={settings.maxTicketsPerAgent}
                                onChange={(e) => setSettings({...settings, maxTicketsPerAgent: parseInt(e.target.value) || 1})}
                                className="w-24 bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-sm text-center"
                                min={1}
                                max={50}
                            />
                        </div>

                        {/* Auto Close */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                            <h3 className="text-sm font-bold text-white mb-1">Fechamento Automático</h3>
                            <p className="text-xs text-slate-400 mb-3">Fechar tickets inativos após X horas sem resposta.</p>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="number" 
                                    value={settings.autoCloseHours}
                                    onChange={(e) => setSettings({...settings, autoCloseHours: parseInt(e.target.value) || 1})}
                                    className="w-24 bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-sm text-center"
                                    min={1}
                                />
                                <span className="text-sm text-slate-400">horas</span>
                            </div>
                        </div>

                        {/* Welcome Message */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                            <h3 className="text-sm font-bold text-white mb-1">Mensagem de Boas-vindas</h3>
                            <p className="text-xs text-slate-400 mb-3">Enviada automaticamente ao iniciar o atendimento.</p>
                            <textarea 
                                value={settings.welcomeMessage}
                                onChange={(e) => setSettings({...settings, welcomeMessage: e.target.value})}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white text-sm resize-none h-24 focus:border-indigo-500"
                            />
                        </div>

                        {/* Offline Message */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                            <h3 className="text-sm font-bold text-white mb-1">Mensagem Fora do Horário</h3>
                            <p className="text-xs text-slate-400 mb-3">Enviada quando o atendimento está fechado.</p>
                            <textarea 
                                value={settings.offlineMessage}
                                onChange={(e) => setSettings({...settings, offlineMessage: e.target.value})}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white text-sm resize-none h-24 focus:border-indigo-500"
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'queues' && (
                    <div className="max-w-2xl space-y-4 animate-in fade-in">
                        {/* Add Queue */}
                        <div className="bg-slate-900 border border-indigo-500/30 rounded-xl p-5 flex gap-3">
                            <input 
                                value={newQueueName}
                                onChange={(e) => setNewQueueName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addQueue()}
                                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-indigo-500"
                                placeholder="Nome do departamento..."
                            />
                            <button 
                                onClick={addQueue}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition"
                            >
                                <Plus size={16} /> Adicionar
                            </button>
                        </div>

                        {/* Queue List */}
                        {queues.map(queue => (
                            <div key={queue.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between hover:border-slate-600 transition group">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: queue.color }}></div>
                                    <div>
                                        <h3 className="text-sm font-bold text-white">{queue.name}</h3>
                                        <p className="text-[10px] text-slate-500">{queue.members} membro{queue.members !== 1 ? 's' : ''}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => removeQueue(queue.id)}
                                    className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'hours' && (
                    <div className="max-w-2xl space-y-6 animate-in fade-in">
                        {/* Toggle */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-sm font-bold text-white">Horário Comercial</h3>
                                    <p className="text-xs text-slate-400 mt-1">Limitar atendimento ao horário definido.</p>
                                </div>
                                <button 
                                    onClick={() => setSettings({...settings, workingHoursEnabled: !settings.workingHoursEnabled})}
                                    className="text-indigo-400"
                                >
                                    {settings.workingHoursEnabled 
                                        ? <ToggleRight size={36} className="text-indigo-500" /> 
                                        : <ToggleLeft size={36} className="text-slate-600" />
                                    }
                                </button>
                            </div>
                        </div>

                        {settings.workingHoursEnabled && (
                            <>
                                {/* Time Range */}
                                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                                    <h3 className="text-sm font-bold text-white mb-3">Horário</h3>
                                    <div className="flex items-center gap-3">
                                        <input 
                                            type="time" 
                                            value={settings.workingStart}
                                            onChange={(e) => setSettings({...settings, workingStart: e.target.value})}
                                            className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-sm"
                                        />
                                        <span className="text-slate-500">até</span>
                                        <input 
                                            type="time" 
                                            value={settings.workingEnd}
                                            onChange={(e) => setSettings({...settings, workingEnd: e.target.value})}
                                            className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-sm"
                                        />
                                    </div>
                                </div>

                                {/* Days */}
                                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                                    <h3 className="text-sm font-bold text-white mb-3">Dias da Semana</h3>
                                    <div className="flex gap-2">
                                        {DAYS.map(day => (
                                            <button
                                                key={day.value}
                                                onClick={() => toggleDay(day.value)}
                                                className={clsx(
                                                    "w-12 h-12 rounded-lg text-xs font-bold border transition-all",
                                                    settings.workingDays.includes(day.value)
                                                        ? "bg-indigo-600 border-indigo-500 text-white"
                                                        : "bg-slate-950 border-slate-700 text-slate-500 hover:text-white hover:border-slate-500"
                                                )}
                                            >
                                                {day.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'notifications' && (
                    <div className="max-w-2xl space-y-4 animate-in fade-in">
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-sm font-bold text-white">Som de Notificação</h3>
                                    <p className="text-xs text-slate-400 mt-1">Tocar som ao receber nova mensagem.</p>
                                </div>
                                <button 
                                    onClick={() => setSettings({...settings, notifySound: !settings.notifySound})}
                                >
                                    {settings.notifySound 
                                        ? <ToggleRight size={36} className="text-indigo-500" /> 
                                        : <ToggleLeft size={36} className="text-slate-600" />
                                    }
                                </button>
                            </div>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-sm font-bold text-white">Notificações Desktop</h3>
                                    <p className="text-xs text-slate-400 mt-1">Exibir notificações nativas do sistema operacional.</p>
                                </div>
                                <button 
                                    onClick={() => setSettings({...settings, notifyDesktop: !settings.notifyDesktop})}
                                >
                                    {settings.notifyDesktop 
                                        ? <ToggleRight size={36} className="text-indigo-500" /> 
                                        : <ToggleLeft size={36} className="text-slate-600" />
                                    }
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
