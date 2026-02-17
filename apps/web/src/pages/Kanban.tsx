
import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { api } from '../services/api';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { MessageCircle, Clock, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Ticket {
    id: string;
    contactId?: string;
    contact?: {
        name: string;
        phone?: string;
        email?: string;
        id: string;
    };
    title: string;
    status: 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    channel: 'WHATSAPP' | 'EMAIL' | 'PHONE' | 'WEBCHAT';
    lastMessage?: string;
    updatedAt: string;
    queue?: string;
}

const COLUMNS = [
    { id: 'OPEN', title: 'Em Aberto', color: 'bg-red-500/10 border-red-500/20 text-red-400', icon: AlertCircle },
    { id: 'IN_PROGRESS', title: 'Em Atendimento', color: 'bg-blue-500/10 border-blue-500/20 text-blue-400', icon: MessageCircle },
    { id: 'WAITING', title: 'Aguardando', color: 'bg-amber-500/10 border-amber-500/20 text-amber-400', icon: Clock },
    { id: 'RESOLVED', title: 'Resolvidos', color: 'bg-green-500/10 border-green-500/20 text-green-400', icon: CheckCircle },
];

export const Kanban: React.FC = () => {
    const navigate = useNavigate();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchTickets();
    }, []);

    const fetchTickets = async () => {
        try {
            setLoading(true);
            const res = await api.get('/tickets');
            setTickets(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            console.error(e);
            toast.error('Erro ao carregar tickets');
        } finally {
            setLoading(false);
        }
    };

    const getTicketsByStatus = (status: string) => {
        return tickets.filter(t => t.status === status);
    };

    const onDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;

        if (
            destination.droppableId === source.droppableId &&
            destination.index === source.index
        ) {
            return;
        }

        const movedTicket = tickets.find(t => t.id === draggableId);
        if (!movedTicket) return;

        const newStatus = destination.droppableId as Ticket['status'];
        
        // Optimistic Update
        const updatedTickets = tickets.map(t => 
            t.id === draggableId ? { ...t, status: newStatus } : t
        );
        setTickets(updatedTickets);

        try {
            await api.patch(`/tickets/${draggableId}/status`, { status: newStatus });
            toast.success(`Ticket movido para ${COLUMNS.find(c => c.id === newStatus)?.title}`);
        } catch (e) {
            console.error(e);
            toast.error('Erro ao atualizar status');
            fetchTickets(); // Revert on error
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-950 p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">Quadro Kanban</h1>
                    <p className="text-slate-400 text-sm">Gerencie seus atendimentos visualmente</p>
                </div>
                <button 
                    onClick={fetchTickets} 
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition border border-slate-700 flex items-center gap-2"
                >
                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                    Atualizar
                </button>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
                    {COLUMNS.map(column => (
                        <div key={column.id} className="flex-1 min-w-[300px] flex flex-col bg-slate-900/50 rounded-xl border border-slate-800/50">
                            {/* Column Header */}
                            <div className={clsx("p-4 border-b border-slate-800 flex items-center justify-between", column.color)}>
                                <div className="flex items-center gap-2 font-bold">
                                    <column.icon size={18} />
                                    {column.title}
                                </div>
                                <span className="bg-slate-900/50 px-2 py-0.5 rounded text-xs">
                                    {getTicketsByStatus(column.id).length}
                                </span>
                            </div>

                            {/* Droppable Area */}
                            <Droppable droppableId={column.id}>
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={clsx(
                                            "flex-1 p-3 space-y-3 overflow-y-auto transition-colors scrollbar-thin scrollbar-thumb-slate-700",
                                            snapshot.isDraggingOver ? "bg-slate-800/30" : ""
                                        )}
                                    >
                                        {getTicketsByStatus(column.id).map((ticket, index) => (
                                            <Draggable key={ticket.id} draggableId={ticket.id} index={index}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        onClick={() => navigate('/atendimento')} // Navigate to chat on click? Or maybe we should have a generic route
                                                        className={clsx(
                                                            "bg-slate-800 border border-slate-700 p-4 rounded-lg shadow-sm hover:shadow-md hover:border-indigo-500/50 transition group cursor-grab active:cursor-grabbing",
                                                            snapshot.isDragging ? "shadow-xl ring-2 ring-indigo-500/50 rotate-2" : ""
                                                        )}
                                                        style={provided.draggableProps.style}
                                                    >
                                                        <div className="flex justify-between items-start mb-2">
                                                            <h4 className="font-bold text-white text-sm line-clamp-1">{ticket.contact?.name || 'Sem nome'}</h4>
                                                            <span className="text-[10px] text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                                                                #{ticket.id.substring(0, 4)}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-slate-400 line-clamp-2 mb-3 min-h-[2.5em]">
                                                            {ticket.lastMessage || 'Sem mensagens...'}
                                                        </p>
                                                        
                                                        <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-700/50 pt-2">
                                                            <span className="flex items-center gap-1">
                                                                {ticket.channel === 'WHATSAPP' && <MessageCircle size={10} />}
                                                                {ticket.queue || 'Geral'}
                                                            </span>
                                                            <span>{new Date(ticket.updatedAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    ))}
                </div>
            </DragDropContext>
        </div>
    );
};
