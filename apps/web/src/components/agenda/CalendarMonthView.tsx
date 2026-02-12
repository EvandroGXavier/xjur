
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, isSameDay, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '../ui/Badge';

interface CalendarMonthViewProps {
    currentDate: Date;
    appointments: any[];
    onSelectSlot: (date: Date) => void;
    onSelectAppointment: (appointment: any) => void;
}

export function CalendarMonthView({ currentDate, appointments, onSelectSlot, onSelectAppointment }: CalendarMonthViewProps) {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Domingo
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const calendarDays = eachDayOfInterval({
        start: startDate,
        end: endDate,
    });

    const getDayAppointments = (date: Date) => {
        return appointments.filter(app => isSameDay(new Date(app.startAt), date));
    };

    return (
        <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            {/* Header Semanal */}
            <div className="grid grid-cols-7 bg-slate-950 border-b border-slate-800">
                {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(day => (
                    <div key={day} className="py-2 text-center text-xs font-semibold text-slate-500">
                        {day}
                    </div>
                ))}
            </div>
            
            {/* Grid de Dias */}
            <div className="flex-1 grid grid-cols-7 auto-rows-fr bg-slate-900">
                {calendarDays.map((day, idx) => {
                    const dayApps = getDayAppointments(day);
                    const isCurrentMonth = isSameMonth(day, monthStart);
                    
                    return (
                         <div 
                            key={day.toISOString()} 
                            onClick={() => onSelectSlot(day)}
                            className={`
                                min-h-[100px] border-b border-r border-slate-800 p-2 cursor-pointer transition-colors
                                ${!isCurrentMonth ? 'bg-slate-950/30 text-slate-600' : 'text-slate-300 hover:bg-slate-800/30'}
                                ${isToday(day) ? 'bg-indigo-500/5' : ''}
                            `}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`
                                    text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full
                                    ${isToday(day) ? 'bg-indigo-600 text-white' : ''}
                                `}>
                                    {format(day, 'd')}
                                </span>
                            </div>

                            <div className="space-y-1">
                                {dayApps.slice(0, 4).map(app => ( // Limit display to 4 per day
                                    <div 
                                        key={app.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSelectAppointment(app);
                                        }}
                                        className={`
                                            text-[10px] px-1.5 py-1 rounded border truncate cursor-pointer hover:opacity-80 transition
                                            ${app.type === 'AUDIENCIA' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                                              app.type === 'PRAZO' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                                              app.type === 'REUNIAO' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                                              'bg-slate-800 border-slate-700 text-slate-300'}
                                        `}
                                        title={app.title}
                                    >
                                        <span className="font-mono opacity-70 mr-1">
                                            {format(new Date(app.startAt), 'HH:mm')}
                                        </span>
                                        {app.title}
                                    </div>
                                ))}
                                {dayApps.length > 4 && (
                                    <div className="text-[10px] text-slate-500 text-center">
                                        + {dayApps.length - 4} mais
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
