import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api'; // Importando cliente autenticado
import { toast } from 'sonner';

interface Contact {
  id: string;
  name: string;
  document: string;
  cpf?: string;
  cnpj?: string;
<<<<<<< HEAD
  pfData?: { cpf: string };
  pjData?: { cnpj: string };
=======
>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69
  email: string;
  phone: string;
}

export function ContactList() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
<<<<<<< HEAD
=======
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // ALL, PF, PJ
>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69

  useEffect(() => {
    fetchContacts();
  }, []);

  const formatDocument = (doc: string) => {
    const cleaned = doc.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    if (cleaned.length === 14) {
      return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return doc;
  };

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
<<<<<<< HEAD
      // Usar toast customizado para confirmação seria ideal, mas para rapidez manteremos confirm nativo por enquanto ou mudaremos
      // Vamos manter o padrão simples pedido
      
=======
>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69
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

<<<<<<< HEAD
=======
  const filteredContacts = contacts.filter(contact => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      contact.name.toLowerCase().includes(searchLower) ||
      (contact.email && contact.email.toLowerCase().includes(searchLower)) ||
      (contact.document && contact.document.includes(searchTerm)) ||
      (contact.cpf && contact.cpf.includes(searchTerm)) ||
      (contact.cnpj && contact.cnpj.includes(searchTerm))
    );

    const matchesType = filterType === 'ALL' 
        ? true 
        : (contact.cpf && filterType === 'PF') || (contact.cnpj && filterType === 'PJ');

    return matchesSearch && matchesType;
  });

>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69
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
<<<<<<< HEAD
=======
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69
                placeholder="Buscar por nome, CPF ou email..." 
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
          </div>
<<<<<<< HEAD
=======
          <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
          >
              <option value="ALL">Todos</option>
              <option value="PF">Pessoa Física</option>
              <option value="PJ">Pessoa Jurídica</option>
          </select>
>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69
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
<<<<<<< HEAD
                  ) : contacts.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Nenhum contato encontrado.</td></tr>
                  ) : (
                      contacts.map(contact => (
                          <tr key={contact.id} onClick={() => navigate(`/contacts/${contact.id}`)} className="hover:bg-slate-800/50 cursor-pointer transition-colors group">
                              <td className="px-6 py-4 font-medium text-white">{contact.name}</td>
                              <td className="px-6 py-4">{formatDocument(contact.document || contact.pfData?.cpf || contact.pjData?.cnpj || contact.cpf || contact.cnpj || '') || '-'}</td>
=======
                  ) : filteredContacts.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Nenhum contato encontrado.</td></tr>
                  ) : (
                      filteredContacts.map(contact => (
                          <tr key={contact.id} onClick={() => navigate(`/contacts/${contact.id}`)} className="hover:bg-slate-800/50 cursor-pointer transition-colors group">
                              <td className="px-6 py-4 font-medium text-white">{contact.name}</td>
                              <td className="px-6 py-4">{formatDocument(contact.document || contact.cpf || contact.cnpj || '') || '-'}</td>
>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69
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
