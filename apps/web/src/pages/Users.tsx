
import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Users,
  UserPlus,
  Trash2,
  Shield,
  User,
  MoreVertical,
  X,
  Save
} from 'lucide-react';
import { clsx } from 'clsx';

const Modal = ({ isOpen, onClose, title, children }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-800/50">
                    <h3 className="text-lg font-semibold text-white">{title}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    );
};

export function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({ name: '', email: '', password: '', role: 'MEMBER' });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
        setLoading(true);
        const res = await api.get('/users');
        setUsers(res.data);
    } catch (error) {
        console.error('Erro ao buscar usuários', error);
    } finally {
        setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          setLoading(true);
          await api.post('/users', formData);
          setModalOpen(false);
          setFormData({ name: '', email: '', password: '', role: 'MEMBER' });
          fetchUsers();
          alert('Usuário criado com sucesso!');
      } catch (error: any) {
          alert('Erro ao criar usuário: ' + (error.response?.data?.message || error.message));
      } finally {
          setLoading(false);
      }
  };

  const handleDelete = async (id: string) => {
      if (!confirm('Tem certeza que deseja remover este usuário?')) return;
      try {
          setLoading(true);
          await api.delete(`/users/${id}`);
          fetchUsers();
      } catch (error: any) {
          alert('Erro ao remover: ' + (error.response?.data?.message || error.message));
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-bold text-white">Equipe</h1>
            <p className="text-sm text-slate-400">Gerencie os usuários do seu escritório</p>
        </div>
        <button 
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
            <UserPlus size={18} />
            Novo Usuário
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-left text-sm">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                    <th className="px-6 py-3 font-medium">Nome</th>
                    <th className="px-6 py-3 font-medium">Email</th>
                    <th className="px-6 py-3 font-medium">Cargo</th>
                    <th className="px-6 py-3 font-medium text-right">Ações</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
                {users.map(user => (
                    <tr key={user.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-white flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-indigo-400">
                                <User size={16} />
                            </div>
                            {user.name}
                        </td>
                        <td className="px-6 py-4">{user.email}</td>
                        <td className="px-6 py-4">
                            <span className={clsx(
                                "px-2 py-1 rounded text-xs font-bold border",
                                user.role === 'OWNER' || user.role === 'ADMIN' 
                                    ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                                    : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                            )}>
                                {user.role === 'OWNER' ? 'DONO' : user.role === 'ADMIN' ? 'ADMIN' : 'MEMBRO'}
                            </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                           {user.role !== 'OWNER' && (
                               <button 
                                onClick={() => handleDelete(user.id)}
                                className="text-slate-500 hover:text-red-400 transition-colors p-2"
                                title="Remover usuário"
                               >
                                   <Trash2 size={16} />
                               </button>
                           )}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
        {users.length === 0 && !loading && (
            <div className="p-8 text-center text-slate-500">
                Nenhum usuário encontrado.
            </div>
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Novo Usuário"
      >
          <form onSubmit={handleSave} className="space-y-4">
              <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Nome Completo</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
                  />
              </div>
              <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">E-mail de Acesso</label>
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
                  />
              </div>
              <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Senha Provisória</label>
                  <input
                    required
                    type="password"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
                  />
              </div>
              <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Cargo</label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({...formData, role: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
                  >
                      <option value="MEMBER">Membro (Advogado/Colaborador)</option>
                      <option value="ADMIN">Administrador</option>
                  </select>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800 mt-6">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                  >
                      Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                      <Save size={18} />
                      Salvar
                  </button>
              </div>
          </form>
      </Modal>
    </div>
  );
}
