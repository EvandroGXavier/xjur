
import { useState, useEffect } from 'react';
import { Calendar, Plus, Clock, MapPin, Video, AlertCircle, Gavel, Trash2, Edit } from 'lucide-react';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { DataGrid } from '../../components/ui/DataGrid';
import { Badge } from '../../components/ui/Badge';
import { AppointmentModal } from '../../components/agenda/AppointmentModal';

interface Appointment {
  id: string;
  title: string;
  description?: string;
  type: string;
  startAt: string;
  endAt: string;
  status: string;
  location?: string;
  processId?: string;
}

interface ProcessAgendaProps {
    processId: string;
}

export function ProcessAgenda({ processId }: ProcessAgendaProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  useEffect(() => {
    if (processId) {
        fetchAppointments();
    }
  }, [processId]);

  const fetchAppointments = async () => {
    try {
        setLoading(true);
        const response = await api.get(`/appointments?processId=${processId}`);
        setAppointments(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
        console.error('Error fetching appointments:', error);
        toast.error('Erro ao carregar agenda do processo');
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

  const handleEdit = (appointment: Appointment) => {
      setSelectedAppointment(appointment);
      setIsModalOpen(true);
  };

  const handleNew = () => {
      setSelectedAppointment(null);
      setIsModalOpen(true);
  };
  
  const handleDelete = async (id: string) => {
      if(!confirm('Deseja excluir este compromisso?')) return;
      try {
          await api.delete(`/appointments/${id}`);
          toast.success('Compromisso excluído');
          fetchAppointments();
      } catch (err) {
          console.error(err);
          toast.error('Erro ao excluir');
      }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-slate-800">
        <div>
           <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="text-indigo-500" size={20} />
              Agenda do Processo
           </h3>
           <p className="text-sm text-slate-400">Prazos, audiências e reuniões vinculadas.</p>
        </div>
        <button 
            onClick={handleNew}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition shadow-lg shadow-indigo-500/20 text-sm"
        >
            <Plus size={16} /> Novo Agendamento
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden min-h-[300px]">
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
                    },
                    {
                        key: 'id',
                        label: 'Ações',
                        render: (item) => (
                            <div className="flex gap-2">
                                <button onClick={() => handleEdit(item)} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"><Edit size={14} /></button>
                                <button onClick={() => handleDelete(item.id)} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-red-400 transition"><Trash2 size={14} /></button>
                            </div>
                        )
                    }
                ]}
             />
      </div>

      <AppointmentModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={fetchAppointments}
        appointment={selectedAppointment}
        processId={processId}
      />
    </div>
  );
}
