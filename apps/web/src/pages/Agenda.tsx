import { useState, useEffect, useMemo } from 'react';
import { Calendar, Plus, Clock, MapPin, Video, AlertCircle, Gavel, List, Grid } from 'lucide-react';
import { api } from '../services/api';
import { toast } from 'sonner';
import { DataGrid } from '../components/ui/DataGrid';
import { Badge } from '../components/ui/Badge';
import { AppointmentModal } from '../components/agenda/AppointmentModal';
import { CalendarMonthView } from '../components/agenda/CalendarMonthView';
import { startOfMonth, endOfMonth } from 'date-fns';
import { HelpModal, useHelpModal } from '../components/HelpModal';
import { helpAgenda } from '../data/helpManuals';

interface Appointment {
  id: string;
  title: string;
  description?: string;
  type: 'AUDIENCIA' | 'PRAZO' | 'REUNIAO' | 'INTIMACAO';
  startAt: string;
  endAt: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'IN_PROGRESS' | 'DONE' | 'CANCELED' | 'RESCHEDULED';
  location?: string;
  processId?: string;
}

export function Agenda() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'LIST' | 'MONTH'>('MONTH');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Appointment | null, direction: 'asc' | 'desc' | null }>({ key: null, direction: null });
  const { isHelpOpen, setIsHelpOpen } = useHelpModal();

  useEffect(() => {
    fetchAppointments();
  }, [currentDate, viewMode]);

  const fetchAppointments = async () => {
    try {
        setLoading(true);
        let url = '/appointments';
        
        // If in Month view, filter by current month range to optimize
        if (viewMode === 'MONTH') {
            const start = startOfMonth(currentDate).toISOString();
            const end = endOfMonth(currentDate).toISOString();
            url += `?start=${start}&end=${end}`;
        }

        const response = await api.get(url);
        setAppointments(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
        console.error('Error fetching appointments:', error);
        toast.error('Erro ao carregar agenda');
    } finally {
        setLoading(false);
    }
  };

  const sortedAppointments = useMemo(() => {
      let sortableItems = [...appointments];
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
  }, [appointments, sortConfig]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', { 
      day: '2-digit', month: '2-digit', year: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    });
  };

  const getTypeIcon = (type: string) => {
      switch(type) {
          case 'AUDIENCIA': return <Gavel size={14} className="text-red-400" />;
          case 'PRAZO': return <AlertCircle size={14} className="text-amber-400" />;
          case 'REUNIAO': return <Video size={14} className="text-blue-400" />;
          default: return <Clock size={14} className="text-slate-400" />;
      }
  };

  const statusVariant = (status: string) => {
      switch(status) {
          case 'DONE': return 'success';
          case 'CONFIRMED': return 'info';
          case 'CANCELED': return 'error';
          case 'SCHEDULED': return 'warning';
          default: return 'default';
      }
  };

  const handleEdit = (appointment: Appointment) => {
      setSelectedAppointment(appointment);
      setIsModalOpen(true);
  };

  const handleNew = (date?: Date) => {
      setSelectedAppointment(null);
      // Logic to pass date to modal could be done by setting a 'initialDate' state or modify selectedAppointment to a partial object
      // For simplicity, let's just open the modal. To properly support pre-filling, AppointmentModal needs to accept an initialDate prop or we assume 'now' if null.
      // Let's modify AppointmentModal to accept initialDate, or just rely on 'now' for now.
      // Wait, I can pass a "stub" appointment with just startAt set.
      if (date) {
         // Create a stub appointment for new entry on that date
         const stub = {
             id: '',
             title: '',
             type: 'AUDIENCIA',
             // Set default time to 09:00 of that day
             startAt: new Date(date.setHours(9, 0, 0, 0)).toISOString(),
             // Default 1 hour duration
             endAt: new Date(date.setHours(10, 0, 0, 0)).toISOString(),
             status: 'SCHEDULED'
         } as Appointment;
         setSelectedAppointment(stub);
      } else {
         setSelectedAppointment(null);
      }
      setIsModalOpen(true);
  };

  return (
    <div className="p-6 md:p-8 space-y-6 h-full flex flex-col animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <Calendar className="text-indigo-500" size={32} />
              Agenda & Prazos
           </h1>
           <p className="text-slate-400 mt-1">Controle audiências, reuniões e prazos fatais.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-lg">
            <button 
                onClick={() => setViewMode('LIST')}
                className={`p-2 rounded-md transition ${viewMode === 'LIST' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
                title="Lista"
            >
                <List size={20} />
            </button>
            <button 
                onClick={() => setViewMode('MONTH')}
                className={`p-2 rounded-md transition ${viewMode === 'MONTH' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
                title="Calendário"
            >
                <Grid size={20} />
            </button>
            <div className="w-px h-6 bg-slate-800 mx-1"></div>
            <button 
                onClick={() => handleNew()}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition shadow-lg shadow-indigo-500/20"
            >
                <Plus size={20} /> Novo
            </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-sm relative">
         {viewMode === 'LIST' ? (
             <DataGrid<Appointment>
                data={sortedAppointments}
                onSort={(key, direction) => setSortConfig({ key: key as keyof Appointment, direction })}
                totalItems={sortedAppointments.length}
                isLoading={loading}
                columns={[
                    {
                        key: 'title',
                        label: 'Compromisso',
                        sortable: true,
                        render: (item) => (
                            <div className="flex flex-col cursor-pointer" onClick={() => handleEdit(item)}>
                                <span className="font-medium text-white hover:text-indigo-400 transition">{item.title}</span>
                                <span className="text-xs text-slate-500">{item.description || '-'}</span>
                            </div>
                        )
                    },
                    {
                        key: 'type',
                        label: 'Tipo',
                        sortable: true,
                        render: (item) => (
                            <div className="flex items-center gap-2">
                                {getTypeIcon(item.type)}
                                <span className="text-xs font-bold text-slate-300 uppercase">{item.type}</span>
                            </div>
                        )
                    },
                    {
                        key: 'startAt',
                        label: 'Data/Hora',
                        sortable: true,
                        render: (item) => (
                            <div className="flex flex-col">
                                <span className="text-slate-300 font-mono text-xs">{formatDate(item.startAt)}</span>
                            </div>
                        )
                    },
                     {
                        key: 'location',
                        label: 'Local',
                        sortable: true,
                        render: (item) => (
                            <div className="flex items-center gap-1 text-slate-400 text-xs">
                                <MapPin size={12} /> {item.location || 'Virtual'}
                            </div>
                        )
                    },
                    {
                        key: 'status',
                        label: 'Status',
                        sortable: true,
                        render: (item) => (
                            <Badge variant={statusVariant(item.status)}>
                                {item.status}
                            </Badge>
                        )
                    }
                ]}
             />
         ) : (
             <div className="p-4 h-full flex flex-col">
                 <div className="flex items-center justify-between mb-4 px-2">
                     <h2 className="text-xl font-bold text-white capitalize">
                        {currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
                     </h2>
                     <div className="flex gap-2">
                         <button 
                            onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}
                            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"
                         >
                             Anterior
                         </button>
                         <button 
                            onClick={() => setCurrentDate(new Date())}
                            className="p-2 hover:bg-slate-800 rounded-lg text-indigo-400 font-medium"
                         >
                             Hoje
                         </button>
                         <button 
                            onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}
                            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"
                         >
                             Próximo
                         </button>
                     </div>
                 </div>
                 <CalendarMonthView 
                    currentDate={currentDate}
                    appointments={appointments}
                    onSelectSlot={(date) => {
                        handleNew(date);
                    }}
                    onSelectAppointment={handleEdit}
                 />
             </div>
         )}
      </div>

      <AppointmentModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={fetchAppointments}
        appointment={selectedAppointment}
      />
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} title="Agenda" sections={helpAgenda} />
    </div>
  );
}
