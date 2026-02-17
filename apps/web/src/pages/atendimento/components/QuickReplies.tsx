
import { useState } from 'react';
import { Search, Plus, Trash2, Edit, Copy, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'sonner';

interface QuickReply {
    id: string;
    shortcut: string;
    content: string;
}

export function QuickReplies() {
    const [replies, setReplies] = useState<QuickReply[]>([
        { id: '1', shortcut: '/saudacao', content: 'Olá! Sou o assistente virtual do Dr.X Advogados. Como posso ajudar?' },
        { id: '2', shortcut: '/honorarios', content: 'Nossos honorários são calculados com base na tabela da OAB. Podemos agendar uma reunião?' },
        { id: '3', shortcut: '/pix', content: 'Nossa chave PIX é o CNPJ: 12.345.678/0001-90 (DR.X Advogados Associados).' },
        { id: '4', shortcut: '/end', content: 'Nosso escritório fica na Av. Paulista, 1000, 15º andar, São Paulo/SP.' },
    ]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditing, setIsEditing] = useState<string | null>(null);
    const [newShortcut, setNewShortcut] = useState('');
    const [newContent, setNewContent] = useState('');

    const filteredReplies = replies.filter(r => 
        r.shortcut.toLowerCase().includes(searchTerm.toLowerCase()) || 
        r.content.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSave = () => {
        if (!newShortcut || !newContent) return;
        
        if (isEditing) {
            setReplies(replies.map(r => r.id === isEditing ? { ...r, shortcut: newShortcut, content: newContent } : r));
            setIsEditing(null);
            toast.success('Resposta atualizada!');
        } else {
            setReplies([...replies, { id: Math.random().toString(), shortcut: newShortcut, content: newContent }]);
            toast.success('Resposta criada!');
        }
        setNewShortcut('');
        setNewContent('');
    };

    const handleEdit = (reply: QuickReply) => {
        setIsEditing(reply.id);
        setNewShortcut(reply.shortcut);
        setNewContent(reply.content);
    };

    const handleDelete = (id: string) => {
        if (confirm('Excluir esta resposta?')) {
            setReplies(replies.filter(r => r.id !== id));
            toast.success('Resposta excluída.');
        }
    };

    return (
        <div className="flex-1 flex flex-col bg-slate-950 p-6 md:p-8 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Zap className="text-amber-400" /> Respostas Rápidas
                    </h2>
                    <p className="text-slate-400 mt-1">Gerencie atalhos para agilizar o atendimento.</p>
                </div>
                <div className="flex gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-amber-500 w-full md:w-64"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
                {/* Form */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-fit">
                    <h3 className="text-lg font-bold text-slate-200 mb-4">{isEditing ? 'Editar Resposta' : 'Nova Resposta'}</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Atalho (ex: /ola)</label>
                            <input 
                                type="text" 
                                value={newShortcut}
                                onChange={(e) => setNewShortcut(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-amber-500 transition-colors"
                                placeholder="/"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Mensagem</label>
                            <textarea 
                                value={newContent}
                                onChange={(e) => setNewContent(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-amber-500 transition-colors h-32 resize-none"
                                placeholder="Digite a resposta completa..."
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            {isEditing && (
                                <button onClick={() => { setIsEditing(null); setNewShortcut(''); setNewContent(''); }} className="px-4 py-2 text-slate-400 hover:text-white transition">Cancelar</button>
                            )}
                            <button onClick={handleSave} className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold px-6 py-2 rounded-lg flex items-center gap-2 transition shadow-lg shadow-amber-500/20">
                                <Plus size={18} /> {isEditing ? 'Atualizar' : 'Criar Resposta'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* List */}
                <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                    {filteredReplies.map(reply => (
                        <div key={reply.id} className={clsx("bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-600 transition group", isEditing === reply.id ? "border-amber-500/50 bg-amber-500/5" : "")}>
                            <div className="flex justify-between items-start mb-2">
                                <span className="px-2 py-1 bg-amber-500/10 text-amber-500 rounded text-xs font-mono font-bold tracking-wider border border-amber-500/20">
                                    {reply.shortcut}
                                </span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => { navigator.clipboard.writeText(reply.content); toast.success('Copiado!'); }} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded" title="Copiar"><Copy size={16} /></button>
                                    <button onClick={() => handleEdit(reply)} className="p-1.5 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded" title="Editar"><Edit size={16} /></button>
                                    <button onClick={() => handleDelete(reply.id)} className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded" title="Excluir"><Trash2 size={16} /></button>
                                </div>
                            </div>
                            <p className="text-slate-300 text-sm leading-relaxed">{reply.content}</p>
                        </div>
                    ))}
                    {filteredReplies.length === 0 && (
                        <div className="text-center text-slate-500 py-12">
                            <p>Nenhuma resposta encontrada.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
