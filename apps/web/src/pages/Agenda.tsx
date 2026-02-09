
import { useState, useEffect } from 'react';
import { Calendar, Plus, Clock, MapPin, Video, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { toast } from 'sonner';
import { DataGrid } from '../components/ui/DataGrid';
import { Badge } from '../components/ui/Badge';

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

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
        setLoading(true);
        const response = await api.get('/appointments');
        setAppointments(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
        console.error('Error fetching appointments:', error);
        toast.error('Erro ao carregar agenda');
    } finally {
        setLoading(false);
    }
  };

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

  return (
    <div className="p-6 md:p-8 space-y-6 h-full flex flex-col animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <Calendar className="text-indigo-500" size={32} />
              Agenda & Prazos
           </h1>
           <p className="text-slate-400 mt-1">Controle audiências, reuniões e prazos fatais.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition shadow-lg shadow-indigo-500/20">
            <Plus size={20} /> Novo Compromisso
        </button>
      </div>

      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-sm">
         <DataGrid<Appointment>
            data={appointments}
            totalItems={appointments.length}
            isLoading={loading}
            columns={[
                {
                    key: 'title',
                    label: 'Compromisso',
                    sortable: true,
                    render: (item) => (
                        <div className="flex flex-col">
                            <span className="font-medium text-white">{item.title}</span>
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
                             {/* Icon placeholder since Gavel is not imported yet, using generalized logic */}
                             <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 uppercase">{item.type}</span>
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
      </div>
    </div>
  );
}
