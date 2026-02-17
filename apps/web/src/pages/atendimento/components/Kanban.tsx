import { useState } from 'react';
import { Kanban, Plus, MoreHorizontal, User, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import { DragDropContext, Droppable, Draggable, DropResult, DroppableProvided, DraggableProvided, DraggableStateSnapshot } from 'react-beautiful-dnd';

interface Task {
    id: string;
    content: string;
    description?: string;
    tags?: string[];
    assignee?: string;
    dueDate?: string;
}

interface Column {
    id: string;
    title: string;
    tasks: Task[];
    color: string;
}

const initialData: Column[] = [
    {
        id: '1',
        title: 'Aguardando',
        color: 'border-l-4 border-slate-500',
        tasks: [
            { id: 't1', content: 'Novo lead: Empresa XYZ', description: 'Interesse em consultoria tributária.', tags: ['Lead', 'Alto Valor'], assignee: 'Op. Ana', dueDate: 'Hoje' },
            { id: 't2', content: 'Retorno Dr. Roberto', description: 'Dúvida sobre contrato.', tags: ['Cliente'], assignee: 'Dr. João', dueDate: 'Ontem' },
        ]
    },
    {
        id: '2',
        title: 'Em Atendimento',
        color: 'border-l-4 border-indigo-500',
        tasks: [
            { id: 't3', content: 'Análise de minuta', description: 'Cliente aguarda revisão.', tags: ['Urgente', 'Contrato'], assignee: 'Adv. Senior', dueDate: 'Amanhã' },
        ]
    },
    {
        id: '3',
        title: 'Agendado',
        color: 'border-l-4 border-amber-500',
        tasks: [
            { id: 't4', content: 'Reunião Sócio ABC', description: 'Videoconferência às 14h.', tags: ['Reunião'], assignee: 'Sócio', dueDate: '15/02' },
        ]
    },
    {
        id: '4',
        title: 'Finalizado',
        color: 'border-l-4 border-emerald-500',
        tasks: [
            { id: 't5', content: 'Envio de Proposta', description: 'Proposta enviada por e-mail.', tags: ['Comercial'], assignee: 'Op. Ana', dueDate: '12/02' },
        ]
    }
];

export function KanbanBoard() {
    const [columns, setColumns] = useState(initialData);

    const onDragEnd = (result: DropResult) => {
        const { source, destination } = result;
        if (!destination) return; // Dropped outside list
        if (source.droppableId === destination.droppableId && source.index === destination.index) return; // Dropped in same place

        const sourceColIndex = columns.findIndex((col: Column) => col.id === source.droppableId);
        const destColIndex = columns.findIndex((col: Column) => col.id === destination.droppableId);
        const sourceCol = columns[sourceColIndex];
        const destCol = columns[destColIndex];

        const sourceTasks = Array.from(sourceCol.tasks);
        const destTasks = Array.from(destCol.tasks);
        const [movedTask] = sourceTasks.splice(source.index, 1);

        if (source.droppableId === destination.droppableId) {
            sourceTasks.splice(destination.index, 0, movedTask);
            const newColumns = [...columns];
            newColumns[sourceColIndex] = { ...sourceCol, tasks: sourceTasks };
            setColumns(newColumns);
        } else {
            destTasks.splice(destination.index, 0, movedTask);
            const newColumns = [...columns];
            newColumns[sourceColIndex] = { ...sourceCol, tasks: sourceTasks };
            newColumns[destColIndex] = { ...destCol, tasks: destTasks };
            setColumns(newColumns);
        }
    };

    return (
        <div className="flex-1 flex flex-col bg-slate-950 p-6 md:p-8 animate-in fade-in zoom-in-95 duration-300 overflow-hidden h-full">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Kanban className="text-indigo-400" /> Funil de Atendimento
                    </h2>
                    <p className="text-slate-400 mt-1">Gerencie leads e tarefas em quadros visuais.</p>
                </div>
                <div className="flex gap-2">
                    <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition shadow-lg shadow-indigo-500/20">
                        <Plus size={16} /> Novo Cartão
                    </button>
                    <button className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm font-medium transition">
                        Configurar Colunas
                    </button>
                </div>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex gap-4 overflow-x-auto h-full pb-4 items-start custom-scrollbar">
                    {columns.map((column: Column) => (
                        <div key={column.id} className="min-w-[300px] w-[300px] flex flex-col bg-slate-900 border border-slate-800 rounded-xl h-full max-h-full">
                            <div className={clsx("p-4 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-900 z-10 rounded-t-xl", column.color)}>
                                <h3 className="font-bold text-slate-200">{column.title}</h3>
                                <span className="bg-slate-800 text-slate-400 text-xs px-2 py-0.5 rounded-full font-mono">{column.tasks.length}</span>
                            </div>
                            
                            <Droppable droppableId={column.id}>
                                {(provided: DroppableProvided) => (
                                    <div 
                                        {...provided.droppableProps} 
                                        ref={provided.innerRef} 
                                        className="p-3 space-y-3 flex-1 overflow-y-auto custom-scrollbar min-h-[100px]"
                                    >
                                        {column.tasks.map((task: Task, index: number) => (
                                            <Draggable key={task.id} draggableId={task.id} index={index}>
                                                {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        className={clsx(
                                                            "bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-sm hover:shadow-md hover:border-slate-600 transition group select-none",
                                                            snapshot.isDragging ? "opacity-50 ring-2 ring-indigo-500 rotate-2" : ""
                                                        )}
                                                        style={{ ...provided.draggableProps.style }}
                                                    >
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="flex gap-1 flex-wrap">
                                                                {task.tags?.map((tag: string) => (
                                                                    <span key={tag} className={clsx("text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider", tag === 'Urgente' ? "bg-red-500/10 text-red-400" : "bg-indigo-500/10 text-indigo-300")}>
                                                                        {tag}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                            <button className="text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition"><MoreHorizontal size={14} /></button>
                                                        </div>
                                                        <h4 className="text-sm font-semibold text-slate-200 mb-1 leading-snug">{task.content}</h4>
                                                        {task.description && <p className="text-xs text-slate-400 mb-3 line-clamp-2">{task.description}</p>}
                                                        <div className="flex items-center justify-between text-slate-500 pt-2 border-t border-slate-700/50 mt-2">
                                                            <div className="flex items-center gap-1.5" title="Responsável">
                                                                <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-white">
                                                                    {task.assignee?.charAt(0) || <User size={10} />}
                                                                </div>
                                                                <span className="text-[10px]">{task.assignee?.split(' ')[0] || 'N/A'}</span>
                                                            </div>
                                                            {task.dueDate && (
                                                                <div className={clsx("flex items-center gap-1 text-[10px]", task.dueDate === 'Hoje' ? "text-amber-400" : "text-slate-500")}>
                                                                    <Clock size={10} /> {task.dueDate}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {column.tasks.length === 0 && (
                                            <div className="text-center py-8 text-slate-600 text-xs italic border-2 border-dashed border-slate-800 rounded-lg">
                                                Arraste tarefas aqui
                                            </div>
                                        )}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>

                            <button className="m-3 p-2 border border-dashed border-slate-700 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 hover:border-slate-500 transition text-xs font-medium flex items-center justify-center gap-2">
                                <Plus size={14} /> Adicionar
                            </button>
                        </div>
                    ))}
                </div>
            </DragDropContext>
        </div>
    );
}

