import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api'; // Importando cliente autenticado
import { toast } from 'sonner';

interface Contact {
  id: string;
  name: string;
  document: string;
  email: string;
  phone: string;
}

export function ContactList() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
        setLoading(true);
        const response = await api.get('/contacts');
        setContacts(response.data);
    } catch (err) {
        console.error(err);
        toast.error('Erro ao carregar contatos');
    } finally {
        setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      // Usar toast customizado para confirmação seria ideal, mas para rapidez manteremos confirm nativo por enquanto ou mudaremos
      // Vamos manter o padrão simples pedido
      
      const confirmDelete = window.confirm('Tem certeza que deseja excluir este contato?');
      if(confirmDelete) {
          try {
              await api.delete(`/contacts/${id}`);
              toast.success('Contato excluído com sucesso');
              fetchContacts();
          } catch(err) {
              console.error(err);
              toast.error('Erro ao excluir contato');
          }
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Contatos</h1>
          <p className="text-slate-400 mt-1">Gerencie sua base de clientes e parceiros.</p>
        </div>
        <button 
            onClick={() => navigate('/contacts/new')} 
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition shadow-lg shadow-indigo-500/20"
        >
            <Plus size={20} /> Novo Contato
        </button>
      </div>

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex gap-4">
          <div className="relative flex-1">
              <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                placeholder="Buscar por nome, CPF ou email..." 
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
          </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-left text-sm text-slate-400">
              <thead className="bg-slate-950 text-slate-200 font-medium">
                  <tr>
                      <th className="px-6 py-4">Nome</th>
                      <th className="px-6 py-4">Documento</th>
                      <th className="px-6 py-4">Email</th>
                      <th className="px-6 py-4">Telefone</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                  {loading ? (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Carregando...</td></tr>
                  ) : contacts.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Nenhum contato encontrado.</td></tr>
                  ) : (
                      contacts.map(contact => (
                          <tr key={contact.id} onClick={() => navigate(`/contacts/${contact.id}`)} className="hover:bg-slate-800/50 cursor-pointer transition-colors group">
                              <td className="px-6 py-4 font-medium text-white">{contact.name}</td>
                              <td className="px-6 py-4">{contact.document}</td>
                              <td className="px-6 py-4">{contact.email || '-'}</td>
                              <td className="px-6 py-4">{contact.phone || '-'}</td>
                              <td className="px-6 py-4 text-right flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                                  <button onClick={(e) => { e.stopPropagation(); navigate(`/contacts/${contact.id}`); }} className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-indigo-400 transition">
                                      <Edit2 size={16} />
                                  </button>
                                  <button onClick={(e) => handleDelete(contact.id, e)} className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-red-400 transition">
                                      <Trash2 size={16} />
                                  </button>
                              </td>
                          </tr>
                      ))
                  )}
              </tbody>
          </table>
      </div>
    </div>
  );
}
