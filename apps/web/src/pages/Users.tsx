
import { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  UserPlus,
  Trash2,
  User,
  X,
  Save,
  Search,
  Edit2,
  Lock,
  Check
} from 'lucide-react';
import { clsx } from 'clsx';
import { SYSTEM_MODULES } from '../config/modules';

const Modal = ({ isOpen, onClose, title, children }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200">
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
  const [formData, setFormData] = useState<any>({ name: '', email: '', password: '', role: 'MEMBER', permissions: {} });

  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchUsers();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  const fetchUsers = async () => {
    try {
        setLoading(true);
        const res = await api.get('/users', {
            params: { search: search || undefined }
        });
        setUsers(res.data);
    } catch (error) {
        console.error('Erro ao buscar usuários', error);
    } finally {
        setLoading(false);
    }
  };

  const handleOpenModal = (user?: any) => {
    if (user) {
      setEditingId(user.id);
      setFormData({
        name: user.name,
        email: user.email,
        password: '', // Senha opcional na edição
        role: user.role,
        permissions: user.permissions || {}
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', email: '', password: '', role: 'MEMBER', permissions: {} });
    }
    setModalOpen(true);
  };

  const handleTogglePermission = (moduleId: string, action: string) => {
    setFormData((prev: any) => {
        const currentMod = prev.permissions?.[moduleId] || { access: true, create: true, read: true, update: true, delete: true };
        const newVal = !currentMod[action];
        
        const nextMod = { ...currentMod, [action]: newVal };
        
        if (action === 'access' && !newVal) {
            nextMod.create = false; nextMod.read = false; nextMod.update = false; nextMod.delete = false;
        }

        return { ...prev, permissions: { ...prev.permissions, [moduleId]: nextMod } };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          setLoading(true);
          
          if (editingId) {
            // Update
            const updateProps = { ...formData };
            if (!updateProps.password) delete updateProps.password;
            await api.patch(`/users/${editingId}`, updateProps);
            alert('Usuário atualizado com sucesso!');
          } else {
            // Create
            if (!formData.password) {
              alert('Senha é obrigatória para novos usuários');
              return;
            }
            await api.post('/users', formData);
            alert('Usuário criado com sucesso!');
          }
          
          setModalOpen(false);
          setFormData({ name: '', email: '', password: '', role: 'MEMBER', permissions: {} });
          setEditingId(null);
          fetchUsers();
      } catch (error: any) {
          alert('Erro ao salvar usuário: ' + (error.response?.data?.message || error.message));
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
        <div className="flex items-center gap-4">
            <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                    type="text" 
                    placeholder="Pesquisar por nome ou e-mail..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:border-indigo-500 outline-none w-64 transition-all focus:w-80"
                />
            </div>
            <button 
                onClick={() => handleOpenModal()}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
                <UserPlus size={18} />
                Novo Usuário
            </button>
        </div>
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
                            <div className="flex items-center justify-end gap-1">
                                <button 
                                    onClick={() => handleOpenModal(user)}
                                    className="text-slate-500 hover:text-indigo-400 transition-colors p-2"
                                    title="Editar usuário"
                                >
                                    <Edit2 size={16} />
                                </button>
                                {user.role !== 'OWNER' && (
                                    <button 
                                        onClick={() => handleDelete(user.id)}
                                        className="text-slate-500 hover:text-red-400 transition-colors p-2"
                                        title="Remover usuário"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
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
        title={editingId ? "Editar Usuário" : "Novo Usuário"}
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
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                      {editingId ? "Nova Senha (deixe em branco para manter)" : "Senha Provisória"}
                  </label>
                  <div className="relative">
                      <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        required={!editingId}
                        type="password"
                        value={formData.password}
                        onChange={e => setFormData({...formData, password: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-white focus:border-indigo-500 outline-none"
                      />
                  </div>
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

              {formData.role !== 'OWNER' && formData.role !== 'ADMIN' && (
                  <div className="mt-6 border-t border-slate-800 pt-6">
                      <h4 className="text-sm font-bold text-white mb-4">Níveis de Acesso por Módulo</h4>
                      <div className="overflow-x-auto rounded-lg border border-slate-800">
                          <table className="w-full text-left text-xs bg-slate-900">
                              <thead className="bg-slate-950 text-slate-400">
                                  <tr>
                                      <th className="px-4 py-2 font-medium border-r border-slate-800">Nome Rotina</th>
                                      <th className="px-4 py-2 font-medium text-center">Acessar</th>
                                      <th className="px-4 py-2 font-medium text-center">Cadastrar</th>
                                      <th className="px-4 py-2 font-medium text-center">Ver</th>
                                      <th className="px-4 py-2 font-medium text-center">Editar</th>
                                      <th className="px-4 py-2 font-medium text-center">Deletar</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800 text-slate-300">
                                  {SYSTEM_MODULES.map(mod => {
                                      const p = formData.permissions?.[mod.id] || { access: true, create: true, read: true, update: true, delete: true };
                                      return (
                                          <tr key={mod.id} className="hover:bg-slate-800/50">
                                              <td className="px-4 py-2 font-medium flex items-center gap-2 border-r border-slate-800">
                                                  <mod.icon size={14} className="text-slate-500" />
                                                  {mod.label}
                                              </td>
                                              {(['access', 'create', 'read', 'update', 'delete'] as const).map(action => (
                                                  <td key={action} className="px-4 py-2 text-center">
                                                      <button 
                                                        type="button" 
                                                        onClick={() => handleTogglePermission(mod.id, action)}
                                                        className={clsx(
                                                            "w-5 h-5 rounded flex items-center justify-center mx-auto transition-colors border",
                                                            p[action] 
                                                              ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/30" 
                                                              : "bg-slate-800 text-transparent border-slate-700 hover:border-slate-500"
                                                        )}
                                                      >
                                                          <Check size={12} className={clsx(!p[action] && "opacity-0")} />
                                                      </button>
                                                  </td>
                                              ))}
                                          </tr>
                                      );
                                  })}
                              </tbody>
                          </table>
                      </div>
                  </div>
              )}
              
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
